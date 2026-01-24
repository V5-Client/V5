import { Categories } from './CategorySystem';
import { MultiToggle } from '../components/Dropdown';
import { ColorPicker } from '../components/ColorPicker';
import { Separator } from '../components/Separator';
import { drawSubcategoryButtons, drawOptionsPanel, drawCategoryItems, drawDirectComponents, getCategoryRect } from './CategoryRenderer';
import { handleCategoryClick, handleCategoryScroll, updateCategoryTransitions } from './CategoryEvents';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder, PADDING, scissor, resetScissor, isInside, playClickSound } from '../Utils';
import { GuiRectangles } from '../core/GuiState';
import { SearchBar } from './CategorySearchBar';

export const createCategoriesManager = (deps) => {
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

    const SCROLL_SMOOTHING_FACTOR = 0.2;
    const AUTO_SCROLL_SMOOTHING_FACTOR = 0.06;
    const ICON_SIZE = 28;
    const HIGHLIGHT_PADDING = 2;
    const HIGHLIGHT_SIZE = ICON_SIZE + HIGHLIGHT_PADDING * 2;

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
        Categories.previousSelected = Categories.selected;
        Categories.selected = targetName;
        Categories.currentPage = 'categories';
        Categories.selectedItem = null;
        Categories.selectedSubcategory = null;
        Categories.transitionType = 'category-swap';
        const oldIndex = Categories.categories.findIndex((c) => c.name === Categories.previousSelected);
        const newIndex = Categories.categories.findIndex((c) => c.name === targetName);
        if (oldIndex !== -1 && newIndex !== -1) {
            const oldRect = getCategoryRect(oldIndex);
            const newRect = getCategoryRect(newIndex);
            Categories.catAnimationRect = {
                startX: oldRect.x + (oldRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING,
                startY: oldRect.y + (oldRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING,
                endX: newRect.x + (newRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING,
                endY: newRect.y + (newRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING,
                width: HIGHLIGHT_SIZE,
                height: HIGHLIGHT_SIZE,
                radius: 8,
            };
            Categories.catTransitionStart = Date.now();
        }
        Categories.transitionDirection = newIndex >= oldIndex ? 1 : -1;
        Categories.transitionProgress = 0;
        Categories.transitionStart = Date.now();
        playClickSound();
        isLayoutCacheValid = false;
        isContentHeightCacheValid = false;
        resetCategoryScroll();
    };

    const beginModuleOptionsSwap = (moduleItem) => {
        Categories.transitionType = 'page';
        Categories.transitionDirection = 1;
        Categories.transitionProgress = 0;
        Categories.transitionStart = Date.now();
        Categories.selectedItem = moduleItem;
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

                    const componentMatch = item.components && item.components.some((comp) => matchesSearch(comp.title, searchRegexes));
                    return categoryMatches || subcategoryMatches || titleMatch || descMatch || (allowComponentMatch && componentMatch);
                });

                if (matchingItems.length > 0) {
                    const groupCopy = Object.assign(Object.create(Object.getPrototypeOf(group)), group);
                    groupCopy.items = matchingItems;
                    acc.push(groupCopy);
                }
            } else {
                const titleMatch = matchesSearch(group.title, searchRegexes);
                const componentMatch = group.components && group.components.some((comp) => matchesSearch(comp.title, searchRegexes));

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
            });
        };

        const checkComponent = (item, component) => {
            if (!component || component instanceof Separator) return;
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

        let height = PADDING;
        let currentSection = null;

        directCat.directComponents.forEach((component, index) => {
            if (component.sectionName && component.sectionName !== currentSection) {
                currentSection = component.sectionName;
                if (index > 0) height += 16;
                height += 26;
            }

            let componentHeight = component instanceof Separator ? 26 : 48 + 6;

            if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
                if (component.animationProgress !== undefined) {
                    componentHeight += component.getExpandedHeight() * component.animationProgress;
                }
            }

            height += componentHeight;
        });

        height += PADDING;
        return height;
    };

    const getDirectComponentScrollY = (categoryName, component) => {
        const directCategory = Categories.categories.find((c) => c.name === categoryName);
        if (!directCategory || !directCategory.directComponents) return 0;

        let currentY = PADDING;
        let currentSection = null;

        for (let i = 0; i < directCategory.directComponents.length; i++) {
            const comp = directCategory.directComponents[i];
            if (comp.sectionName && comp.sectionName !== currentSection) {
                currentSection = comp.sectionName;
                if (i > 0) currentY += 16;
                currentY += 26;
            }

            let compHeight = comp instanceof Separator ? 26 : 48 + 6;
            if ((comp instanceof MultiToggle || comp instanceof ColorPicker) && typeof comp.getExpandedHeight === 'function') {
                if (comp.animationProgress !== undefined) {
                    compHeight += comp.getExpandedHeight() * comp.animationProgress;
                }
            }

            if (comp === component) {
                return Math.max(0, currentY - 10);
            }

            currentY += compHeight;
        }

        return 0;
    };

    const getModuleComponentScrollY = (item, component) => {
        if (!item || !item.components) return 0;

        let currentY = 78;
        for (let i = 0; i < item.components.length; i++) {
            const comp = item.components[i];
            const isSeparator = comp instanceof Separator;
            let compHeight = isSeparator ? 26 : 48 + 6;

            if (!isSeparator && (comp instanceof MultiToggle || comp instanceof ColorPicker) && typeof comp.getExpandedHeight === 'function') {
                if (comp.animationProgress !== undefined) {
                    compHeight += comp.getExpandedHeight() * comp.animationProgress;
                }
            }

            if (comp === component) {
                return Math.max(0, currentY - 10);
            }

            currentY += compHeight;
        }

        return 0;
    };

    const calculateContentHeight = () => {
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
                if (category.subcategories.length > 0 && query.length === 0) {
                    height += 28 + PADDING;
                }
                const itemsToDisplay = getFilteredItems(category, query);
                let nonGroupedItemCount = 0;
                let hasAnyResults = itemsToDisplay.length > 0;
                const processNonGrouped = () => {
                    if (nonGroupedItemCount > 0) {
                        height += Math.ceil(nonGroupedItemCount / 3) * 54;
                        nonGroupedItemCount = 0;
                    }
                };
                itemsToDisplay.forEach((group, index) => {
                    if (group.type === 'separator') {
                        processNonGrouped();
                        if (index > 0) height += 12;
                        height += 22;
                        if (group.items.length > 0) {
                            height += Math.ceil(group.items.length / 3) * 54;
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
                        height += Math.ceil(moduleMatches[0].items.length / 3) * 54;
                        hasAnyResults = true;
                    }

                    if (settingsMatches.length > 0) {
                        if (itemsToDisplay.length > 0 || moduleMatches.length > 0) height += 12;
                        height += 22;
                        height += Math.ceil(settingsMatches[0].items.length / 3) * 54;
                        hasAnyResults = true;
                    }

                    if (themeMatches.length > 0) {
                        if (itemsToDisplay.length > 0 || moduleMatches.length > 0 || settingsMatches.length > 0) height += 12;
                        height += 22;
                        height += Math.ceil(themeMatches[0].items.length / 3) * 54;
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
                    let compHeight = 54;
                    if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
                        compHeight += component.getExpandedHeight() * (component.animationProgress || 0);
                    }
                    height += compHeight;
                });
            }
            height += PADDING;
            return height;
        }
        return 0;
    };

    const draw = (mouseX, mouseY) => {
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
            lastQuery = query;
        }

        const cacheInvalidated = updateCategoryTransitions();
        if (cacheInvalidated) isLayoutCacheValid = false;

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

        const maxScroll = Math.max(0, cachedContentHeight - deps.rectangles.RightPanel.height + PADDING);

        targetRightPanelScrollY = Math.max(0, Math.min(targetRightPanelScrollY, maxScroll));

        const prevScrollY = currentRightPanelScrollY;
        const rightScrollFactor = autoScrollRightActive ? AUTO_SCROLL_SMOOTHING_FACTOR : SCROLL_SMOOTHING_FACTOR;
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
            const maxOptionsScroll = Math.max(0, optionsContentHeight - deps.rectangles.RightPanel.height);
            targetOptionsScrollY = Math.max(0, Math.min(targetOptionsScrollY, maxOptionsScroll));
            const optionsScrollFactor = autoScrollOptionsActive ? AUTO_SCROLL_SMOOTHING_FACTOR : SCROLL_SMOOTHING_FACTOR;
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

        const panel = deps.rectangles.RightPanel;
        const rightPanelScrollY = currentRightPanelScrollY;
        scissor(panel.x, panel.y, panel.width, panel.height);

        if (shouldDrawItems) {
            if (!isLayoutCacheValid) cachedItemLayouts = [];

            const isCategorySwap = transitionActive && Categories.transitionType === 'category-swap';

            const drawSingleCategory = (catName, currentPanelX, isNewCategory) => {
                const cat = Categories.categories.find((c) => c.name === catName);
                if (!cat) return;
                let yOffset = panel.y + PADDING - currentRightPanelScrollY;
                if (cat.directComponents && cat.directComponents.length > 0) {
                    drawDirectComponents(panel, currentPanelX, panel.y + PADDING, mouseX, mouseY, currentRightPanelScrollY, catName);
                    return;
                }
                if (cat.subcategories.length > 0) {
                    cat.isHoverBlocked = catName === 'Modules' ? SearchBar.isHoverBlocked(mouseX, mouseY) : false;
                    yOffset = drawSubcategoryButtons(cat, currentPanelX, yOffset, mouseX, mouseY);
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
                    panel,
                    currentPanelX,
                    yOffset,
                    mouseX,
                    mouseY,
                    itemsToDisplay,
                    cachedItemLayouts,
                    isLayoutCacheValid || !isNewCategory,
                    rawQuery
                );
            };

            if (isCategorySwap && Categories.previousSelected) {
                const progress = Categories.transitionProgress;
                const dir = Categories.transitionDirection;

                let incomingX = panel.x + (dir === 1 ? panel.width * (1 - progress) : -panel.width * (1 - progress));
                drawSingleCategory(Categories.selected, incomingX, true);
                if (Categories.selected === 'Modules') {
                    SearchBar.draw(mouseX, mouseY, { ...panel, x: incomingX }, panel.y + 11 - currentRightPanelScrollY);
                    SearchBar.updateHoverBlock({ ...panel, x: incomingX }, panel.y + 11 - currentRightPanelScrollY);
                }
                let outgoingX = panel.x + (dir === 1 ? -panel.width * progress : panel.width * progress);
                drawSingleCategory(Categories.previousSelected, outgoingX, false);
                if (Categories.previousSelected === 'Modules') {
                    SearchBar.draw(mouseX, mouseY, { ...panel, x: outgoingX }, panel.y + 11 - currentRightPanelScrollY);
                    SearchBar.updateHoverBlock({ ...panel, x: outgoingX }, panel.y + 11 - currentRightPanelScrollY);
                }
            } else {
                let panelX = panel.x;
                if (transitionActive && Categories.transitionType === 'page') {
                    if (Categories.transitionDirection === 1) panelX -= panel.width * Categories.transitionProgress;
                    else if (Categories.transitionDirection === -1) panelX -= panel.width * (1 - Categories.transitionProgress);
                }

                drawSingleCategory(Categories.selected, panelX, true);
                if (Categories.selected === 'Modules') {
                    SearchBar.draw(mouseX, mouseY, { ...panel, x: panelX }, panel.y + 11 - currentRightPanelScrollY);
                    SearchBar.updateHoverBlock({ ...panel, x: panelX }, panel.y + 11 - currentRightPanelScrollY);
                }
                if (!isLayoutCacheValid && !transitionActive) isLayoutCacheValid = true;
            }
        }

        if (shouldDrawOptions) drawOptionsPanel(panel, mouseX, mouseY);
        resetScissor();
    };

    const handleClick = (mouseX, mouseY) => {
        const panel = deps.rectangles.RightPanel;
        if (SearchBar.handleClick(mouseX, mouseY, panel, panel.y + 11)) {
            isLayoutCacheValid = false;
            isContentHeightCacheValid = false;
            resetCategoryScroll();
            return;
        }

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
            deps.rectangles.RightPanel,
            cachedContentHeight,
            targetRightPanelScrollY,
            setTargetRightPanelScrollY,
            targetOptionsScrollY,
            setTargetOptionsScrollY,
            calculateOptionsContentHeight()
        );
        isLayoutCacheValid = false;
    };

    const handleMouseDrag = (mouseX, mouseY) => {
        isLayoutCacheValid = false;
        const activeCat = Categories.categories.find((c) => c.name === Categories.selected);
        const components = Categories.currentPage === 'categories' ? activeCat?.directComponents : Categories.selectedItem?.components;
        components?.forEach((c) => {
            if (typeof c.handleMouseDrag === 'function') {
                c.optionPanelWidth = deps.rectangles.RightPanel.width;
                c.handleMouseDrag(mouseX, mouseY);
            }
        });
    };

    const handleMouseRelease = () => {
        const activeCat = Categories.categories.find((c) => c.name === Categories.selected);
        const components = Categories.currentPage === 'categories' ? activeCat?.directComponents : Categories.selectedItem?.components;
        components?.forEach((c) => {
            if (typeof c.handleMouseRelease === 'function') c.handleMouseRelease();
        });
    };

    return {
        draw,
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
};

export const categoryManager = createCategoriesManager({
    rectangles: GuiRectangles,
    draw: { drawRoundedRectangle, drawRoundedRectangleWithBorder },
    utils: {},
    colors: {},
});
