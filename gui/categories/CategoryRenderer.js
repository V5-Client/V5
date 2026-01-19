import {
    PADDING,
    BORDER_WIDTH,
    CATEGORY_HEIGHT,
    CATEGORY_PADDING,
    ITEM_SPACING,
    SUBCATEGORY_BUTTON_HEIGHT,
    SUBCATEGORY_BUTTON_SPACING,
    THEME,
    easeInOutQuad,
    isInside,
    drawText,
    getTextWidth,
    drawImage,
    drawCircularImage,
    scissor,
    resetScissor,
    pushScissor,
    popScissor,
    FontSizes,
    getDiscordPfpPath,
    colorWithAlpha,
} from '../Utils';
import { MultiToggle } from '../components/Dropdown';
import { ColorPicker } from '../components/ColorPicker';
import { Separator } from '../components/Separator';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder } from '../Utils';
import { GuiRectangles } from '../core/GuiState';
import { Categories } from './CategorySystem';
import { setTooltip } from '../core/GuiTooltip';

const ASSETS_PATH = 'config/ChatTriggers/modules/V5/assets/';
const Module_icon_path = ASSETS_PATH + 'folder.svg';
const Theme_icon_path = ASSETS_PATH + 'colorpalette.svg';
const Setting_icon_path = ASSETS_PATH + 'settings.svg';
const Edit_icon_path = ASSETS_PATH + 'edit.svg';

export const getCategoryRect = (index) => {
    return {
        x: GuiRectangles.LeftPanel.x + PADDING,
        y: GuiRectangles.LeftPanel.y + PADDING + index * (CATEGORY_HEIGHT + CATEGORY_PADDING),
        width: GuiRectangles.LeftPanel.width - PADDING * 2,
        height: CATEGORY_HEIGHT,
    };
};

export const drawSubcategoryButtons = (catObj, panelX, yOffset, mouseX, mouseY) => {
    const cat = Categories;

    if (cat.animationRect) {
        const elapsed = Date.now() - cat.subcatTransitionStart;
        const rawProgress = Math.min(1, elapsed / cat.subcatAnimationDuration);
        cat.subcatTransitionProgress = easeInOutQuad(rawProgress);
        const p = cat.subcatTransitionProgress;

        cat.animationRect.x = cat.animationRect.startX + (cat.animationRect.endX - cat.animationRect.startX) * p;
        cat.animationRect.width = cat.animationRect.startWidth + (cat.animationRect.endWidth - cat.animationRect.startWidth) * p;
        cat.animationRect.y = yOffset;
        if (rawProgress >= 1) cat.animationRect = null;
    }

    const subcategoriesToDraw = ['All', ...catObj.subcategories];

    const drawSelectedButton = (rect) => {
        drawRoundedRectangle({
            x: rect.x,
            y: rect.y + 2.5,
            width: rect.width,
            height: rect.height - 5,
            radius: 8,
            color: THEME.ACCENT_DIM,
        });
    };

    if (cat.animationRect) {
        drawSelectedButton(cat.animationRect);
    }

    let currentX = panelX + PADDING;
    subcategoriesToDraw.forEach((subcat) => {
        const buttonTextWidth = getTextWidth(subcat, FontSizes.MEDIUM) + 20;
        const buttonRect = { x: currentX, y: yOffset, width: buttonTextWidth, height: SUBCATEGORY_BUTTON_HEIGHT };
        const isSelected = (cat.selectedSubcategory === subcat || (!cat.selectedSubcategory && subcat === 'All')) && !cat.animationRect;
        const isHovered = isInside(mouseX, mouseY, buttonRect);

        const hoverKey = `subcat_${subcat}`;
        if (!cat.hoverStates[hoverKey]) {
            cat.hoverStates[hoverKey] = { progress: 0, lastUpdate: Date.now() };
        }
        const state = cat.hoverStates[hoverKey];
        const now = Date.now();
        const delta = (now - state.lastUpdate) / 150;
        state.lastUpdate = now;

        if (isHovered) state.progress = Math.min(1, state.progress + delta);
        else state.progress = Math.max(0, state.progress - delta);

        if (isSelected) cat.selectedSubcategoryButton = buttonRect;

        if (!cat.animationRect) {
            if (isSelected) {
                drawSelectedButton(buttonRect);
            } else if (state.progress > 0) {
                drawRoundedRectangle({
                    x: buttonRect.x,
                    y: buttonRect.y,
                    width: buttonRect.width,
                    height: buttonRect.height,
                    radius: 8,
                    color: colorWithAlpha(THEME.BG_INSET, state.progress),
                });
            }
        }

        const textColor = isSelected ? THEME.TEXT : THEME.TEXT_MUTED;
        drawText(
            subcat,
            currentX + buttonTextWidth / 2 - getTextWidth(subcat, FontSizes.MEDIUM) / 2,
            yOffset + SUBCATEGORY_BUTTON_HEIGHT / 2,
            FontSizes.MEDIUM,
            textColor
        );
        currentX += buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
    });

    return yOffset + SUBCATEGORY_BUTTON_HEIGHT + PADDING;
};

export const drawDirectComponents = (panel, panelX, yOffset, mouseX, mouseY, scrollY, categoryName) => {
    const cat = Categories.categories.find((c) => c.name === categoryName);
    if (!cat || !cat.directComponents) return yOffset;

    if (!cat.sectionSeparators) cat.sectionSeparators = {};

    const components = cat.directComponents;
    const panelWidth = panel.width;
    const contentX = panelX + PADDING;
    const contentWidth = panelWidth - PADDING * 2;

    const getSeparatorProgress = (separator) => (typeof separator.animationProgress === 'number' ? separator.animationProgress : separator.collapsed ? 0 : 1);

    const getComponentHeight = (component) => {
        let componentHeight = 48 + 6;
        if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
            if (component.animationProgress !== undefined) {
                componentHeight += component.getExpandedHeight() * component.animationProgress;
            }
        }
        return componentHeight;
    };

    let currentY = yOffset - scrollY;
    let currentSection = null;

    for (let i = 0; i < components.length; ) {
        const component = components[i];

        if (component.sectionName && component.sectionName !== currentSection) {
            currentSection = component.sectionName;

            if (i > 0) currentY += 16;

            let separator = cat.sectionSeparators[currentSection];
            if (!separator) {
                separator = new Separator(currentSection);
                cat.sectionSeparators[currentSection] = separator;
            }
            separator.x = contentX;
            separator.y = currentY;
            separator.optionPanelWidth = panelWidth;
            separator.draw(mouseX, mouseY);

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
                    sectionHeight += 26;
                    const progress = getSeparatorProgress(sectionComponent);
                    manualCollapsed = progress <= 0;
                    continue;
                }
                if (manualCollapsed) continue;
                if (typeof sectionComponent.draw === 'function') {
                    sectionHeight += getComponentHeight(sectionComponent);
                }
            }

            const animatedSectionHeight = sectionHeight * sectionProgress;

            if (animatedSectionHeight > 0) {
                const scissorPadding = BORDER_WIDTH + 1;
                const scissorX = contentX - scissorPadding;
                const scissorY = sectionStartY - scissorPadding;
                const scissorWidth = contentWidth + scissorPadding * 2;
                const scissorHeight = animatedSectionHeight + scissorPadding * 2;
                pushScissor(scissorX, scissorY, scissorWidth, scissorHeight);

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
                        sectionComponent.draw(mouseX, mouseY);
                        localY += 26;
                        const progress = getSeparatorProgress(sectionComponent);
                        localCollapsed = progress <= 0;
                        continue;
                    }

                    if (localCollapsed) continue;

                    if (typeof sectionComponent.draw === 'function') {
                        sectionComponent.x = contentX + 10;
                        sectionComponent.y = localY;
                        sectionComponent.optionPanelWidth = panelWidth;
                        sectionComponent.optionPanelHeight = panel.height;
                        sectionComponent.draw(mouseX, mouseY);
                        localY += getComponentHeight(sectionComponent);
                    }
                }

                popScissor();
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
            component.draw(mouseX, mouseY);
            currentY += 26;
            const progress = getSeparatorProgress(component);
            if (progress <= 0) {
                i++;
                continue;
            }
        }

        if (typeof component.draw === 'function') {
            component.x = contentX + 10;
            component.y = currentY;
            component.optionPanelWidth = panelWidth;
            component.optionPanelHeight = panel.height;
            component.draw(mouseX, mouseY);
            currentY += getComponentHeight(component);
        }

        i++;
    }

    return currentY + scrollY;
};

export const drawOptionsPanel = (panel, mouseX, mouseY) => {
    const selectedItem = Categories.selectedItem;
    if (!selectedItem) return;

    let optionPanelX = panel.x;
    if (Categories.transitionDirection === 1) optionPanelX += panel.width * (1 - Categories.transitionProgress);
    else if (Categories.transitionDirection === -1) optionPanelX += panel.width * Categories.transitionProgress;

    const optionX = optionPanelX + PADDING;
    const optionY = panel.y + PADDING;
    const scrollY = Categories.optionsScrollY;

    const backButtonText = 'Back';
    const backButtonX = optionX + 10;
    const backButtonY = optionY + 12;
    const drawnBackY = backButtonY - scrollY;
    const isBackHovered = isInside(mouseX, mouseY, { x: backButtonX, y: drawnBackY, width: getTextWidth(backButtonText, FontSizes.SMALL), height: 10 });

    drawText(backButtonText, backButtonX, drawnBackY + 5, FontSizes.SMALL, isBackHovered ? THEME.TEXT : THEME.TEXT_LINK);
    const drawnTitleY = optionY + 36 - scrollY;
    drawText(selectedItem.title, backButtonX, drawnTitleY + 7, FontSizes.HEADER, THEME.TEXT);
    const drawnDescY = optionY + 52 - scrollY;
    drawText(selectedItem.description, backButtonX, drawnDescY + 5, FontSizes.SMALL, THEME.TEXT_MUTED);

    const dividerY = optionY + 66 - scrollY;
    drawRoundedRectangle({ x: backButtonX, y: dividerY, width: panel.width - PADDING * 2 - 20, height: 1, radius: 1, color: THEME.BG_INSET });

    const components = selectedItem.components;
    const contentWidth = panel.width - PADDING * 2;

    const getSeparatorProgress = (separator) => (typeof separator.animationProgress === 'number' ? separator.animationProgress : separator.collapsed ? 0 : 1);

    const getComponentHeight = (component) => {
        let componentHeight = 48 + 6;
        if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
            if (component.animationProgress !== undefined) {
                componentHeight += component.getExpandedHeight() * component.animationProgress;
            }
        }
        return componentHeight;
    };

    let drawnCompY = optionY + 78 - scrollY;

    for (let i = 0; i < components.length; ) {
        const component = components[i];

        if (component instanceof Separator) {
            component.x = optionX;
            component.y = drawnCompY;
            component.optionPanelWidth = panel.width;
            component.optionPanelHeight = panel.height;
            component.draw(mouseX, mouseY);

            drawnCompY += 26;

            const sectionStartY = drawnCompY;
            const sectionProgress = getSeparatorProgress(component);

            let endIndex = i + 1;
            while (endIndex < components.length && !(components[endIndex] instanceof Separator)) {
                endIndex++;
            }

            let sectionHeight = 0;
            for (let j = i + 1; j < endIndex; j++) {
                const sectionComponent = components[j];
                if (typeof sectionComponent.draw === 'function') {
                    sectionHeight += getComponentHeight(sectionComponent);
                }
            }

            const animatedSectionHeight = sectionHeight * sectionProgress;

            if (animatedSectionHeight > 0) {
                const scissorPadding = BORDER_WIDTH + 1;
                const scissorX = optionX - scissorPadding;
                const scissorY = sectionStartY - scissorPadding;
                const scissorWidth = contentWidth + scissorPadding * 2;
                const scissorHeight = animatedSectionHeight + scissorPadding * 2;

                pushScissor(scissorX, scissorY, scissorWidth, scissorHeight);

                let localY = sectionStartY;
                for (let j = i + 1; j < endIndex; j++) {
                    if (localY >= sectionStartY + animatedSectionHeight) break;
                    const sectionComponent = components[j];
                    if (typeof sectionComponent.draw !== 'function') continue;
                    sectionComponent.x = optionX + 10;
                    sectionComponent.y = localY;
                    sectionComponent.optionPanelWidth = panel.width;
                    sectionComponent.optionPanelHeight = panel.height;
                    sectionComponent.draw(mouseX, mouseY);
                    localY += getComponentHeight(sectionComponent);
                }

                popScissor();
            }

            drawnCompY = sectionStartY + animatedSectionHeight;
            i = endIndex;
            continue;
        }

        if (typeof component.draw !== 'function') {
            i++;
            continue;
        }

        component.x = optionX + 10;
        component.y = drawnCompY;
        component.optionPanelWidth = panel.width;
        component.optionPanelHeight = panel.height;
        component.draw(mouseX, mouseY);
        drawnCompY += getComponentHeight(component);
        i++;
    }
};

export const drawLeftPanelBackgrounds = (mouseX, mouseY) => {
    const leftPanel = GuiRectangles.LeftPanel;
    const pfpSize = 28;
    const pfpY = leftPanel.y + leftPanel.height - pfpSize - PADDING;
    const editIconSize = 16;
    const editIconX = leftPanel.x + (leftPanel.width - editIconSize) / 2;
    const editIconY = pfpY - editIconSize - 15;
    const editButtonRect = { x: editIconX - 6, y: editIconY - 6, width: editIconSize + 12, height: editIconSize + 12, radius: 8 };

    if (Categories.catAnimationRect) {
        const elapsed = Date.now() - Categories.catTransitionStart;
        const rawProgress = Math.min(1, elapsed / Categories.catAnimationDuration);
        const p = easeInOutQuad(rawProgress);
        const rect = Categories.catAnimationRect;
        rect.x = rect.startX + (rect.endX - rect.startX) * p;
        rect.y = rect.startY + (rect.endY - rect.startY) * p;
        if (rawProgress >= 1) Categories.catAnimationRect = null;
    }

    if (Categories.catAnimationRect) {
        const rect = Categories.catAnimationRect;
        drawRoundedRectangle({ ...rect, color: THEME.ACCENT_DIM });
    } else {
        const selectedCat = Categories.categories.find((cat) => cat.name === Categories.selected);
        if (selectedCat) {
            const i = Categories.categories.indexOf(selectedCat);
            const rect = getCategoryRect(i);
            const moduleRectSize = 28;
            const iconX = rect.x + (rect.width - moduleRectSize) / 2;
            const iconY = rect.y + (rect.height - moduleRectSize) / 2;
            const highlightRect = { x: iconX - 2, y: iconY - 2, width: moduleRectSize + 4, height: moduleRectSize + 4, radius: 8 };
            drawRoundedRectangle({ ...highlightRect, color: THEME.ACCENT_DIM });
        } else if (Categories.selected === 'Edit') {
            drawRoundedRectangle({ ...editButtonRect, color: THEME.ACCENT_DIM });
        }
    }

    const allCategoryItems = [...Categories.categories.map((c, i) => ({ name: c.name, rect: getCategoryRect(i) })), { name: 'Edit', rect: editButtonRect }];

    allCategoryItems.forEach((item) => {
        const isHovered = isInside(mouseX, mouseY, item.rect);
        const name = item.name;

        if (!Categories.hoverStates[name]) {
            Categories.hoverStates[name] = { progress: 0, lastUpdate: Date.now() };
        }

        const state = Categories.hoverStates[name];
        const now = Date.now();
        const delta = (now - state.lastUpdate) / 150;
        state.lastUpdate = now;

        if (isHovered) {
            state.progress = Math.min(1, state.progress + delta);
        } else {
            state.progress = Math.max(0, state.progress - delta);
        }

        if (state.progress > 0 && Categories.selected !== name) {
            const rect = item.rect;
            const moduleRectSize = 28;
            const iconX = rect.x + (rect.width - moduleRectSize) / 2;
            const iconY = rect.y + (rect.height - moduleRectSize) / 2;
            const highlightRect = { x: iconX - 2, y: iconY - 2, width: moduleRectSize + 4, height: moduleRectSize + 4, radius: 8 };

            const finalRect = name === 'Edit' ? item.rect : highlightRect;

            drawRoundedRectangle({
                ...finalRect,
                color: colorWithAlpha(THEME.BG_INSET, state.progress),
            });
        }
    });
};

export const drawLeftPanelIcons = (mouseX, mouseY) => {
    Categories.categories.forEach((cat, i) => {
        const rect = getCategoryRect(i);
        const moduleSize = 17;
        const iconX = rect.x + (rect.width - moduleSize) / 2;
        const iconY = rect.y + (rect.height - moduleSize) / 2;
        let iconPath = Setting_icon_path;
        if (cat.name === 'Modules') iconPath = Module_icon_path;
        else if (cat.name === 'Theme') iconPath = Theme_icon_path;
        drawImage(iconPath, iconX, iconY, moduleSize, moduleSize);
    });

    const leftPanel = GuiRectangles.LeftPanel;
    const pfpSize = 28;
    const pfpX = leftPanel.x + (leftPanel.width - pfpSize) / 2;
    const pfpY = leftPanel.y + leftPanel.height - pfpSize - PADDING;

    const editIconSize = 16;
    const editIconX = leftPanel.x + (leftPanel.width - editIconSize) / 2;
    const editIconY = pfpY - editIconSize - 15;

    drawImage(Edit_icon_path, editIconX, editIconY, editIconSize, editIconSize);

    const discordPfpPath = getDiscordPfpPath();
    if (discordPfpPath) {
        drawCircularImage(discordPfpPath, pfpX, pfpY, pfpSize);
    }
};

const drawItemBox = (item, itemX, itemY, itemWidth, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, centerText = false) => {
    const itemRect = {
        x: itemX,
        y: itemY,
        width: itemWidth,
        height: 48,
        radius: 10,
        color: THEME.BG_COMPONENT,
        borderWidth: 1,
        borderColor: THEME.BORDER,
    };
    const isHovered = isInside(mouseX, mouseY, itemRect);
    itemRect.color = isHovered ? THEME.HOVER : THEME.BG_COMPONENT;
    if (isHovered && item.tooltip) setTooltip(item.tooltip);
    drawRoundedRectangleWithBorder(itemRect);
    if (!isLayoutCacheValid) cachedItemLayouts.push({ rect: itemRect, item });
    const textX = centerText ? itemX + itemWidth / 2 - getTextWidth(item.title, FontSizes.REGULAR) / 2 : itemX + 12;
    drawText(item.title, textX, itemY + 48 / 2, FontSizes.REGULAR, THEME.TEXT);
};

export const drawCategoryItems = (cat, panel, panelX, yOffset, mouseX, mouseY, itemsToDisplay, cachedItemLayouts, isLayoutCacheValid) => {
    const panelWidth = panel.width - PADDING * 2;
    const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
    let itemIndexInRow = 0;

    itemsToDisplay.forEach((group, groupIndex) => {
        if (group.type === 'separator') {
            if (groupIndex > 0) yOffset += 12;

            group.x = panelX + PADDING;
            group.y = yOffset;

            group.optionPanelWidth = panel.width;
            group.draw(mouseX, mouseY);

            yOffset += 22;

            const itemsCount = group.items.length;
            if (itemsCount > 0) {
                const rows = Math.ceil(itemsCount / 3);
                const fullItemsHeight = rows * (48 + 6) - 6;
                const progress = typeof group.animationProgress === 'number' ? group.animationProgress : group.collapsed ? 0 : 1;
                const animatedItemsHeight = fullItemsHeight * progress;

                if (animatedItemsHeight > 0) {
                    const itemsTop = yOffset;
                    const scissorPadding = BORDER_WIDTH + 1;
                    const scissorX = panelX + PADDING - scissorPadding;
                    const scissorWidth = panelWidth + scissorPadding * 2;
                    const scissorY = itemsTop - scissorPadding;
                    const scissorHeight = animatedItemsHeight + scissorPadding * 2;

                    pushScissor(scissorX, scissorY, scissorWidth, scissorHeight);

                    let subcategoryItemsInRow = 0;
                    let rowY = itemsTop;
                    for (let i = 0; i < group.items.length; i++) {
                        const item = group.items[i];
                        const col = subcategoryItemsInRow % 3;
                        if (col === 0 && subcategoryItemsInRow > 0) {
                            rowY += 48 + 6;
                        }
                        if (rowY >= itemsTop + animatedItemsHeight) break;
                        const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
                        drawItemBox(item, itemX, rowY, itemWidth, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, true);
                        subcategoryItemsInRow++;
                    }

                    popScissor();
                }

                yOffset += animatedItemsHeight;
            }
        } else {
            if (Categories.selectedSubcategory !== null) return;
            const item = group;
            const col = itemIndexInRow % 3;
            if (col === 0 && itemIndexInRow > 0) yOffset += 48 + 6;
            const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
            drawItemBox(item, itemX, yOffset, itemWidth, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, false);
            itemIndexInRow++;
        }
    });
};
