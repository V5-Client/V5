import {
    PADDING,
    CATEGORY_HEIGHT,
    CATEGORY_PADDING,
    CATEGORY_BOX_PADDING,
    ITEM_SPACING,
    SEPARATOR_HEIGHT,
    SUBCATEGORY_BUTTON_HEIGHT,
    SUBCATEGORY_BUTTON_SPACING,
    THEME,
    easeInOutQuad,
    isInside,
} from '../Utils';
import { MultiToggle } from '../components/Dropdown';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder } from '../Utils';

const Module_icon = Image.fromAsset('folder.png');
const Setting_icon = Image.fromAsset('settings.png');

const CATEGORY_TITLE_COLOR = THEME.GUI_MANAGER_CATEGORY_TITLE;
const CATEGORY_DESC_COLOR = THEME.GUI_MANAGER_CATEGORY_DESCRIPTION;
const BACK_TEXT_COLOR = THEME.GUI_MANAGER_BACK_TEXT;
const CATEGORY_BOX_COLOR = THEME.GUI_MANAGER_CATEGORY_BOX;
const CATEGORY_BOX_HOVER = THEME.GUI_MANAGER_CATEGORY_BOX_HOVER;
const UNIVERSAL_GRAY_COLOR = THEME.GUI_MANAGER_UNIVERSAL_GRAY;
const CATEGORY_SELECTED_COLOR = THEME.GUI_MANAGER_CATEGORY_SELECTED;
const CATEGORY_SELECTED_BORDER = THEME.GUI_MANAGER_CATEGORY_SELECTED_BORDER;

export const getCategoryRect = (index) => {
    return {
        x: global.GuiRectangles.LeftPanel.x + PADDING,
        y: global.GuiRectangles.LeftPanel.y + PADDING + index * (CATEGORY_HEIGHT + CATEGORY_PADDING),
        width: global.GuiRectangles.LeftPanel.width - PADDING * 2,
        height: CATEGORY_HEIGHT,
    };
};

export const drawSubcategoryButtons = (panelX, yOffset, mouseX, mouseY) => {
    const cat = global.Categories;

    if (cat.animationRect) {
        const elapsed = Date.now() - cat.subcatTransitionStart;
        const rawProgress = Math.min(1, elapsed / cat.subcatAnimationDuration);
        cat.subcatTransitionProgress = easeInOutQuad(rawProgress);
        const p = cat.subcatTransitionProgress;

        cat.animationRect.x = cat.animationRect.startX + (cat.animationRect.endX - cat.animationRect.startX) * p;
        cat.animationRect.width = cat.animationRect.startWidth + (cat.animationRect.endWidth - cat.animationRect.startWidth) * p;
        cat.animationRect.y = yOffset;

        if (rawProgress >= 1) {
            cat.animationRect = null;
        }
    }

    const subcategoriesToDraw = ['All', ...cat.categories.find((c) => c.name === cat.selected).subcategories];

    // Draw selected rectangle first
    if (cat.animationRect) {
        drawRoundedRectangle({
            x: cat.animationRect.x,
            y: cat.animationRect.y,
            width: cat.animationRect.width,
            height: cat.animationRect.height,
            radius: 8,
            color: CATEGORY_SELECTED_COLOR,
        });

        drawRoundedRectangle({
            x: cat.animationRect.x,
            y: cat.animationRect.y,
            width: cat.animationRect.width,
            height: 2,
            radius: 8,
            color: CATEGORY_SELECTED_BORDER,
        });
    }

    // Then draw the buttons and text and shit
    let currentX = panelX + PADDING;
    subcategoriesToDraw.forEach((subcat) => {
        const buttonTextWidth = Renderer.getStringWidth(subcat) + 20;
        const buttonRect = {
            x: currentX,
            y: yOffset,
            width: buttonTextWidth,
            height: SUBCATEGORY_BUTTON_HEIGHT,
        };

        const isSelected = (cat.selectedSubcategory === subcat || (!cat.selectedSubcategory && subcat === 'All')) && !cat.animationRect;
        const isHovered = isInside(mouseX, mouseY, buttonRect);

        if (isSelected) cat.selectedSubcategoryButton = buttonRect;

        // Draw the static nonanimated one
        if (!cat.animationRect) {
            if (isSelected) {
                drawRoundedRectangle({
                    x: buttonRect.x,
                    y: buttonRect.y,
                    width: buttonRect.width,
                    height: buttonRect.height,
                    radius: 8,
                    color: CATEGORY_SELECTED_COLOR,
                });

                drawRoundedRectangle({
                    x: buttonRect.x,
                    y: buttonRect.y,
                    width: buttonRect.width,
                    height: 2,
                    radius: 8,
                    color: CATEGORY_SELECTED_BORDER,
                });
            } else if (isHovered) {
                drawRoundedRectangle({
                    x: buttonRect.x,
                    y: buttonRect.y,
                    width: buttonRect.width,
                    height: buttonRect.height,
                    radius: 8,
                    color: UNIVERSAL_GRAY_COLOR,
                });
            }
        }

        const textColor = isSelected ? CATEGORY_TITLE_COLOR : CATEGORY_DESC_COLOR;
        Renderer.drawString(
            subcat,
            currentX + buttonTextWidth / 2 - Renderer.getStringWidth(subcat) / 2,
            yOffset + (SUBCATEGORY_BUTTON_HEIGHT - 8) / 2,
            textColor,
            false
        );
        currentX += buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
    });

    return yOffset + SUBCATEGORY_BUTTON_HEIGHT + PADDING;
};

export const drawOptionsPanel = (panel, mouseX, mouseY) => {
    const selectedItem = global.Categories.selectedItem;
    if (!selectedItem) return;

    let optionPanelX = panel.x;
    if (global.Categories.transitionDirection === 1) {
        optionPanelX += panel.width * (1 - global.Categories.transitionProgress);
    } else if (global.Categories.transitionDirection === -1) {
        optionPanelX += panel.width * global.Categories.transitionProgress;
    }

    const optionX = optionPanelX + PADDING;
    const optionY = panel.y + PADDING;
    const scrollY = global.Categories.optionsScrollY;

    const backButtonText = 'Back';
    const backButtonX = optionX + 10;
    const backButtonY = optionY + 12;
    const drawnBackY = backButtonY - scrollY;
    const isBackHovered = isInside(mouseX, mouseY, {
        x: backButtonX,
        y: drawnBackY,
        width: Renderer.getStringWidth(backButtonText),
        height: 10,
    });

    Renderer.drawString(backButtonText, backButtonX, drawnBackY, isBackHovered ? CATEGORY_TITLE_COLOR : BACK_TEXT_COLOR);

    const drawnTitleY = optionY + 36 - scrollY;
    Renderer.drawString(selectedItem.title, backButtonX, drawnTitleY, CATEGORY_TITLE_COLOR, false);

    const drawnDescY = optionY + 52 - scrollY;
    Renderer.drawString(selectedItem.description, backButtonX, drawnDescY, CATEGORY_DESC_COLOR, false);

    const dividerY = optionY + 66 - scrollY;
    drawRoundedRectangle({
        x: backButtonX,
        y: dividerY,
        width: panel.width - PADDING * 2 - 20,
        height: 1,
        radius: 1,
        color: UNIVERSAL_GRAY_COLOR,
    });

    let drawnCompY = optionY + 78 - scrollY;
    selectedItem.components.forEach((component) => {
        if (typeof component.draw !== 'function') return;

        component.x = optionX + 10;
        component.y = drawnCompY;
        component.optionPanelWidth = panel.width;
        component.optionPanelHeight = panel.height;

        component.draw(mouseX, mouseY);

        let thisHeight = 48 + 6;
        if (component instanceof MultiToggle && component.animationProgress > 0) {
            thisHeight += component.getExpandedHeight() * component.animationProgress;
        }
        drawnCompY += thisHeight;
    });
};

export const drawLeftPanel = (mouseX, mouseY) => {
    if (global.Categories.catAnimationRect) {
        const elapsed = Date.now() - global.Categories.catTransitionStart;
        const rawProgress = Math.min(1, elapsed / global.Categories.catAnimationDuration);
        const p = easeInOutQuad(rawProgress);

        const rect = global.Categories.catAnimationRect;
        rect.x = rect.startX + (rect.endX - rect.startX) * p;
        rect.y = rect.startY + (rect.endY - rect.startY) * p;

        if (rawProgress >= 1) {
            global.Categories.catAnimationRect = null;
        }
    }

    if (global.Categories.catAnimationRect) {
        const rect = global.Categories.catAnimationRect;
        drawRoundedRectangleWithBorder({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            radius: rect.radius,
            color: CATEGORY_SELECTED_COLOR,
            borderWidth: 1.5,
            borderColor: CATEGORY_SELECTED_BORDER,
        });
    } else {
        const selectedCat = global.Categories.categories.find((cat) => cat.name === global.Categories.selected);
        if (selectedCat) {
            const i = global.Categories.categories.indexOf(selectedCat);
            const rect = getCategoryRect(i);
            const moduleSize = 28;
            const iconX = rect.x + (rect.width - moduleSize) / 2;
            const iconY = rect.y + (rect.height - moduleSize) / 2;

            const highlightRect = {
                x: iconX - 2,
                y: iconY - 2,
                width: moduleSize + 4,
                height: moduleSize + 4,
                radius: 8,
            };

            drawRoundedRectangleWithBorder({
                ...highlightRect,
                color: CATEGORY_SELECTED_COLOR,
                borderWidth: 1.5,
                borderColor: CATEGORY_SELECTED_BORDER,
            });
        }
    }

    global.Categories.categories.forEach((cat, i) => {
        const rect = getCategoryRect(i);
        const moduleSize = 28;
        const iconX = rect.x + (rect.width - moduleSize) / 2;
        const iconY = rect.y + (rect.height - moduleSize) / 2;

        let iconToDraw = cat.name === 'Modules' ? Module_icon : Setting_icon;
        iconToDraw.draw(iconX, iconY, moduleSize, moduleSize);
    });

    // bottom left pfp
    if (global.discordPfp) {
        const leftPanel = global.GuiRectangles.LeftPanel;
        const pfpSize = 32;
        const pfpX = leftPanel.x + (leftPanel.width - pfpSize) / 2;
        const pfpY = leftPanel.y + leftPanel.height - pfpSize - PADDING;

        Renderer.drawImage(global.discordPfp, pfpX, pfpY, pfpSize, pfpSize);
    }
};

const drawItemBox = (item, itemX, itemY, itemWidth, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, centerText = false) => {
    const itemRect = {
        x: itemX,
        y: itemY,
        width: itemWidth,
        height: 48,
        radius: 10,
        color: CATEGORY_BOX_COLOR,
        borderWidth: 1,
        borderColor: THEME.GUI_MANAGER_CATEGORY_BOX_BORDER,
    };

    const isHovered = isInside(mouseX, mouseY, itemRect);
    itemRect.color = isHovered ? CATEGORY_BOX_HOVER : CATEGORY_BOX_COLOR;

    if (isHovered && item.tooltip) {
        global.setTooltip(item.tooltip);
    }

    drawRoundedRectangleWithBorder(itemRect);

    if (isHovered) {
        drawRoundedRectangle({
            x: itemX + 1,
            y: itemY + 1,
            width: 3,
            height: 46,
            radius: 10,
            color: CATEGORY_SELECTED_BORDER,
        });
    }

    if (!isLayoutCacheValid) {
        cachedItemLayouts.push({ rect: itemRect, item });
    }

    const textX = centerText ? itemX + itemWidth / 2 - Renderer.getStringWidth(item.title) / 2 : itemX + 12;
    Renderer.drawString(item.title, textX, itemY + 48 / 2 - 4, CATEGORY_TITLE_COLOR, false);
};

export const drawCategoryItems = (cat, panel, panelX, yOffset, mouseX, mouseY, itemsToDisplay, cachedItemLayouts, isLayoutCacheValid) => {
    const panelWidth = panel.width - PADDING * 2;
    const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
    let itemIndexInRow = 0;

    itemsToDisplay.forEach((group, groupIndex) => {
        if (group.type === 'separator') {
            if (groupIndex > 0) {
                yOffset += 12;
            }

            const separatorY = yOffset;
            const separatorX = panelX + PADDING;
            const separatorWidth = panelWidth;

            drawRoundedRectangle({
                x: separatorX,
                y: separatorY + 8,
                width: separatorWidth,
                height: 1,
                radius: 1,
                color: UNIVERSAL_GRAY_COLOR,
            });

            const separatorTextWidth = Renderer.getStringWidth(group.title);
            const separatorTextX = separatorX + 8;
            const separatorBgWidth = separatorTextWidth + 16;

            drawRoundedRectangle({
                x: separatorTextX - 8,
                y: separatorY,
                width: separatorBgWidth,
                height: 16,
                radius: 6,
                color: THEME.GUI_DRAW_PANELS,
            });

            Renderer.drawString(group.title, separatorTextX, separatorY + 4, CATEGORY_TITLE_COLOR, false);
            yOffset += 22;

            let subcategoryItemsInRow = 0;
            group.items.forEach((item) => {
                const col = subcategoryItemsInRow % 3;
                if (col === 0 && subcategoryItemsInRow > 0) {
                    yOffset += 48 + 6;
                }

                const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
                drawItemBox(item, itemX, yOffset, itemWidth, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, true);

                subcategoryItemsInRow++;
            });

            if (group.items.length > 0) {
                yOffset += 48;
            }
        } else {
            if (global.Categories.selectedSubcategory !== null) return;

            const item = group;
            const col = itemIndexInRow % 3;
            if (col === 0 && itemIndexInRow > 0) {
                yOffset += 48 + 6;
            }

            const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
            drawItemBox(item, itemX, yOffset, itemWidth, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, false);

            itemIndexInRow++;
        }
    });
};
