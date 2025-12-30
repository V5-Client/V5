import { OverlayManager } from '../OverlayUtils';
import { isInside, playClickSound, easeInOutQuad, PADDING, SUBCATEGORY_BUTTON_HEIGHT, SUBCATEGORY_BUTTON_SPACING, getTextWidth, FontSizes } from '../Utils';
import { MultiToggle } from '../components/Dropdown';

const ANIMATION_DURATION = 300;
const ICON_SIZE = 28;
const HIGHLIGHT_PADDING = 2;
const HIGHLIGHT_SIZE = ICON_SIZE + HIGHLIGHT_PADDING * 2;

export const handleCategoryClick = (
    mouseX,
    mouseY,
    panel,
    cachedItemLayouts,
    getCategoryRect,
    invalidateLayoutCache,
    invalidateContentHeightCache,
    resetCategoryScroll
) => {
    if (global.Categories.transitionDirection !== 0) return;

    const leftPanel = global.GuiRectangles.LeftPanel;
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

    if (global.Categories.currentPage === 'options' && global.Categories.selectedItem) {
        if (isInside(mouseX, mouseY, editButtonRect)) {
            playClickSound();
            OverlayManager.openPositionsGUI();
            return;
        }

        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;
        const scrollY = global.Categories.optionsScrollY;

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
            global.Categories.transitionDirection = -1;
            global.Categories.transitionProgress = 0;
            global.Categories.transitionStart = Date.now();
            playClickSound();
            return;
        }

        const components = global.Categories.selectedItem.components;
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
            let clickedCategory = null;

            if (isInside(mouseX, mouseY, editButtonRect)) {
                playClickSound();
                OverlayManager.openPositionsGUI();
                return;
            } else {
                global.Categories.categories.forEach((cat, i) => {
                    const rect = getCategoryRect(i);
                    if (isInside(mouseX, mouseY, rect)) {
                        clickedCategory = cat.name;
                    }
                });
            }

            if (clickedCategory && clickedCategory !== global.Categories.selected) {
                global.Categories.selected = clickedCategory;
                invalidateContentHeightCache();
                resetCategoryScroll();
            }
            global.Categories.transitionDirection = -1;
            global.Categories.transitionProgress = 0;
            global.Categories.transitionStart = Date.now();
            playClickSound();
            return;
        }

        if (!isInside(mouseX, mouseY, global.GuiRectangles.RightPanel)) {
            global.Categories.transitionDirection = -1;
            global.Categories.transitionProgress = 0;
            global.Categories.transitionStart = Date.now();
        }
    } else {
        let clickedCategoryName = null;
        let clickedIndex = -1;

        if (isInside(mouseX, mouseY, editButtonRect)) {
            playClickSound();
            OverlayManager.openPositionsGUI();
            return;
        } else {
            global.Categories.categories.some((cat, i) => {
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
            if (clickedCategoryName !== global.Categories.selected) {
                const oldIndex = global.Categories.categories.findIndex((c) => c.name === global.Categories.selected);
                let oldRect;

                if (global.Categories.selected === 'Edit') {
                    oldRect = editButtonRect;
                } else {
                    oldRect = getCategoryRect(oldIndex);
                }

                const newRect = getCategoryRect(clickedIndex);

                const oldIconX = oldRect.x + (oldRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const oldIconY = oldRect.y + (oldRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const newIconX = newRect.x + (newRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                const newIconY = newRect.y + (newRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;

                global.Categories.catAnimationRect = {
                    startX: oldIconX,
                    startY: oldIconY,
                    endX: newIconX,
                    endY: newIconY,
                    width: HIGHLIGHT_SIZE,
                    height: HIGHLIGHT_SIZE,
                    radius: 8,
                };
                global.Categories.catTransitionStart = Date.now();

                global.Categories.transitionDirection = clickedIndex > oldIndex ? 1 : -1;
                global.Categories.selected = clickedCategoryName;
                global.Categories.currentPage = 'categories';
                global.Categories.selectedItem = null;
                global.Categories.selectedSubcategory = null;

                global.Categories.transitionProgress = 0;
                global.Categories.transitionStart = Date.now();

                invalidateContentHeightCache();
                invalidateLayoutCache();
                resetCategoryScroll();
                playClickSound();
            }
            return;
        }

        if (isInside(mouseX, mouseY, leftPanel)) {
            playClickSound();
        }

        if (global.Categories.selected && global.Categories.currentPage === 'categories') {
            const cat = global.Categories.categories.find((c) => c.name === global.Categories.selected);
            if (!cat) return;

            if (cat.subcategories.length > 0) {
                let currentX = panel.x + PADDING;
                let yOffset = panel.y + PADDING;
                const subcategoriesToDraw = ['All', ...cat.subcategories];
                for (const subcat of subcategoriesToDraw) {
                    const buttonTextWidth = getTextWidth(subcat, FontSizes.SMALL) + 20;
                    const buttonRect = {
                        x: currentX,
                        y: yOffset,
                        width: buttonTextWidth,
                        height: SUBCATEGORY_BUTTON_HEIGHT,
                    };
                    if (isInside(mouseX, mouseY, buttonRect)) {
                        const newSubcatName = subcat === 'All' ? null : subcat;
                        if (global.Categories.selectedSubcategory !== newSubcatName) {
                            const oldRect = global.Categories.selectedSubcategoryButton || buttonRect;
                            global.Categories.selectedSubcategory = newSubcatName;
                            invalidateContentHeightCache();
                            invalidateLayoutCache();
                            global.Categories.subcatTransitionStart = Date.now();
                            global.Categories.subcatTransitionProgress = 0;
                            global.Categories.animationRect = {
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
                            global.Categories.selectedSubcategoryButton = buttonRect;
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
                    global.Categories.transitionDirection = 1;
                    global.Categories.transitionProgress = 0;
                    global.Categories.transitionStart = Date.now();
                    global.Categories.selectedItem = layout.item;
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

    if (global.Categories.currentPage === 'options' && global.Categories.selectedItem) {
        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;

        let scrollHandled = false;
        let componentY = optionY + 78;
        const components = global.Categories.selectedItem.components;
        if (components) {
            components.forEach((component) => {
                let compHeight = 54;
                if (component instanceof MultiToggle) {
                    compHeight += component.getExpandedHeight() * component.animationProgress;
                }
                const compRect = {
                    x: optionX + 10,
                    y: componentY - global.Categories.optionsScrollY,
                    width: panel.width - PADDING * 2 - 20,
                    height: compHeight,
                };
                if (isInside(mouseX, mouseY, compRect) && typeof component.handleScroll === 'function') {
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
    if (global.Categories.currentPage !== 'categories' || global.Categories.transitionDirection !== 0) return;

    if (!global.Categories.selected || !isInside(mouseX, mouseY, panel)) {
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
    if (global.Categories.transitionDirection !== 0) {
        const elapsed = Date.now() - global.Categories.transitionStart;
        const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);
        global.Categories.transitionProgress = easeInOutQuad(rawProgress);

        if (rawProgress >= 1) {
            const newPage = global.Categories.transitionDirection === 1 ? 'options' : 'categories';
            global.Categories.currentPage = newPage;
            if (newPage === 'categories') {
                global.Categories.selectedItem = null;
                global.Categories.optionsScrollY = 0;
            }
            if (newPage === 'options') {
                global.Categories.optionsScrollY = 0;
            }
            global.Categories.transitionDirection = 0;
            global.Categories.transitionProgress = 1;
            return true;
        }
        return true;
    }
    return false;
};
