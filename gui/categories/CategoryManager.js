import { BORDER_WIDTH, isInside, PADDING, playClickSound, resetScissor, scissor } from '../Utils';
import { Button } from '../components/Button';
import { ColorPicker } from '../components/ColorPicker';
import { MultiToggle } from '../components/Dropdown';
import { Popup } from '../components/Popup';
import { Slider } from '../components/Slider';
import { TextInput } from '../components/TextInput';
import { Separator } from '../components/Separator';
import { getComponentLayoutHeight, isComponentVisible, layoutDirectComponents } from '../components/layout';
import { GuiRectangles, GuiState } from '../core/GuiState';
import { handleCategoryClick, handleCategoryScroll, updateCategoryTransitions } from './CategoryEvents';
import { drawCategoryItems, drawDirectComponents, drawOptionsPanel, getCategoryContentY, getCategoryRect, getDiscordPfpRect } from './CategoryRenderer';
import { SearchBar } from './CategorySearchBar';
import { Categories, getVisibleDirectComponents } from './CategorySystem';
import { getModule } from '../../utils/MacroState';
import { drawDashboard, getDashboardContentHeight, getDashboardModuleAt } from '../Dashboard';

let targetRightPanelScrollY = 0;
let currentRightPanelScrollY = 0;

let targetOptionsScrollY = 0;
let currentOptionsScrollY = 0;

let cachedItemLayouts = [];
let isLayoutCacheValid = false;
let cachedContentHeight = 0;
let isContentHeightCacheValid = false;
let lastQuery = '';
let pendingSettingsComponent = null;
let pendingThemeComponent = null;
let pendingModuleComponent = null;
let autoScrollRightActive = false;
let autoScrollOptionsActive = false;
let pendingHighlightComponent = null;
let lastDrawTime = Date.now();
const macroToggleButton = new Button(
    '',
    0,
    0,
    'Enable',
    () => {
        const selectedItem = Categories.selectedItem;
        if (!selectedItem) return;

        const module = getModule(selectedItem.title);
        if (!module) return;

        const enabledByClick = typeof module.requestToggleFromUser === 'function' ? module.requestToggleFromUser() : false;
        if (module.isMacro && enabledByClick && GuiState.myGui.isOpen()) {
            Client.currentGui.close();
        }
    },
    { showContainer: false }
);

const SCROLL_SMOOTHING_FACTOR = 0.25;
const AUTO_SCROLL_SMOOTHING_FACTOR = 0.06;
const getCategorySelectionRect = (name) => {
    if (name === 'Discord') {
        const pfpRect = getDiscordPfpRect();
        return { x: pfpRect.x - 2, y: pfpRect.y - 2, width: pfpRect.width + 4, height: pfpRect.height + 4, radius: 16 };
    }
    const visibleIndex = Categories.getVisibleCategories().findIndex((category) => category.name === name);
    if (visibleIndex === -1) return null;
    const rect = getCategoryRect(visibleIndex);
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        radius: 8,
    };
};

const setRightPanelScrollY = (value) => {
    currentRightPanelScrollY = value;
    targetRightPanelScrollY = value;
};
const setTargetRightPanelScrollY = (value) => {
    targetRightPanelScrollY = value;
};

const setOptionsScrollY = (value) => {
    currentOptionsScrollY = value;
    targetOptionsScrollY = value;
    Categories.optionsScrollY = value;
};
const setTargetOptionsScrollY = (value) => {
    targetOptionsScrollY = value;
};

const resetCategoryScroll = () => {
    setRightPanelScrollY(0);
    setOptionsScrollY(0);
};

const beginCategorySwap = (targetName) => {
    Categories.optionsReturnCategory = null;
    Categories.previousSelected = Categories.selected;
    Categories.selected = targetName;
    Categories.currentPage = 'categories';
    Categories.selectedItem = null;
    Categories.selectedSubcategory = null;
    Categories.transitionType = 'category-swap';
    const oldRect = getCategorySelectionRect(Categories.previousSelected);
    const newRect = getCategorySelectionRect(targetName);
    if (oldRect && newRect) {
        Categories.catAnimationRect = {
            startX: oldRect.x,
            startY: oldRect.y,
            endX: newRect.x,
            endY: newRect.y,
            width: oldRect.width,
            height: oldRect.height,
            startRadius: oldRect.radius || 8,
            endRadius: newRect.radius || 8,
            radius: oldRect.radius || 8,
        };
        Categories.catTransitionStart = Date.now();
        Categories.transitionDirection = newRect.y >= oldRect.y ? 1 : -1;
    } else {
        Categories.transitionDirection = 1;
    }
    Categories.transitionProgress = 0;
    Categories.transitionStart = Date.now();
    playClickSound();
    isLayoutCacheValid = false;
    isContentHeightCacheValid = false;
    resetCategoryScroll();
};

const beginModuleOptionsSwap = (moduleItem, returnCategory = null) => {
    Categories.transitionType = 'page';
    Categories.transitionDirection = 1;
    Categories.transitionProgress = 0;
    Categories.transitionStart = Date.now();
    Categories.selectedItem = moduleItem;
    Categories.optionsReturnCategory = returnCategory;
    playClickSound();
    isLayoutCacheValid = false;
    isContentHeightCacheValid = false;
    resetCategoryScroll();
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getSearchRegexes = (query) => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return tokens.map((token) => new RegExp(`\\b${escapeRegExp(token)}`));
};
const matchesSearch = (value, searchRegexes) => {
    if (!value || searchRegexes.length === 0) return false;
    const text = value.toLowerCase();
    return searchRegexes.every((regex) => regex.test(text));
};

const getFilteredItems = (cat, query) => {
    const searchRegexes = getSearchRegexes(query);

    if (searchRegexes.length === 0) {
        return cat.items.filter((group) => {
            if (group.type === 'separator') {
                return Categories.selectedSubcategory === null || group.title === Categories.selectedSubcategory;
            }
            return true;
        });
    }

    const categoryMatches = matchesSearch(cat.name, searchRegexes);
    const allowComponentMatch = cat.name !== 'Modules';

    return cat.items.reduce((acc, group) => {
        if (group.type === 'separator') {
            const subcategoryMatches = matchesSearch(group.title, searchRegexes);

            const matchingItems = group.items.filter((item) => {
                const titleMatch = matchesSearch(item.title, searchRegexes);
                const descMatch = matchesSearch(item.description, searchRegexes);

                const componentMatch = item.components && item.components.some((comp) => isComponentVisible(comp) && matchesSearch(comp.title, searchRegexes));
                return categoryMatches || subcategoryMatches || titleMatch || descMatch || (allowComponentMatch && componentMatch);
            });

            if (matchingItems.length > 0) {
                const groupCopy = Object.assign(Object.create(Object.getPrototypeOf(group)), group);
                groupCopy.items = matchingItems;
                acc.push(groupCopy);
            }
        } else {
            const titleMatch = matchesSearch(group.title, searchRegexes);
            const componentMatch = group.components && group.components.some((comp) => isComponentVisible(comp) && matchesSearch(comp.title, searchRegexes));

            if (categoryMatches || titleMatch || (allowComponentMatch && componentMatch)) {
                acc.push(group);
            }
        }
        return acc;
    }, []);
};

const getDirectComponentMatches = (categoryName, resultTitle, resultType, query) => {
    const searchRegexes = getSearchRegexes(query);
    if (searchRegexes.length === 0) return [];

    const directCategory = Categories.categories.find((c) => c.name === categoryName);
    if (!directCategory || !directCategory.directComponents) return [];

    const matches = directCategory.directComponents.filter((component) => {
        if (!isComponentVisible(component)) return false;
        const titleMatch = matchesSearch(component.title, searchRegexes);
        const descMatch = matchesSearch(component.description, searchRegexes);
        const sectionMatch = matchesSearch(component.sectionName, searchRegexes);
        return titleMatch || descMatch || sectionMatch;
    });

    if (matches.length === 0) return [];

    const resultGroup = new Separator(resultTitle, true);
    resultGroup.items = matches.map((component) => ({
        type: resultType,
        component,
        title: component.title,
        description: component.description,
        sectionName: component.sectionName || categoryName,
        tooltip: component.description || null,
    }));

    return [resultGroup];
};

const getSettingsDirectMatches = (query) => getDirectComponentMatches('Settings', 'Settings Results', 'direct-component', query);
const getThemeDirectMatches = (query) => getDirectComponentMatches('Theme', 'Theme Results', 'theme-component', query);

const getModuleComponentMatches = (cat, query) => {
    const searchRegexes = getSearchRegexes(query);
    if (searchRegexes.length === 0 || !cat) return [];

    const matches = [];
    const pushMatch = (item, component) => {
        matches.push({
            type: 'module-component',
            component,
            parentItem: item,
            title: component.title,
            description: component.description,
            moduleTitle: item.title,
            tooltip: component.description || null,
            moduleType: item.moduleType,
        });
    };

    const checkComponent = (item, component) => {
        if (!component || !isComponentVisible(component) || component instanceof Separator) return;
        const titleMatch = matchesSearch(component.title, searchRegexes);
        const descMatch = matchesSearch(component.description, searchRegexes);
        if (titleMatch || descMatch) pushMatch(item, component);
    };

    cat.items.forEach((group) => {
        if (group.type === 'separator') {
            group.items.forEach((item) => {
                item.components?.forEach((component) => checkComponent(item, component));
            });
        } else {
            group.components?.forEach((component) => checkComponent(group, component));
        }
    });

    if (matches.length === 0) return [];

    const resultGroup = new Separator('Module Settings', true);
    resultGroup.items = matches;
    return [resultGroup];
};

const calculateDirectComponentsHeight = (categoryName) => {
    const directCat = Categories.categories.find((c) => c.name === categoryName);
    if (!directCat || !directCat.directComponents) return 0;

    const panel = GuiRectangles.RightPanel;
    return getCategoryContentY(directCat, panel) - panel.y + layoutDirectComponents(getVisibleDirectComponents(categoryName)).height;
};

const getDirectComponentScrollY = (categoryName, component) => {
    const directCategory = Categories.categories.find((c) => c.name === categoryName);
    if (!directCategory || !directCategory.directComponents) return 0;

    const panel = GuiRectangles.RightPanel;
    const row = layoutDirectComponents(directCategory.directComponents, getCategoryContentY(directCategory, panel) - panel.y).rows.find(
        (item) => item.component === component
    );
    return row ? Math.max(0, row.y - 10) : 0;
};

const getModuleComponentScrollY = (item, component) => {
    if (!item || !item.components) return 0;

    let currentY = 78;
    for (let i = 0; i < item.components.length; i++) {
        const comp = item.components[i];
        if (!isComponentVisible(comp)) continue;
        if (comp === component) {
            return Math.max(0, currentY - 10);
        }

        currentY += getComponentLayoutHeight(comp);
    }

    return 0;
};

const getSelectedToggleModule = () => {
    if (!Categories.selectedItem || Categories.selected !== 'Modules') return null;
    const module = getModule(Categories.selectedItem.title);
    if (!module) return null;
    return module.showEnabledToggle ? module : null;
};

const calculateContentHeight = () => {
    if (Categories.selected === 'Dashboard') {
        cachedContentHeight = getDashboardContentHeight();
        isContentHeightCacheValid = true;
        return;
    }

    if (!isContentHeightCacheValid && Categories.selected) {
        let height = 0;
        const category = Categories.categories.find((c) => c.name === Categories.selected);

        if (category) {
            if (category.directComponents && category.directComponents.length > 0) {
                height = calculateDirectComponentsHeight(Categories.selected);
                cachedContentHeight = height;
                isContentHeightCacheValid = true;
                return;
            }
            const rawQuery = SearchBar.query.trim();
            const query = rawQuery.toLowerCase();
            if (category.subcategories.length > 0 && (query.length === 0 || category.name === 'Modules')) {
                height += getCategoryContentY(category, GuiRectangles.RightPanel) - GuiRectangles.RightPanel.y;
            }
            const itemsToDisplay = getFilteredItems(category, query);
            const gridColumns = GuiRectangles.RightPanel.width < 300 ? 1 : 3;
            const gridRowHeight = category.name === 'Modules' ? 46 : 54;
            let nonGroupedItemCount = 0;
            let hasAnyResults = itemsToDisplay.length > 0;
            const processNonGrouped = () => {
                if (nonGroupedItemCount > 0) {
                    height += Math.ceil(nonGroupedItemCount / gridColumns) * gridRowHeight;
                    nonGroupedItemCount = 0;
                }
            };
            itemsToDisplay.forEach((group, index) => {
                if (group.type === 'separator') {
                    processNonGrouped();
                    if (index > 0) height += 12;
                    height += 22;
                    if (group.items.length > 0) {
                        height += Math.ceil(group.items.length / gridColumns) * gridRowHeight;
                    }
                } else {
                    nonGroupedItemCount++;
                }
            });
            processNonGrouped();

            if (category.name === 'Modules' && query.length > 0) {
                const moduleMatches = getModuleComponentMatches(category, query);
                const settingsMatches = getSettingsDirectMatches(query);
                const themeMatches = getThemeDirectMatches(query);

                if (moduleMatches.length > 0) {
                    if (itemsToDisplay.length > 0) height += 12;
                    height += 22;
                    height += Math.ceil(moduleMatches[0].items.length / gridColumns) * gridRowHeight;
                    hasAnyResults = true;
                }

                if (settingsMatches.length > 0) {
                    if (itemsToDisplay.length > 0 || moduleMatches.length > 0) height += 12;
                    height += 22;
                    height += Math.ceil(settingsMatches[0].items.length / gridColumns) * gridRowHeight;
                    hasAnyResults = true;
                }

                if (themeMatches.length > 0) {
                    if (itemsToDisplay.length > 0 || moduleMatches.length > 0 || settingsMatches.length > 0) height += 12;
                    height += 22;
                    height += Math.ceil(themeMatches[0].items.length / gridColumns) * gridRowHeight;
                    hasAnyResults = true;
                }
            }

            if (query.length > 0 && !hasAnyResults) {
                height += 64;
            }

            height += PADDING;
        }
        cachedContentHeight = height;
        isContentHeightCacheValid = true;
    }
};

const calculateOptionsContentHeight = () => {
    if (Categories.currentPage === 'options' && Categories.selectedItem) {
        let height = 78 + PADDING;
        const components = Categories.selectedItem.components;
        if (components) {
            components.forEach((component) => {
                height += getComponentLayoutHeight(component);
            });
        }
        height += PADDING;
        return height;
    }
    return 0;
};

const drawPopups = (mouseX, mouseY) => {
    const components = Categories.currentPage === 'categories' ? getVisibleDirectComponents(Categories.selected) : Categories.selectedItem?.components;
    if (!components) return;

    components.forEach((component) => {
        if (isComponentVisible(component) && component instanceof Popup && typeof component.drawOverlay === 'function') {
            component.drawOverlay(mouseX, mouseY);
        }
    });
};

const draw = (mouseX, mouseY) => {
    const now = Date.now();
    const elapsedFrames = Math.max(0, now - lastDrawTime) / (1000 / 60);
    lastDrawTime = now;

    if (pendingSettingsComponent && Categories.selected === 'Settings' && Categories.currentPage === 'categories' && Categories.transitionDirection === 0) {
        const targetScroll = getDirectComponentScrollY('Settings', pendingSettingsComponent);
        setTargetRightPanelScrollY(targetScroll);
        autoScrollRightActive = true;
        pendingHighlightComponent = pendingSettingsComponent;
        pendingSettingsComponent = null;
    }

    if (pendingThemeComponent && Categories.selected === 'Theme' && Categories.currentPage === 'categories' && Categories.transitionDirection === 0) {
        const targetScroll = getDirectComponentScrollY('Theme', pendingThemeComponent);
        setTargetRightPanelScrollY(targetScroll);
        autoScrollRightActive = true;
        pendingHighlightComponent = pendingThemeComponent;
        pendingThemeComponent = null;
    }

    if (
        pendingModuleComponent &&
        Categories.currentPage === 'options' &&
        Categories.selectedItem === pendingModuleComponent.item &&
        Categories.transitionDirection === 0
    ) {
        const targetScroll = getModuleComponentScrollY(pendingModuleComponent.item, pendingModuleComponent.component);
        setTargetOptionsScrollY(targetScroll);
        autoScrollOptionsActive = true;
        pendingHighlightComponent = pendingModuleComponent.component;
        pendingModuleComponent = null;
    }

    const rawQuery = SearchBar.query.trim();
    const query = rawQuery.toLowerCase();
    if (query !== lastQuery) {
        isContentHeightCacheValid = false;
        isLayoutCacheValid = false;
        if (query && Categories.selected !== 'Modules') beginCategorySwap('Modules');
        lastQuery = query;
    }

    const cacheInvalidated = updateCategoryTransitions();
    if (cacheInvalidated) {
        isLayoutCacheValid = false;
        isContentHeightCacheValid = false;
    }

    let activeComponentAnimation = false;

    const checkComponentsForAnim = (components) => {
        if (!components) return false;
        return components.some((c) => (c instanceof MultiToggle || c instanceof ColorPicker) && c.animStart !== 0);
    };

    if (Categories.currentPage === 'categories') {
        const directCat = Categories.categories.find((c) => c.name === Categories.selected);
        if (directCat?.directComponents && checkComponentsForAnim(directCat.directComponents)) activeComponentAnimation = true;
    } else if (Categories.currentPage === 'options' && Categories.selectedItem) {
        if (checkComponentsForAnim(Categories.selectedItem.components)) activeComponentAnimation = true;
    }

    if (activeComponentAnimation) {
        isContentHeightCacheValid = false;
        isLayoutCacheValid = false;
    }

    const transitionActive = Categories.transitionDirection !== 0;
    const shouldDrawItems = Categories.currentPage === 'categories' || transitionActive;
    const shouldDrawOptions = Categories.currentPage === 'options' || transitionActive;

    calculateContentHeight();

    const contentViewportHeight = GuiRectangles.RightPanel.height;
    const maxScroll = Math.max(0, cachedContentHeight - contentViewportHeight + PADDING);

    targetRightPanelScrollY = Math.max(0, Math.min(targetRightPanelScrollY, maxScroll));

    const prevScrollY = currentRightPanelScrollY;
    const rightScrollFactor = 1 - Math.pow(1 - (autoScrollRightActive ? AUTO_SCROLL_SMOOTHING_FACTOR : SCROLL_SMOOTHING_FACTOR), elapsedFrames);
    currentRightPanelScrollY += (targetRightPanelScrollY - currentRightPanelScrollY) * rightScrollFactor;
    if (autoScrollRightActive && Math.abs(targetRightPanelScrollY - currentRightPanelScrollY) < 0.5) {
        autoScrollRightActive = false;
        if (pendingHighlightComponent && typeof pendingHighlightComponent.startHighlight === 'function') {
            pendingHighlightComponent.startHighlight();
            pendingHighlightComponent = null;
        }
    }

    if (Math.abs(currentRightPanelScrollY - prevScrollY) > 0.1) isLayoutCacheValid = false;

    if (shouldDrawOptions) {
        const optionsContentHeight = calculateOptionsContentHeight();
        const maxOptionsScroll = Math.max(0, optionsContentHeight - GuiRectangles.RightPanel.height);
        targetOptionsScrollY = Math.max(0, Math.min(targetOptionsScrollY, maxOptionsScroll));
        const optionsScrollFactor = 1 - Math.pow(1 - (autoScrollOptionsActive ? AUTO_SCROLL_SMOOTHING_FACTOR : SCROLL_SMOOTHING_FACTOR), elapsedFrames);
        currentOptionsScrollY += (targetOptionsScrollY - currentOptionsScrollY) * optionsScrollFactor;
        if (autoScrollOptionsActive && Math.abs(targetOptionsScrollY - currentOptionsScrollY) < 0.5) {
            autoScrollOptionsActive = false;
            if (pendingHighlightComponent && typeof pendingHighlightComponent.startHighlight === 'function') {
                pendingHighlightComponent.startHighlight();
                pendingHighlightComponent = null;
            }
        }
        Categories.optionsScrollY = currentOptionsScrollY;
    }

    const panel = GuiRectangles.RightPanel;
    const isMouseInsidePanel = isInside(mouseX, mouseY, panel);
    const contentMouseX = isMouseInsidePanel ? mouseX : NaN;
    const contentMouseY = isMouseInsidePanel ? mouseY : NaN;
    scissor(panel.x, panel.y - BORDER_WIDTH, panel.width, panel.height + BORDER_WIDTH);

    if (shouldDrawItems) {
        if (!isLayoutCacheValid) cachedItemLayouts = [];

        const isCategorySwap = transitionActive && Categories.transitionType === 'category-swap';

        const drawSingleCategory = (catName, currentPanelX, isNewCategory, contentPanel = panel) => {
            const cat = Categories.categories.find((c) => c.name === catName);
            if (!cat) return;
            const contentY = getCategoryContentY(cat, contentPanel);
            let yOffset = contentY - currentRightPanelScrollY;
            if (cat.name === 'Dashboard') {
                drawDashboard(contentPanel, currentPanelX, contentY, contentMouseX, contentMouseY, currentRightPanelScrollY);
                return;
            }
            if (cat.directComponents && cat.directComponents.length > 0) {
                drawDirectComponents(contentPanel, currentPanelX, contentY, contentMouseX, contentMouseY, currentRightPanelScrollY, catName);
                return;
            }
            const itemsToDisplay = getFilteredItems(cat, query);
            if (catName === 'Modules' && query.length > 0) {
                const moduleMatches = getModuleComponentMatches(cat, query);
                const settingsMatches = getSettingsDirectMatches(query);
                const themeMatches = getThemeDirectMatches(query);
                if (moduleMatches.length > 0) itemsToDisplay.push(...moduleMatches);
                if (settingsMatches.length > 0) itemsToDisplay.push(...settingsMatches);
                if (themeMatches.length > 0) itemsToDisplay.push(...themeMatches);
            }
            drawCategoryItems(
                cat,
                contentPanel,
                currentPanelX,
                yOffset,
                contentMouseX,
                contentMouseY,
                itemsToDisplay,
                cachedItemLayouts,
                isLayoutCacheValid || !isNewCategory,
                rawQuery
            );
        };

        if (isCategorySwap && Categories.previousSelected) {
            const progress = Categories.transitionProgress;
            const dir = Categories.transitionDirection;

            const incomingX = panel.x + (dir === 1 ? panel.width * (1 - progress) : -panel.width * (1 - progress));
            drawSingleCategory(Categories.selected, incomingX, true);
            const outgoingX = panel.x + (dir === 1 ? -panel.width * progress : panel.width * progress);
            drawSingleCategory(Categories.previousSelected, outgoingX, false);
        } else {
            let panelX = panel.x;
            if (transitionActive && Categories.transitionType === 'page') {
                if (Categories.transitionDirection === 1) panelX -= panel.width * Categories.transitionProgress;
                else if (Categories.transitionDirection === -1) panelX -= panel.width * (1 - Categories.transitionProgress);
            }

            const transitionCategory =
                transitionActive && Categories.transitionType === 'page' && Categories.optionsReturnCategory
                    ? Categories.optionsReturnCategory
                    : Categories.selected;
            drawSingleCategory(transitionCategory, panelX, true);
            if (!isLayoutCacheValid && !transitionActive) isLayoutCacheValid = true;
        }
    }

    const toggleModule = getSelectedToggleModule();
    if (toggleModule) {
        macroToggleButton.setButtonText(toggleModule.enabled ? 'Disable' : 'Enable');
    }

    if (shouldDrawOptions) drawOptionsPanel(panel, contentMouseX, contentMouseY, toggleModule ? macroToggleButton : null);
    resetScissor();
};

const handleClick = (mouseX, mouseY) => {
    const finishedTextInput = TextInput.handleGlobalClick(mouseX, mouseY);
    const finishedSlider = Slider.handleGlobalClick(mouseX, mouseY);
    if (finishedTextInput || finishedSlider) return;

    const panel = GuiRectangles.RightPanel;
    const components = Categories.currentPage === 'categories' ? getVisibleDirectComponents(Categories.selected) : Categories.selectedItem?.components;
    const openPopup = components?.find((component) => component instanceof Popup && component.isOpen);
    if (openPopup && typeof openPopup.handleOverlayClick === 'function' && openPopup.handleOverlayClick(mouseX, mouseY)) {
        return;
    }

    const shouldHandleSearch = Categories.currentPage === 'categories' && Categories.transitionDirection === 0;
    const searchY = GuiRectangles.LeftPanel.y + PADDING;
    if (shouldHandleSearch && SearchBar.handleClick(mouseX, mouseY, GuiRectangles.ModuleSearch, searchY)) {
        isLayoutCacheValid = false;
        isContentHeightCacheValid = false;
        resetCategoryScroll();
        return;
    }

    const toggleModule = getSelectedToggleModule();
    if (toggleModule && macroToggleButton.handleClick(mouseX, mouseY)) {
        return;
    }

    if (
        Categories.selected === 'Dashboard' &&
        Categories.currentPage === 'categories' &&
        Categories.transitionDirection === 0 &&
        isInside(mouseX, mouseY, panel)
    ) {
        const moduleName = getDashboardModuleAt(mouseX, mouseY);
        const moduleItem = moduleName ? Categories.findItem('Modules', moduleName) : null;
        if (moduleItem) {
            Categories.previousSelected = Categories.selected;
            const oldRect = getCategorySelectionRect(Categories.previousSelected);
            const newRect = getCategorySelectionRect('Modules');
            if (oldRect && newRect) {
                Categories.catAnimationRect = {
                    startX: oldRect.x,
                    startY: oldRect.y,
                    endX: newRect.x,
                    endY: newRect.y,
                    width: oldRect.width,
                    height: oldRect.height,
                    startRadius: oldRect.radius || 8,
                    endRadius: newRect.radius || 8,
                    radius: oldRect.radius || 8,
                };
                Categories.catTransitionStart = Date.now();
            }
            Categories.selected = 'Modules';
            Categories.currentPage = 'categories';
            Categories.selectedSubcategory = null;
            beginModuleOptionsSwap(moduleItem, 'Dashboard');
            return;
        }
    }

    const canUseCachedLayouts = Categories.currentPage === 'categories' && Categories.transitionDirection === 0 && isInside(mouseX, mouseY, panel);
    if (canUseCachedLayouts) {
        const directMatch = cachedItemLayouts.find((layout) => layout?.item?.type === 'direct-component' && isInside(mouseX, mouseY, layout.rect));
        if (directMatch) {
            pendingSettingsComponent = directMatch.item.component;
            beginCategorySwap('Settings');
            return;
        }

        const themeMatch = cachedItemLayouts.find((layout) => layout?.item?.type === 'theme-component' && isInside(mouseX, mouseY, layout.rect));
        if (themeMatch) {
            pendingThemeComponent = themeMatch.item.component;
            beginCategorySwap('Theme');
            return;
        }

        const moduleMatch = cachedItemLayouts.find((layout) => layout?.item?.type === 'module-component' && isInside(mouseX, mouseY, layout.rect));
        if (moduleMatch) {
            pendingModuleComponent = { item: moduleMatch.item.parentItem, component: moduleMatch.item.component };
            beginModuleOptionsSwap(moduleMatch.item.parentItem);
            return;
        }
    }

    handleCategoryClick(
        mouseX,
        mouseY,
        panel,
        currentRightPanelScrollY,
        cachedItemLayouts,
        getCategoryRect,
        () => {
            isLayoutCacheValid = false;
            resetCategoryScroll();
        },
        () => {
            isContentHeightCacheValid = false;
            resetCategoryScroll();
        },
        resetCategoryScroll
    );
};

const handleScroll = (mouseX, mouseY, dir) => {
    autoScrollRightActive = false;
    autoScrollOptionsActive = false;
    handleCategoryScroll(
        mouseX,
        mouseY,
        dir,
        GuiRectangles.RightPanel,
        cachedContentHeight,
        currentRightPanelScrollY,
        setTargetRightPanelScrollY,
        currentOptionsScrollY,
        setTargetOptionsScrollY,
        calculateOptionsContentHeight()
    );
    isLayoutCacheValid = false;
};

const handleMouseDrag = (mouseX, mouseY) => {
    isLayoutCacheValid = false;
    const components = Categories.currentPage === 'categories' ? getVisibleDirectComponents(Categories.selected) : Categories.selectedItem?.components;
    components?.forEach((c) => {
        if (typeof c.handleMouseDrag === 'function') {
            c.handleMouseDrag(mouseX, mouseY);
        }
    });
};

const handleMouseRelease = () => {
    const components = Categories.currentPage === 'categories' ? getVisibleDirectComponents(Categories.selected) : Categories.selectedItem?.components;
    components?.forEach((c) => {
        if (typeof c.handleMouseRelease === 'function') c.handleMouseRelease();
    });
};

export const categoryManager = {
    draw,
    drawPopups,
    handleClick,
    handleScroll,
    handleMouseDrag,
    handleMouseRelease,
    invalidateLayoutCache: () => {
        isLayoutCacheValid = false;
    },
    invalidateContentHeightCache: () => {
        isContentHeightCacheValid = false;
    },
    resetScroll: resetCategoryScroll,
    getRightPanelScrollY: () => currentRightPanelScrollY,
    setRightPanelScrollY: (v) => setRightPanelScrollY(v),
};
