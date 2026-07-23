import { Popup } from '../components/Popup';
import { getComponentHitRect, getComponentLayoutHeight, isComponentVisible, layoutDirectComponents } from '../components/layout';
import { GuiRectangles } from '../core/GuiState';
import { OverlayManager } from '../OverlayUtils';
import { easeInOutQuad, FontSizes, getTextWidth, isInside, PADDING, playClickSound, SUBCATEGORY_BUTTON_HEIGHT, SUBCATEGORY_BUTTON_SPACING } from '../Utils';
import { getCategoryRect, getDiscordPfpRect } from './CategoryRenderer';
import { SearchBar } from './CategorySearchBar';
import { Categories } from './CategorySystem';

const ANIMATION_DURATION = 300;
const ICON_SIZE = 28;
const HIGHLIGHT_PADDING = 2;
const HIGHLIGHT_SIZE = ICON_SIZE + HIGHLIGHT_PADDING * 2;

const getEditButtonRect = () => {
    const leftPanel = GuiRectangles.LeftPanel;
    const pfpRect = getDiscordPfpRect();
    const editIconSize = 16;
    const editIconX = leftPanel.x + (leftPanel.width - editIconSize) / 2;
    const editIconY = pfpRect.y - editIconSize - 15;
    return {
        x: editIconX - 6,
        y: editIconY - 6,
        width: editIconSize + 12,
        height: editIconSize + 12,
    };
};

const getCategorySelectionRect = (name) => {
    if (name === 'Discord') {
        const pfpRect = getDiscordPfpRect();
        return { x: pfpRect.x - 2, y: pfpRect.y - 2, width: pfpRect.width + 4, height: pfpRect.height + 4, radius: 16 };
    }
    if (name === 'Edit') return { ...getEditButtonRect(), radius: 8 };
    const visibleIndex = Categories.getVisibleCategories().findIndex((category) => category.name === name);
    if (visibleIndex === -1) return getEditButtonRect();
    const rect = getCategoryRect(visibleIndex);
    return {
        x: rect.x + (rect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING,
        y: rect.y + (rect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING,
        width: HIGHLIGHT_SIZE,
        height: HIGHLIGHT_SIZE,
        radius: 8,
    };
};

export const handleDirectComponentsClick = (mouseX, mouseY, panel, scrollY, categoryName) => {
    const directCat = Categories.categories.find((c) => c.name === categoryName);
    if (!directCat || !directCat.directComponents) return false;

    for (const row of layoutDirectComponents(directCat.directComponents, panel.y + PADDING - scrollY).rows) {
        const component = row.component;

        if (component instanceof Popup && typeof component.handleButtonClick === 'function') {
            const clickableArea = getComponentHitRect(panel, row.y, row.height, PADDING);

            if (isInside(mouseX, mouseY, clickableArea)) {
                component.x = panel.x + PADDING + 10;
                component.y = row.y;
                component.optionPanelWidth = panel.width;
                component.optionPanelHeight = panel.height;

                if (component.handleButtonClick(mouseX, mouseY)) {
                    return true;
                }
            }

            continue;
        }

        if (typeof component.handleClick !== 'function') {
            continue;
        }

        const clickableArea = getComponentHitRect(panel, row.y, row.height, PADDING);

        if (isInside(mouseX, mouseY, clickableArea)) {
            component.x = panel.x + PADDING + 10;
            component.y = row.y;
            component.optionPanelWidth = panel.width;
            component.optionPanelHeight = panel.height;

            if (component.handleClick(mouseX, mouseY)) {
                return true;
            }
        }
    }

    return false;
};

export const handleCategoryClick = (
    mouseX,
    mouseY,
    panel,
    scrollY,
    cachedItemLayouts,
    getCategoryRect,
    invalidateLayoutCache,
    invalidateContentHeightCache,
    resetCategoryScroll
) => {
    if (Categories.transitionDirection !== 0) return;

    const isInsidePanel = isInside(mouseX, mouseY, panel);
    const leftPanel = GuiRectangles.LeftPanel;
    const editButtonRect = getEditButtonRect();
    const pfpRect = getDiscordPfpRect();
    const pfpButtonRect = { x: pfpRect.x - 2, y: pfpRect.y - 2, width: pfpRect.width + 4, height: pfpRect.height + 4 };

    if (Categories.currentPage === 'categories') {
        const directCat = Categories.categories.find((c) => c.name === Categories.selected);
        if (directCat?.directComponents && isInsidePanel) {
            if (handleDirectComponentsClick(mouseX, mouseY, panel, scrollY, Categories.selected)) {
                return;
            }
        }
    }

    if (Categories.currentPage === 'options' && Categories.selectedItem) {
        if (isInside(mouseX, mouseY, editButtonRect)) {
            playClickSound();
            OverlayManager.openPositionsGUI();
            return;
        }

        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;
        const sY = Categories.optionsScrollY;

        const backButtonText = 'Back';
        const backButtonWidth = getTextWidth(backButtonText, FontSizes.SMALL);
        const drawnBackY = optionY + 12 - sY;
        const backButtonRect = {
            x: optionX + 10,
            y: drawnBackY,
            width: backButtonWidth,
            height: 10,
        };
        if (isInsidePanel && isInside(mouseX, mouseY, backButtonRect)) {
            if (Categories.optionsReturnCategory && Categories.optionsReturnCategory !== Categories.selected) {
                const oldRect = getCategorySelectionRect(Categories.selected);
                const newRect = getCategorySelectionRect(Categories.optionsReturnCategory);
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
            Categories.transitionType = 'page';
            Categories.transitionDirection = -1;
            Categories.transitionProgress = 0;
            Categories.transitionStart = Date.now();
            playClickSound();
            return;
        }

        const components = Categories.selectedItem.components;
        let currentDrawnCompY = optionY + 78 - sY;

        for (const component of components) {
            if (!isComponentVisible(component)) continue;
            if (component instanceof Popup && typeof component.handleButtonClick === 'function') {
                const drawnCompY = currentDrawnCompY;
                let handled = false;

                component.x = optionX + 10;

                const componentHeight = getComponentLayoutHeight(component, true);

                const clickableArea = {
                    x: optionX,
                    y: drawnCompY,
                    width: panel.width - 2 * PADDING,
                    height: componentHeight,
                };

                if (isInsidePanel && isInside(mouseX, mouseY, clickableArea)) {
                    component.y = drawnCompY;
                    component.optionPanelWidth = panel.width;
                    component.optionPanelHeight = panel.height;

                    if (component.handleButtonClick(mouseX, mouseY)) {
                        handled = true;
                    }
                }

                if (handled) return;

                currentDrawnCompY += componentHeight;
                continue;
            }

            if (typeof component.handleClick !== 'function') {
                currentDrawnCompY += getComponentLayoutHeight(component, true);
                continue;
            }

            const drawnCompY = currentDrawnCompY;
            let handled = false;

            component.x = optionX + 10;

            const componentHeight = getComponentLayoutHeight(component, true);

            const clickableArea = {
                x: optionX,
                y: drawnCompY,
                width: panel.width - 2 * PADDING,
                height: componentHeight,
            };

            if (isInsidePanel && isInside(mouseX, mouseY, clickableArea)) {
                component.y = drawnCompY;
                component.optionPanelWidth = panel.width;
                component.optionPanelHeight = panel.height;

                if (component.handleClick(mouseX, mouseY)) {
                    handled = true;
                }
            }

            if (handled) return;

            currentDrawnCompY += getComponentLayoutHeight(component, true);
        }
    }

    let clickedCategoryName = null;

    if (isInside(mouseX, mouseY, leftPanel)) {
        if (isInside(mouseX, mouseY, editButtonRect)) {
            playClickSound();
            OverlayManager.openPositionsGUI();
            return;
        } else {
            const clickedCategory = Categories.getVisibleCategories().find((cat, i) => {
                const rect = getCategoryRect(i);
                return isInside(mouseX, mouseY, rect);
            });
            clickedCategoryName = clickedCategory?.name || null;
            if (!clickedCategoryName && isInside(mouseX, mouseY, pfpButtonRect)) {
                clickedCategoryName = 'Discord';
            }
        }

        if (clickedCategoryName && clickedCategoryName !== Categories.selected) {
            Categories.optionsReturnCategory = null;
            if (clickedCategoryName !== 'Modules') {
                SearchBar.resetSearch();
            }
            const oldRect = getCategorySelectionRect(Categories.selected);
            const newRect = getCategorySelectionRect(clickedCategoryName);
            const oldMidY = oldRect.y + oldRect.height / 2;
            const newMidY = newRect.y + newRect.height / 2;

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
            Categories.previousSelected = Categories.selected;
            Categories.selected = clickedCategoryName;
            Categories.currentPage = 'categories';
            Categories.selectedItem = null;
            Categories.selectedSubcategory = null;
            invalidateContentHeightCache();
            invalidateLayoutCache();
            resetCategoryScroll();
            Categories.transitionType = 'category-swap';
            Categories.transitionDirection = newMidY >= oldMidY ? 1 : -1;
            Categories.transitionProgress = 0;
            Categories.transitionStart = Date.now();
            playClickSound();
            return;
        } else if (clickedCategoryName && clickedCategoryName === Categories.selected && Categories.currentPage === 'options') {
            Categories.transitionType = 'page';
            Categories.transitionDirection = -1;
            Categories.transitionProgress = 0;
            Categories.transitionStart = Date.now();
            playClickSound();
            return;
        }
    }

    if (Categories.selected && Categories.currentPage === 'categories' && isInsidePanel) {
        const cat = Categories.categories.find((c) => c.name === Categories.selected);
        if (cat && Categories.selected !== 'Settings' && Categories.selected !== 'Theme') {
            if (cat.subcategories.length > 0 && SearchBar.query.trim().length === 0 && !SearchBar.isHoverBlocked(mouseX, mouseY)) {
                let currentX = panel.x + PADDING;
                let yOffset = panel.y + PADDING - scrollY;
                const subcategoriesToDraw = ['All', ...cat.subcategories];

                for (const subcat of subcategoriesToDraw) {
                    const buttonTextWidth = getTextWidth(subcat, FontSizes.MEDIUM) + 20;
                    const buttonRect = {
                        x: currentX,
                        y: yOffset,
                        width: buttonTextWidth,
                        height: SUBCATEGORY_BUTTON_HEIGHT,
                    };
                    if (isInside(mouseX, mouseY, buttonRect)) {
                        const newSubcatName = subcat === 'All' ? null : subcat;
                        if (Categories.selectedSubcategory !== newSubcatName) {
                            const oldRect = Categories.selectedSubcategoryButton || buttonRect;
                            Categories.selectedSubcategory = newSubcatName;
                            invalidateContentHeightCache();
                            invalidateLayoutCache();
                            Categories.subcatTransitionStart = Date.now();
                            Categories.subcatTransitionProgress = 0;
                            Categories.animationRect = {
                                startX: oldRect.x,
                                startY: oldRect.y,
                                startWidth: oldRect.width,
                                startHeight: oldRect.height,
                                endX: buttonRect.x,
                                endY: buttonRect.y,
                                endWidth: buttonRect.width,
                                endHeight: buttonRect.height,
                                x: oldRect.x,
                                y: oldRect.y,
                                width: oldRect.width,
                                height: oldRect.height,
                            };
                            Categories.selectedSubcategoryButton = buttonRect;
                            resetCategoryScroll();
                        }
                        playClickSound();
                        return;
                    }
                    currentX += buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
                }
            }

            for (const layout of cachedItemLayouts) {
                if (isInside(mouseX, mouseY, layout.rect)) {
                    Categories.optionsReturnCategory = null;
                    Categories.transitionType = 'page';
                    Categories.transitionDirection = 1;
                    Categories.transitionProgress = 0;
                    Categories.transitionStart = Date.now();
                    Categories.selectedItem = layout.item;
                    playClickSound();
                    return;
                }
            }
        }
    }

    if (Categories.currentPage === 'options' && !isInsidePanel && !isInside(mouseX, mouseY, leftPanel)) {
        if (Categories.optionsReturnCategory && Categories.optionsReturnCategory !== Categories.selected) {
            const oldRect = getCategorySelectionRect(Categories.selected);
            const newRect = getCategorySelectionRect(Categories.optionsReturnCategory);
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
        Categories.transitionType = 'page';
        Categories.transitionDirection = -1;
        Categories.transitionProgress = 0;
        Categories.transitionStart = Date.now();
    }
};

export const handleCategoryScroll = (
    mouseX,
    mouseY,
    dir,
    panel,
    cachedContentHeight,
    rightPanelScrollY,
    setRightPanelScrollY,
    optionsScrollY,
    setOptionsScrollY,
    optionsContentHeight
) => {
    const SCROLL_SPEED = Math.max(1, Number(Categories.guiScrollSpeed) || 15) * 2.5;

    if (Categories.currentPage === 'categories') {
        const directCat = Categories.categories.find((c) => c.name === Categories.selected);
        if (directCat?.directComponents && isInside(mouseX, mouseY, panel)) {
            const openPopup = directCat.directComponents.find((component) => isComponentVisible(component) && component instanceof Popup && component.isOpen);
            if (openPopup && typeof openPopup.handleScroll === 'function') {
                openPopup.optionPanelWidth = panel.width;
                openPopup.handleScroll(mouseX, mouseY, dir);
                return;
            }

            let scrollHandled = false;
            const components = directCat.directComponents;
            let componentY = panel.y + PADDING;
            let currentSection = null;

            components.filter(isComponentVisible).forEach((component, index) => {
                if (component.sectionName && component.sectionName !== currentSection) {
                    currentSection = component.sectionName;
                    if (index > 0) componentY += 16;
                    componentY += 26;
                }

                const compHeight = getComponentLayoutHeight(component);
                const compRect = {
                    x: panel.x + PADDING + 10,
                    y: componentY - rightPanelScrollY,
                    width: panel.width - PADDING * 2 - 20,
                    height: compHeight,
                };
                if (isInside(mouseX, mouseY, compRect) && typeof component.handleScroll === 'function') {
                    component.optionPanelWidth = panel.width;
                    if (component.handleScroll(mouseX, mouseY, dir)) scrollHandled = true;
                }
                componentY += compHeight;
            });

            if (!scrollHandled) {
                const maxScroll = Math.max(0, cachedContentHeight - panel.height + PADDING);
                const newScroll = rightPanelScrollY + (dir > 0 ? -1 : 1) * SCROLL_SPEED;
                setRightPanelScrollY(Math.max(0, Math.min(newScroll, maxScroll)));
            }
            return;
        }
    }

    if (Categories.currentPage === 'options' && Categories.selectedItem) {
        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;
        const components = Categories.selectedItem.components;
        const openPopup = components?.find((component) => isComponentVisible(component) && component instanceof Popup && component.isOpen);
        if (openPopup && typeof openPopup.handleScroll === 'function') {
            openPopup.optionPanelWidth = panel.width;
            openPopup.handleScroll(mouseX, mouseY, dir);
            return;
        }
        if (!isInside(mouseX, mouseY, panel)) return;

        let scrollHandled = false;
        let componentY = optionY + 78;
        if (components) {
            components.forEach((component) => {
                if (!isComponentVisible(component)) return;
                const compHeight = getComponentLayoutHeight(component, true);
                const compRect = {
                    x: optionX + 10,
                    y: componentY - Categories.optionsScrollY,
                    width: panel.width - PADDING * 2 - 20,
                    height: compHeight,
                };
                if (isInside(mouseX, mouseY, compRect) && typeof component.handleScroll === 'function') {
                    component.optionPanelWidth = panel.width;
                    if (component.handleScroll(mouseX, mouseY, dir)) scrollHandled = true;
                }
                componentY += compHeight;
            });
        }

        if (!scrollHandled) {
            const maxScroll = Math.max(0, optionsContentHeight - panel.height);
            const newScroll = optionsScrollY + (dir > 0 ? -1 : 1) * SCROLL_SPEED;
            setOptionsScrollY(Math.max(0, Math.min(newScroll, maxScroll)));
        }
        return;
    }

    if (Categories.currentPage !== 'categories' || Categories.transitionDirection !== 0) return;
    if (!Categories.selected || !isInside(mouseX, mouseY, panel) || cachedContentHeight <= 0) return;

    const maxScroll = Math.max(0, cachedContentHeight - panel.height + PADDING);
    const newScroll = rightPanelScrollY + (dir > 0 ? -1 : 1) * SCROLL_SPEED;
    setRightPanelScrollY(Math.max(0, Math.min(newScroll, maxScroll)));
};

export const updateCategoryTransitions = () => {
    if (Categories.transitionDirection !== 0) {
        const elapsed = Date.now() - Categories.transitionStart;
        const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);
        Categories.transitionProgress = easeInOutQuad(rawProgress);

        if (rawProgress >= 1) {
            if (Categories.transitionType === 'page') {
                Categories.currentPage = Categories.transitionDirection === 1 ? 'options' : 'categories';
            } else {
                Categories.currentPage = 'categories';
            }
            if (Categories.currentPage === 'categories') {
                if (Categories.transitionType === 'page' && Categories.transitionDirection === -1 && Categories.optionsReturnCategory) {
                    Categories.selected = Categories.optionsReturnCategory;
                    Categories.optionsReturnCategory = null;
                }
                Categories.selectedItem = null;
                Categories.optionsScrollY = 0;
            }
            if (Categories.currentPage === 'options') Categories.optionsScrollY = 0;
            Categories.transitionDirection = 0;
            Categories.transitionProgress = 1;
            Categories.previousSelected = null;
            Categories.transitionType = null;
            return true;
        }
        return true;
    }
    return false;
};
