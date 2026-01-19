import { OverlayManager } from '../OverlayUtils';
import {
    isInside,
    playClickSound,
    easeInOutQuad,
    PADDING,
    SUBCATEGORY_BUTTON_HEIGHT,
    SUBCATEGORY_BUTTON_SPACING,
    ITEM_SPACING,
    getTextWidth,
    FontSizes,
} from '../Utils';
import { MultiToggle } from '../components/Dropdown';
import { ColorPicker } from '../components/ColorPicker';
import { Separator } from '../components/Separator';
import { Categories } from './CategorySystem';
import { GuiRectangles } from '../core/GuiState';

const ANIMATION_DURATION = 300;
const ICON_SIZE = 28;
const HIGHLIGHT_PADDING = 2;
const HIGHLIGHT_SIZE = ICON_SIZE + HIGHLIGHT_PADDING * 2;

export const handleDirectComponentsClick = (mouseX, mouseY, panel, scrollY, categoryName) => {
    const directCat = Categories.categories.find((c) => c.name === categoryName);
    if (!directCat || !directCat.directComponents) return false;

    if (!directCat.sectionSeparators) directCat.sectionSeparators = {};

    const components = directCat.directComponents;
    const panelX = panel.x;
    const panelWidth = panel.width;
    const contentX = panelX + PADDING;

    const getSeparatorProgress = (separator) => (typeof separator.animationProgress === 'number' ? separator.animationProgress : separator.collapsed ? 0 : 1);

    const getComponentHeight = (component) => {
        let componentHeight = 48 + 6;
        if (typeof component.getExpandedHeight === 'function' && component.animationProgress !== undefined) {
            componentHeight += component.getExpandedHeight() * component.animationProgress;
        }
        return componentHeight;
    };

    let currentY = panel.y + PADDING - scrollY;
    let currentSection = null;

    for (let i = 0; i < components.length; ) {
        const component = components[i];

        if (component.sectionName && component.sectionName !== currentSection) {
            currentSection = component.sectionName;

            if (i > 0) currentY += 16;

            let separator = directCat.sectionSeparators[currentSection];
            if (!separator) {
                separator = new Separator(currentSection);
                directCat.sectionSeparators[currentSection] = separator;
            }

            separator.x = contentX;
            separator.y = currentY;
            separator.optionPanelWidth = panelWidth;
            if (typeof separator.updateAnimation === 'function') separator.updateAnimation();

            if (separator.handleClick(mouseX, mouseY)) {
                return true;
            }

            currentY += 26;

            const sectionStartY = currentY;
            const sectionProgress = getSeparatorProgress(separator);

            let endIndex = i;
            while (endIndex < components.length && (!components[endIndex].sectionName || components[endIndex].sectionName === currentSection)) {
                endIndex++;
            }

            let sectionHeight = 0;
            let manualCollapsed = false;
            for (let j = i; j < endIndex; j++) {
                const sectionComponent = components[j];
                if (sectionComponent instanceof Separator) {
                    if (typeof sectionComponent.updateAnimation === 'function') sectionComponent.updateAnimation();
                    sectionHeight += 26;
                    const progress = getSeparatorProgress(sectionComponent);
                    manualCollapsed = progress <= 0;
                    continue;
                }
                if (manualCollapsed) continue;
                if (typeof sectionComponent.handleClick === 'function') {
                    sectionHeight += getComponentHeight(sectionComponent);
                } else {
                    sectionHeight += 54;
                }
            }

            const animatedSectionHeight = sectionHeight * sectionProgress;

            if (animatedSectionHeight > 0) {
                let localY = sectionStartY;
                let localCollapsed = false;
                for (let j = i; j < endIndex; j++) {
                    if (localY >= sectionStartY + animatedSectionHeight) break;
                    const sectionComponent = components[j];

                    if (sectionComponent instanceof Separator) {
                        sectionComponent.x = contentX;
                        sectionComponent.y = localY;
                        sectionComponent.optionPanelWidth = panelWidth;
                        sectionComponent.optionPanelHeight = panel.height;
                        if (typeof sectionComponent.updateAnimation === 'function') sectionComponent.updateAnimation();

                        if (sectionComponent.handleClick(mouseX, mouseY)) {
                            return true;
                        }

                        localY += 26;
                        const progress = getSeparatorProgress(sectionComponent);
                        localCollapsed = progress <= 0;
                        continue;
                    }

                    if (localCollapsed) continue;

                    if (typeof sectionComponent.handleClick === 'function') {
                        const componentHeight = getComponentHeight(sectionComponent);
                        const clickableArea = {
                            x: contentX,
                            y: localY,
                            width: panelWidth - 2 * PADDING,
                            height: componentHeight,
                        };

                        if (isInside(mouseX, mouseY, clickableArea)) {
                            sectionComponent.x = contentX + 10;
                            sectionComponent.y = localY;
                            sectionComponent.optionPanelWidth = panelWidth;
                            sectionComponent.optionPanelHeight = panel.height;

                            if (sectionComponent.handleClick(mouseX, mouseY)) {
                                return true;
                            }
                        }

                        localY += componentHeight;
                    } else {
                        localY += 54;
                    }
                }
            }

            currentY = sectionStartY + animatedSectionHeight;
            i = endIndex;
            continue;
        }

        if (component instanceof Separator) {
            component.x = contentX;
            component.y = currentY;
            component.optionPanelWidth = panelWidth;
            component.optionPanelHeight = panel.height;
            if (typeof component.updateAnimation === 'function') component.updateAnimation();

            if (component.handleClick(mouseX, mouseY)) {
                return true;
            }

            currentY += 26;
            i++;
            continue;
        }

        if (typeof component.handleClick !== 'function') {
            currentY += 54;
            i++;
            continue;
        }

        const componentHeight = getComponentHeight(component);
        const clickableArea = {
            x: contentX,
            y: currentY,
            width: panelWidth - 2 * PADDING,
            height: componentHeight,
        };

        if (isInside(mouseX, mouseY, clickableArea)) {
            component.x = contentX + 10;
            component.y = currentY;
            component.optionPanelWidth = panelWidth;
            component.optionPanelHeight = panel.height;

            if (component.handleClick(mouseX, mouseY)) {
                return true;
            }
        }

        currentY += componentHeight;
        i++;
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
                invalidateContentHeightCache();
                invalidateLayoutCache();
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
        const contentWidth = panel.width - PADDING * 2;

        const getSeparatorProgress = (separator) =>
            typeof separator.animationProgress === 'number' ? separator.animationProgress : separator.collapsed ? 0 : 1;

        const getComponentHeight = (component) => {
            let componentHeight = 48 + 6;
            if (typeof component.getExpandedHeight === 'function') {
                if (component.animationProgress !== undefined) {
                    componentHeight += component.getExpandedHeight() * component.animationProgress;
                } else {
                    componentHeight += component.getExpandedHeight();
                }
            }
            return componentHeight;
        };

        let currentDrawnCompY = optionY + 78 - scrollY;

        for (let i = 0; i < components.length; ) {
            const component = components[i];

            if (component instanceof Separator) {
                component.x = optionX;
                component.y = currentDrawnCompY;
                component.optionPanelWidth = panel.width;
                component.optionPanelHeight = panel.height;
                if (typeof component.updateAnimation === 'function') component.updateAnimation();

                if (component.handleClick(mouseX, mouseY)) {
                    invalidateContentHeightCache();
                    invalidateLayoutCache();
                    return;
                }

                currentDrawnCompY += 26;

                const sectionStartY = currentDrawnCompY;
                const sectionProgress = getSeparatorProgress(component);

                let endIndex = i + 1;
                while (endIndex < components.length && !(components[endIndex] instanceof Separator)) {
                    endIndex++;
                }

                let sectionHeight = 0;
                for (let j = i + 1; j < endIndex; j++) {
                    const sectionComponent = components[j];
                    if (typeof sectionComponent.handleClick === 'function') {
                        sectionHeight += getComponentHeight(sectionComponent);
                    } else {
                        sectionHeight += 54;
                    }
                }

                const animatedSectionHeight = sectionHeight * sectionProgress;

                if (animatedSectionHeight > 0) {
                    let localY = sectionStartY;
                    for (let j = i + 1; j < endIndex; j++) {
                        if (localY >= sectionStartY + animatedSectionHeight) break;
                        const sectionComponent = components[j];

                        if (typeof sectionComponent.handleClick !== 'function') {
                            localY += 54;
                            continue;
                        }

                        const componentHeight = getComponentHeight(sectionComponent);
                        const clickableArea = {
                            x: optionX,
                            y: localY,
                            width: contentWidth,
                            height: componentHeight,
                        };

                        if (isInside(mouseX, mouseY, clickableArea)) {
                            sectionComponent.x = optionX + 10;
                            sectionComponent.y = localY;
                            sectionComponent.optionPanelWidth = panel.width;
                            sectionComponent.optionPanelHeight = panel.height;

                            if (sectionComponent.handleClick(mouseX, mouseY)) {
                                return;
                            }
                        }

                        localY += componentHeight;
                    }
                }

                currentDrawnCompY = sectionStartY + animatedSectionHeight;
                i = endIndex;
                continue;
            }

            if (typeof component.handleClick !== 'function') {
                currentDrawnCompY += 54;
                i++;
                continue;
            }

            const componentHeight = getComponentHeight(component);
            const clickableArea = {
                x: optionX,
                y: currentDrawnCompY,
                width: contentWidth,
                height: componentHeight,
            };

            if (isInside(mouseX, mouseY, clickableArea)) {
                component.x = optionX + 10;
                component.y = currentDrawnCompY;
                component.optionPanelWidth = panel.width;
                component.optionPanelHeight = panel.height;

                if (component.handleClick(mouseX, mouseY)) {
                    return;
                }
            }

            currentDrawnCompY += componentHeight;
            i++;
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

            if (Categories.selected === 'Settings' || Categories.selected === 'Theme') return;

            let yOffset = panel.y + PADDING - scrollY;

            if (cat.subcategories.length > 0) {
                let currentX = panel.x + PADDING;
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
                            if (newSubcatName) {
                                const separator = cat.items.find((group) => group.type === 'separator' && group.title === newSubcatName);
                                if (separator) {
                                    if (separator.collapsed) separator.collapsed = false;
                                    if (typeof separator.startAnimation === 'function') {
                                        separator.startAnimation(true);
                                    } else if (typeof separator.setCollapsed === 'function') {
                                        separator.setCollapsed(false);
                                    }
                                }
                            } else if (Categories.openAllSubcategoriesOnAll) {
                                cat.items.forEach((group) => {
                                    if (group.type !== 'separator') return;
                                    if (group.collapsed) group.collapsed = false;
                                    if (typeof group.startAnimation === 'function') {
                                        group.startAnimation(true);
                                    } else if (typeof group.setCollapsed === 'function') {
                                        group.setCollapsed(false);
                                    }
                                });
                            }
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
                yOffset += SUBCATEGORY_BUTTON_HEIGHT + PADDING;
            }

            const itemsToDisplay = Categories.selectedSubcategory
                ? cat.items.filter((group) => group.type === 'separator' && group.title === Categories.selectedSubcategory)
                : cat.items;

            const panelWidth = panel.width - PADDING * 2;
            const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
            let itemIndexInRow = 0;

            const handleItemClick = (item, itemX, itemY) => {
                const rect = { x: itemX, y: itemY, width: itemWidth, height: 48 };
                if (!isInside(mouseX, mouseY, rect)) return false;
                Categories.transitionType = 'page';
                Categories.transitionDirection = 1;
                Categories.transitionProgress = 0;
                Categories.transitionStart = Date.now();
                Categories.selectedItem = item;
                playClickSound();
                return true;
            };

            for (let groupIndex = 0; groupIndex < itemsToDisplay.length; groupIndex++) {
                const group = itemsToDisplay[groupIndex];
                if (group.type === 'separator') {
                    if (groupIndex > 0) yOffset += 12;

                    group.x = panel.x + PADDING;
                    group.y = yOffset;
                    group.optionPanelWidth = panel.width;
                    if (typeof group.updateAnimation === 'function') group.updateAnimation();

                    if (group.handleClick(mouseX, mouseY)) {
                        invalidateContentHeightCache();
                        invalidateLayoutCache();
                        return;
                    }

                    yOffset += 22;

                    const itemsInSubcategory = group.items.length;
                    if (itemsInSubcategory > 0) {
                        const numRows = Math.ceil(itemsInSubcategory / 3);
                        const fullHeight = numRows * (48 + 6) - 6;
                        const progress = typeof group.animationProgress === 'number' ? group.animationProgress : group.collapsed ? 0 : 1;
                        const animatedItemsHeight = fullHeight * progress;

                        if (animatedItemsHeight > 0) {
                            const itemsTop = yOffset;
                            let rowY = itemsTop;
                            for (let i = 0; i < group.items.length; i++) {
                                const item = group.items[i];
                                const col = i % 3;
                                if (col === 0 && i > 0) {
                                    rowY += 48 + 6;
                                }
                                if (rowY >= itemsTop + animatedItemsHeight) break;
                                const itemX = panel.x + PADDING + col * (itemWidth + ITEM_SPACING);
                                if (handleItemClick(item, itemX, rowY)) return;
                            }
                        }

                        yOffset += animatedItemsHeight;
                    }
                } else {
                    if (Categories.selectedSubcategory !== null) continue;
                    const col = itemIndexInRow % 3;
                    if (col === 0 && itemIndexInRow > 0) yOffset += 48 + 6;
                    const itemX = panel.x + PADDING + col * (itemWidth + ITEM_SPACING);
                    if (handleItemClick(group, itemX, yOffset)) return;
                    itemIndexInRow++;
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

    if (Categories.currentPage === 'categories') {
        const directCat = Categories.categories.find((c) => c.name === Categories.selected);
        if (directCat?.directComponents && isInside(mouseX, mouseY, panel)) {
            let scrollHandled = false;
            const components = directCat.directComponents;
            let componentY = panel.y + PADDING;
            let currentSection = null;
            let sectionCollapsed = false;
            let manualCollapsed = false;

            components.forEach((component) => {
                if (component.sectionName && component.sectionName !== currentSection) {
                    currentSection = component.sectionName;
                    manualCollapsed = false;

                    if (directCat.sectionSeparators && directCat.sectionSeparators[currentSection]) {
                        const separator = directCat.sectionSeparators[currentSection];
                        const progress = typeof separator.animationProgress === 'number' ? separator.animationProgress : separator.collapsed ? 0 : 1;
                        sectionCollapsed = progress <= 0;
                    } else {
                        sectionCollapsed = false;
                    }

                    if (componentY !== panel.y + PADDING) componentY += 16;
                    componentY += 26;
                }

                if (sectionCollapsed) return;

                if (component instanceof Separator) {
                    const compRect = {
                        x: panel.x + PADDING,
                        y: componentY - rightPanelScrollY,
                        width: panel.width - PADDING * 2,
                        height: 26,
                    };

                    if (isInside(mouseX, mouseY, compRect) && typeof component.handleScroll === 'function') {
                        component.optionPanelWidth = panel.width;
                        if (component.handleScroll(mouseX, mouseY, dir)) {
                            scrollHandled = true;
                        }
                    }

                    componentY += 26;
                    const progress = typeof component.animationProgress === 'number' ? component.animationProgress : component.collapsed ? 0 : 1;
                    manualCollapsed = progress <= 0;
                    return;
                }

                if (manualCollapsed) return;

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
                    if (component.handleScroll(mouseX, mouseY, dir)) {
                        scrollHandled = true;
                    }
                }
                componentY += compHeight;
            });

            if (!scrollHandled) {
                const maxScroll = Math.max(0, cachedContentHeight - panel.height + PADDING);
                const direction = dir > 0 ? -1 : 1;
                const newScroll = rightPanelScrollY + direction * SCROLL_SPEED;
                setRightPanelScrollY(Math.max(0, Math.min(newScroll, maxScroll)));
            }
            return;
        }
    }

    if (Categories.currentPage === 'options' && Categories.selectedItem) {
        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;

        let scrollHandled = false;
        let componentY = optionY + 78;
        let manualCollapsed = false;
        const components = Categories.selectedItem.components;
        if (components) {
            components.forEach((component) => {
                if (component instanceof Separator) {
                    const compRect = {
                        x: optionX,
                        y: componentY - Categories.optionsScrollY,
                        width: panel.width - PADDING * 2,
                        height: 26,
                    };
                    if (isInside(mouseX, mouseY, compRect) && typeof component.handleScroll === 'function') {
                        component.optionPanelWidth = panel.width;
                        if (component.handleScroll(mouseX, mouseY, dir)) {
                            scrollHandled = true;
                        }
                    }
                    componentY += 26;
                    const progress = typeof component.animationProgress === 'number' ? component.animationProgress : component.collapsed ? 0 : 1;
                    manualCollapsed = progress <= 0;
                    return;
                }

                if (manualCollapsed) return;

                let compHeight = 54;

                let expansionHeight = 0;
                if (typeof component.getExpandedHeight === 'function') {
                    if (component.animationProgress !== undefined) {
                        expansionHeight = component.getExpandedHeight() * component.animationProgress;
                    } else {
                        expansionHeight = component.getExpandedHeight();
                    }
                }
                compHeight += expansionHeight;

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
