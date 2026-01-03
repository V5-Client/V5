import { OverlayManager } from '../OverlayUtils';
import { isInside, playClickSound, easeInOutQuad, PADDING, SUBCATEGORY_BUTTON_HEIGHT, SUBCATEGORY_BUTTON_SPACING, getTextWidth, FontSizes } from '../Utils';
import { MultiToggle } from '../components/Dropdown';
import { Categories } from './CategorySystem';
import { GuiRectangles } from '../core/GuiState';

const ANIMATION_DURATION = 300;
const ICON_SIZE = 28;
const HIGHLIGHT_PADDING = 2;
const HIGHLIGHT_SIZE = ICON_SIZE + HIGHLIGHT_PADDING * 2;

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

    if (Categories.currentPage === 'options' && Categories.selectedItem) {
        if (isInside(mouseX, mouseY, editButtonRect)) {
            playClickSound();
            OverlayManager.openPositionsGUI();
            return;
        }

        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;
        const scrollY = Categories.optionsScrollY;

        const backButtonText = 'Back';
        const backButtonWidth = getTextWidth(backButtonText, FontSizes.SMALL);
        const drawnBackY = optionY + 12 - scrollY;
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
        let currentDrawnCompY = currentCompY - scrollY;

        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (typeof component.handleClick !== 'function') continue;

            const drawnCompY = currentDrawnCompY;
            let handled = false;

            component.x = optionX + 10;
            if (component instanceof MultiToggle) {
                component.y = drawnCompY;
                component.optionPanelWidth = panel.width;
                component.optionPanelHeight = panel.height;
                if (component.handleClick(mouseX, mouseY)) {
                    handled = true;
                }
            } else {
                let componentHeight = 48;
                let clickableArea = {
                    x: optionX,
                    y: drawnCompY,
                    width: panel.width - 2 * PADDING - 20,
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
            }

            if (handled) return;

            let thisHeight = 54;
            if (component instanceof MultiToggle && component.animationProgress > 0) {
                thisHeight += component.getExpandedHeight() * component.animationProgress;
            }
            currentCompY += thisHeight;
            currentDrawnCompY += thisHeight;
        }

        if (isInside(mouseX, mouseY, leftPanel)) {
            let clickedCategoryName = null;
            let clickedIndex = -1;

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
                let oldRect;

                if (Categories.selected === 'Edit') {
                    oldRect = editButtonRect;
                } else {
                    oldRect = oldIndex === -1 ? editButtonRect : getCategoryRect(oldIndex);
                }

                const newRect = getCategoryRect(clickedIndex);

                const oldIconX = oldRect.x + (oldRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const oldIconY = oldRect.y + (oldRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const newIconX = newRect.x + (newRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const newIconY = newRect.y + (newRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;

                Categories.catAnimationRect = {
                    startX: oldIconX,
                    startY: oldIconY,
                    endX: newIconX,
                    endY: newIconY,
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
            }

            Categories.transitionType = 'page';
            Categories.transitionDirection = -1;
            Categories.transitionProgress = 0;
            Categories.transitionStart = Date.now();
            return;
        }

        if (!isInside(mouseX, mouseY, GuiRectangles.RightPanel)) {
            Categories.transitionType = 'page';
            Categories.transitionDirection = -1;
            Categories.transitionProgress = 0;
            Categories.transitionStart = Date.now();
        }
    } else {
        let clickedCategoryName = null;
        let clickedIndex = -1;

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

        if (clickedCategoryName) {
            if (clickedCategoryName !== Categories.selected) {
                const oldIndex = Categories.categories.findIndex((c) => c.name === Categories.selected);
                let oldRect;

                if (Categories.selected === 'Edit') {
                    oldRect = editButtonRect;
                } else {
                    oldRect = oldIndex === -1 ? editButtonRect : getCategoryRect(oldIndex);
                }

                const newRect = getCategoryRect(clickedIndex);

                const oldIconX = oldRect.x + (oldRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const oldIconY = oldRect.y + (oldRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const newIconX = newRect.x + (newRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const newIconY = newRect.y + (newRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;

                Categories.catAnimationRect = {
                    startX: oldIconX,
                    startY: oldIconY,
                    endX: newIconX,
                    endY: newIconY,
                    width: HIGHLIGHT_SIZE,
                    height: HIGHLIGHT_SIZE,
                    radius: 8,
                };
                Categories.catTransitionStart = Date.now();

                Categories.transitionType = 'category-swap';
                Categories.transitionDirection = clickedIndex > oldIndex ? 1 : -1;
                Categories.previousSelected = Categories.selected;
                Categories.selected = clickedCategoryName;
                Categories.currentPage = 'categories';
                Categories.selectedItem = null;
                Categories.selectedSubcategory = null;

                Categories.transitionProgress = 0;
                Categories.transitionStart = Date.now();

                invalidateContentHeightCache();
                invalidateLayoutCache();
                resetCategoryScroll();
                playClickSound();
            }
            return;
        }


        if (Categories.selected && Categories.currentPage === 'categories') {
            const cat = Categories.categories.find((c) => c.name === Categories.selected);
            if (!cat) return;

            if (cat.subcategories.length > 0) {
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

    if (Categories.currentPage === 'options' && Categories.selectedItem) {
        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;

        let scrollHandled = false;
        let componentY = optionY + 78;
        const components = Categories.selectedItem.components;
        if (components) {
            components.forEach((component) => {
                let compHeight = 54;
                if (component instanceof MultiToggle) {
                    compHeight += component.getExpandedHeight() * component.animationProgress;
                }
                const compRect = {
                    x: optionX + 10,
                    y: componentY - Categories.optionsScrollY,
                    width: panel.width - PADDING * 2 - 20,
                    height: compHeight,
                };
                if (isInside(mouseX, mouseY, compRect) && typeof component.handleScroll === 'function') {
                    component.optionPanelWidth = panel.width;
                    if (component.handleScroll(mouseX, mouseY, dir)) {
                        scrollHandled = true;
                    }
                }
                componentY += compHeight;
            });
        }

        if (!scrollHandled && isInside(mouseX, mouseY, panel)) {
            const availableHeight = panel.height;
            const maxScroll = Math.max(0, optionsContentHeight - availableHeight);
            const direction = dir > 0 ? -1 : 1;

            const newScroll = optionsScrollY + direction * SCROLL_SPEED;
            setOptionsScrollY(Math.max(0, Math.min(newScroll, maxScroll)));
        }

        return;
    }
    if (Categories.currentPage !== 'categories' || Categories.transitionDirection !== 0) return;

    if (!Categories.selected || !isInside(mouseX, mouseY, panel)) {
        return;
    }

    if (cachedContentHeight <= 0) {
        return;
    }

    const maxScroll = Math.max(0, cachedContentHeight - panel.height + PADDING);
    const direction = dir > 0 ? -1 : 1;
    const newScroll = rightPanelScrollY + direction * SCROLL_SPEED;
    setRightPanelScrollY(Math.max(0, Math.min(newScroll, maxScroll)));
};

export const updateCategoryTransitions = () => {
    if (Categories.transitionDirection !== 0) {
        const elapsed = Date.now() - Categories.transitionStart;
        const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);
        Categories.transitionProgress = easeInOutQuad(rawProgress);

        if (rawProgress >= 1) {
            if (Categories.transitionType === 'page') {
                const newPage = Categories.transitionDirection === 1 ? 'options' : 'categories';
                Categories.currentPage = newPage;
            } else {
                Categories.currentPage = 'categories';
            }

            if (Categories.currentPage === 'categories') {
                Categories.selectedItem = null;
                Categories.optionsScrollY = 0;
            }
            if (Categories.currentPage === 'options') {
                Categories.optionsScrollY = 0;
            }
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
