import { Popup } from '../components/Popup';
import { GuiRectangles } from '../core/GuiState';
import { OverlayManager } from '../OverlayUtils';
import { easeInOutQuad, FontSizes, getTextWidth, isInside, PADDING, playClickSound, SUBCATEGORY_BUTTON_HEIGHT, SUBCATEGORY_BUTTON_SPACING } from '../Utils';
import { SearchBar } from './CategorySearchBar';
import { Categories } from './CategorySystem';

const ANIMATION_DURATION = 300;
const ICON_SIZE = 28;
const HIGHLIGHT_PADDING = 2;
const HIGHLIGHT_SIZE = ICON_SIZE + HIGHLIGHT_PADDING * 2;

export const handleDirectComponentsClick = (mouseX, mouseY, panel, scrollY, categoryName) => {
    const directCat = Categories.categories.find((c) => c.name === categoryName);
    if (!directCat || !directCat.directComponents) return false;

    const components = directCat.directComponents;
    const panelX = panel.x;
    const panelWidth = panel.width;

    let currentY = panel.y + PADDING - scrollY;
    let currentSection = null;

    for (let i = 0; i < components.length; i++) {
        const component = components[i];

        if (component.sectionName && component.sectionName !== currentSection) {
            currentSection = component.sectionName;
            if (i > 0) currentY += 16;
            currentY += 26;
        }

        if (component instanceof Popup && typeof component.handleButtonClick === 'function') {
            let componentHeight = 48;
            let expansionHeight = 0;
            if (typeof component.getExpandedHeight === 'function' && component.animationProgress !== undefined) {
                expansionHeight = component.getExpandedHeight() * component.animationProgress;
            }
            componentHeight += expansionHeight;

            const clickableArea = {
                x: panelX + PADDING,
                y: currentY,
                width: panelWidth - 2 * PADDING,
                height: componentHeight,
            };

            if (isInside(mouseX, mouseY, clickableArea)) {
                component.x = panelX + PADDING + 10;
                component.y = currentY;
                component.optionPanelWidth = panelWidth;
                component.optionPanelHeight = panel.height;

                if (component.handleButtonClick(mouseX, mouseY)) {
                    return true;
                }
            }

            currentY += 48 + 6 + expansionHeight;
            continue;
        }

        if (typeof component.handleClick !== 'function') {
            currentY += 54;
            continue;
        }

        let componentHeight = 48;
        let expansionHeight = 0;
        if (typeof component.getExpandedHeight === 'function' && component.animationProgress !== undefined) {
            expansionHeight = component.getExpandedHeight() * component.animationProgress;
        }
        componentHeight += expansionHeight;

        const clickableArea = {
            x: panelX + PADDING,
            y: currentY,
            width: panelWidth - 2 * PADDING,
            height: componentHeight,
        };

        if (isInside(mouseX, mouseY, clickableArea)) {
            component.x = panelX + PADDING + 10;
            component.y = currentY;
            component.optionPanelWidth = panelWidth;
            component.optionPanelHeight = panel.height;

            if (component.handleClick(mouseX, mouseY)) {
                return true;
            }
        }

        currentY += 48 + 6 + expansionHeight;
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
    const query = SearchBar.query.trim().toLowerCase();

    if (Categories.transitionDirection !== 0) return;

    const leftPanel = GuiRectangles.LeftPanel;
    const pfpSize = 28;
    const pfpY = leftPanel.y + leftPanel.height - pfpSize - PADDING;
    const editIconSize = 16;
    const editIconX = leftPanel.x + (leftPanel.width - editIconSize) / 2;
    const editIconY = pfpY - editIconSize - 15;

    const editButtonRect = {
        x: editIconX - 6,
        y: editIconY - 6,
        width: editIconSize + 12,
        height: editIconSize + 12,
    };

    if (Categories.currentPage === 'categories') {
        const directCat = Categories.categories.find((c) => c.name === Categories.selected);
        if (directCat?.directComponents && isInside(mouseX, mouseY, panel)) {
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
        if (isInside(mouseX, mouseY, backButtonRect)) {
            Categories.transitionType = 'page';
            Categories.transitionDirection = -1;
            Categories.transitionProgress = 0;
            Categories.transitionStart = Date.now();
            playClickSound();
            return;
        }

        const components = Categories.selectedItem.components;
        let currentCompY = optionY + 78;
        let currentDrawnCompY = currentCompY - sY;

        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (component instanceof Popup && typeof component.handleButtonClick === 'function') {
                const drawnCompY = currentDrawnCompY;
                let handled = false;

                component.x = optionX + 10;

                let componentHeight = 48;
                let expansionHeight = 0;

                if (typeof component.getExpandedHeight === 'function') {
                    expansionHeight =
                        component.animationProgress !== undefined ? component.getExpandedHeight() * component.animationProgress : component.getExpandedHeight();
                }
                componentHeight += expansionHeight;

                let clickableArea = {
                    x: optionX,
                    y: drawnCompY,
                    width: panel.width - 2 * PADDING,
                    height: componentHeight,
                };

                if (isInside(mouseX, mouseY, clickableArea)) {
                    component.y = drawnCompY;
                    component.optionPanelWidth = panel.width;
                    component.optionPanelHeight = panel.height;

                    if (component.handleButtonClick(mouseX, mouseY)) {
                        handled = true;
                    }
                }

                if (handled) return;

                let spacingHeight = 54 + expansionHeight;
                currentCompY += spacingHeight;
                currentDrawnCompY += spacingHeight;
                continue;
            }

            if (typeof component.handleClick !== 'function') continue;

            const drawnCompY = currentDrawnCompY;
            let handled = false;

            component.x = optionX + 10;

            let componentHeight = 48;
            let expansionHeight = 0;

            if (typeof component.getExpandedHeight === 'function') {
                expansionHeight =
                    component.animationProgress !== undefined ? component.getExpandedHeight() * component.animationProgress : component.getExpandedHeight();
            }
            componentHeight += expansionHeight;

            let clickableArea = {
                x: optionX,
                y: drawnCompY,
                width: panel.width - 2 * PADDING,
                height: componentHeight,
            };

            if (isInside(mouseX, mouseY, clickableArea)) {
                component.y = drawnCompY;
                component.optionPanelWidth = panel.width;
                component.optionPanelHeight = panel.height;

                if (component.handleClick(mouseX, mouseY)) {
                    handled = true;
                }
            }

            if (handled) return;

            let spacingHeight = 54 + expansionHeight;
            currentCompY += spacingHeight;
            currentDrawnCompY += spacingHeight;
        }
    }

    let clickedCategoryName = null;
    let clickedIndex = -1;

    if (isInside(mouseX, mouseY, leftPanel)) {
        if (isInside(mouseX, mouseY, editButtonRect)) {
            playClickSound();
            OverlayManager.openPositionsGUI();
            return;
        } else {
            Categories.categories.some((cat, i) => {
                const rect = getCategoryRect(i);
                if (isInside(mouseX, mouseY, rect)) {
                    clickedCategoryName = cat.name;
                    clickedIndex = i;
                    return true;
                }
                return false;
            });
        }

        if (clickedCategoryName && clickedCategoryName !== Categories.selected) {
            const oldIndex = Categories.categories.findIndex((c) => c.name === Categories.selected);
            let oldRect = Categories.selected === 'Edit' || oldIndex === -1 ? editButtonRect : getCategoryRect(oldIndex);
            const newRect = getCategoryRect(clickedIndex);

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
            Categories.previousSelected = Categories.selected;
            Categories.selected = clickedCategoryName;
            Categories.currentPage = 'categories';
            Categories.selectedItem = null;
            Categories.selectedSubcategory = null;
            invalidateContentHeightCache();
            invalidateLayoutCache();
            resetCategoryScroll();
            Categories.transitionType = 'category-swap';
            Categories.transitionDirection = clickedIndex > oldIndex ? 1 : -1;
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

    if (Categories.selected && Categories.currentPage === 'categories' && isInside(mouseX, mouseY, panel)) {
        const cat = Categories.categories.find((c) => c.name === Categories.selected);
        if (cat && Categories.selected !== 'Settings' && Categories.selected !== 'Theme') {
            if (cat.subcategories.length > 0 && !SearchBar.isHoverBlocked(mouseX, mouseY)) {
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

    if (Categories.currentPage === 'options' && !isInside(mouseX, mouseY, GuiRectangles.RightPanel) && !isInside(mouseX, mouseY, leftPanel)) {
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
    const SCROLL_SPEED = 15;

    if (Categories.currentPage === 'categories') {
        const directCat = Categories.categories.find((c) => c.name === Categories.selected);
        if (directCat?.directComponents && isInside(mouseX, mouseY, panel)) {
            const openPopup = directCat.directComponents.find((component) => component instanceof Popup && component.isOpen);
            if (openPopup && typeof openPopup.handleScroll === 'function') {
                openPopup.optionPanelWidth = panel.width;
                if (openPopup.handleScroll(mouseX, mouseY, dir)) return;
            }

            let scrollHandled = false;
            const components = directCat.directComponents;
            let componentY = panel.y + PADDING;

            components.forEach((component) => {
                let compHeight = 54;
                if (typeof component.getExpandedHeight === 'function' && component.animationProgress !== undefined) {
                    compHeight += component.getExpandedHeight() * component.animationProgress;
                }
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
        const openPopup = components?.find((component) => component instanceof Popup && component.isOpen);
        if (openPopup && typeof openPopup.handleScroll === 'function') {
            openPopup.optionPanelWidth = panel.width;
            if (openPopup.handleScroll(mouseX, mouseY, dir)) return;
        }

        let scrollHandled = false;
        let componentY = optionY + 78;
        if (components) {
            components.forEach((component) => {
                let expansionHeight = 0;
                if (typeof component.getExpandedHeight === 'function') {
                    expansionHeight =
                        component.animationProgress !== undefined ? component.getExpandedHeight() * component.animationProgress : component.getExpandedHeight();
                }
                let compHeight = 54 + expansionHeight;
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

        if (!scrollHandled && isInside(mouseX, mouseY, panel)) {
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
