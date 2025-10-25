import {
    PADDING,
    CORNER_RADIUS,
    CATEGORY_HEIGHT,
    CATEGORY_PADDING,
    LEFT_PANEL_TEXT_HEIGHT,
    CATEGORY_OFFSET_Y,
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
const UNIVERSAL_GRAY_COLOR = THEME.GUI_MANAGER_UNIVERSAL_GRAY;
const CATEGORY_SELECTED_COLOR = THEME.GUI_MANAGER_CATEGORY_SELECTED;

export const getCategoryRect = (index) => {
    return {
        x: global.GuiRectangles.LeftPanel.x + PADDING,
        y:
            global.GuiRectangles.LeftPanel.y +
            PADDING +
            CATEGORY_OFFSET_Y +
            index * (CATEGORY_HEIGHT + CATEGORY_PADDING),
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

        cat.animationRect.x =
            cat.animationRect.startX +
            (cat.animationRect.endX - cat.animationRect.startX) * p;
        cat.animationRect.width =
            cat.animationRect.startWidth +
            (cat.animationRect.endWidth - cat.animationRect.startWidth) * p;

        cat.animationRect.y = yOffset;

        if (rawProgress >= 1) {
            cat.animationRect = null;
        }
    }

    let currentX = panelX + PADDING;
    const subcategoriesToDraw = [
        'All',
        ...cat.categories.find((c) => c.name === cat.selected).subcategories,
    ];

    subcategoriesToDraw.forEach((subcat) => {
        const buttonTextWidth = Renderer.getStringWidth(subcat) + 10;
        const buttonRect = {
            x: currentX,
            y: yOffset,
            width: buttonTextWidth,
            height: SUBCATEGORY_BUTTON_HEIGHT,
            radius: 5,
            color: UNIVERSAL_GRAY_COLOR,
        };

        const isSelected =
            (cat.selectedSubcategory === subcat ||
                (!cat.selectedSubcategory && subcat === 'All')) &&
            !cat.animationRect;

        if (isSelected) cat.selectedSubcategoryButton = buttonRect;

        if (cat.animationRect) {
            drawRoundedRectangle({
                x: cat.animationRect.x,
                y: cat.animationRect.y,
                width: cat.animationRect.width,
                height: cat.animationRect.height,
                radius: 5,
                color: CATEGORY_SELECTED_COLOR,
            });
        } else if (isSelected) {
            drawRoundedRectangle({
                x: buttonRect.x,
                y: buttonRect.y,
                width: buttonRect.width,
                height: buttonRect.height,
                radius: 5,
                color: CATEGORY_SELECTED_COLOR,
            });
        }

        Renderer.drawString(
            subcat,
            currentX + 5,
            yOffset + (SUBCATEGORY_BUTTON_HEIGHT - 8) / 2,
            isSelected ? CATEGORY_TITLE_COLOR : CATEGORY_DESC_COLOR,
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
        optionPanelX +=
            panel.width * (1 - global.Categories.transitionProgress);
    } else if (global.Categories.transitionDirection === -1) {
        optionPanelX += panel.width * global.Categories.transitionProgress;
    }

    const optionX = optionPanelX + PADDING;
    const optionY = panel.y + PADDING;
    const scrollY = global.Categories.optionsScrollY;

    const backButtonText = 'Back';
    const backButtonX = optionX + 10;
    const backButtonY = optionY + 10;
    const drawnBackY = backButtonY - scrollY;
    Renderer.drawString(
        backButtonText,
        backButtonX,
        drawnBackY,
        BACK_TEXT_COLOR
    );

    const drawnTitleY = optionY + 30 - scrollY;
    Renderer.drawString(
        selectedItem.title,
        backButtonX,
        drawnTitleY,
        CATEGORY_TITLE_COLOR,
        false
    );
    const drawnDescY = optionY + 45 - scrollY;
    Renderer.drawString(
        selectedItem.description,
        backButtonX + 10,
        drawnDescY,
        CATEGORY_DESC_COLOR,
        false
    );

    let drawnCompY = optionY + 70 - scrollY;
    selectedItem.components.forEach((component) => {
        if (typeof component.draw !== 'function') return;

        component.x = optionX + 10;
        component.y = drawnCompY;
        component.optionPanelWidth = panel.width;
        component.optionPanelHeight = panel.height;

        component.draw(mouseX, mouseY);

        let thisHeight = 45;
        if (
            component instanceof MultiToggle &&
            component.animationProgress > 0
        ) {
            thisHeight +=
                component.getExpandedHeight() * component.animationProgress;
        }
        drawnCompY += thisHeight;
    });
};

export const drawLeftPanel = (mouseX, mouseY) => {
    if (global.Categories.catAnimationRect) {
        const elapsed = Date.now() - global.Categories.catTransitionStart;
        const rawProgress = Math.min(
            1,
            elapsed / global.Categories.catAnimationDuration
        );
        const p = easeInOutQuad(rawProgress);

        const rect = global.Categories.catAnimationRect;

        rect.x = rect.startX + (rect.endX - rect.startX) * p;
        rect.y = rect.startY + (rect.endY - rect.startY) * p;

        if (rawProgress >= 1) {
            global.Categories.catAnimationRect = null;
        }
    }

    global.Categories.categories.forEach((cat, i) => {
        const rect = getCategoryRect(i);
        const moduleSize = 25;
        const iconX = rect.x + (rect.width - moduleSize) / 2;
        const iconY = rect.y + (rect.height - moduleSize) / 2;

        let iconToDraw;
        if (cat.name === 'Modules') iconToDraw = Module_icon;
        else if (cat.name === 'Settings') iconToDraw = Setting_icon;
        else iconToDraw = Module_icon;

        const highlightRect = {
            x: iconX - 1,
            y: iconY - 1,
            width: moduleSize + 2,
            height: moduleSize + 2,
            radius: 5,
            color: CATEGORY_SELECTED_COLOR,
        };

        const isSelected = cat.name === global.Categories.selected;

        if (!global.Categories.catAnimationRect && isSelected) {
            drawRoundedRectangle(highlightRect);
        }

        iconToDraw.draw(iconX, iconY, moduleSize, moduleSize);

        // prevent icon being drawn twice
        if (i === 0 && global.discordPfp) {
            const pfpX = iconX - 1;
            const pfpY = iconY - 58;
            const iconSize = moduleSize - 2;
            Renderer.drawImage(
                global.discordPfp,
                pfpX,
                pfpY,
                iconSize,
                iconSize
            );
        }
    });

    if (global.Categories.catAnimationRect) {
        const rect = global.Categories.catAnimationRect;
        drawRoundedRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            radius: rect.radius,
            color: CATEGORY_SELECTED_COLOR,
        });
    }
};

const drawItemBox = (
    item,
    itemX,
    itemY,
    itemWidth,
    mouseX,
    mouseY,
    cachedItemLayouts,
    isLayoutCacheValid,
    centerText = false
) => {
    const itemRect = {
        x: itemX,
        y: itemY,
        width: itemWidth,
        height: 40,
        radius: CORNER_RADIUS,
        color: CATEGORY_BOX_COLOR,
        borderWidth: 0.5,
        borderColor: THEME.GUI_MANAGER_CATEGORY_BOX_BORDER,
    };

    const isHovered = isInside(mouseX, mouseY, itemRect);
    itemRect.color = isHovered ? UNIVERSAL_GRAY_COLOR : CATEGORY_BOX_COLOR;

    if (isHovered && item.tooltip) {
        global.setTooltip(item.tooltip);
    }

    drawRoundedRectangleWithBorder(itemRect);

    if (!isLayoutCacheValid) {
        cachedItemLayouts.push({ rect: itemRect, item });
    }

    const textX = centerText
        ? itemX + itemWidth / 2 - Renderer.getStringWidth(item.title) / 2
        : itemX + 5;

    Renderer.drawString(
        item.title,
        textX,
        itemY + 40 / 2 - 4,
        CATEGORY_TITLE_COLOR,
        false
    );
};

export const drawCategoryItems = (
    cat,
    panel,
    panelX,
    yOffset,
    mouseX,
    mouseY,
    itemsToDisplay,
    cachedItemLayouts,
    isLayoutCacheValid
) => {
    const panelWidth = panel.width - PADDING * 2;
    const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
    let itemIndexInRow = 0;

    itemsToDisplay.forEach((group) => {
        if (group.type === 'separator') {
            const separatorY = yOffset + SEPARATOR_HEIGHT / 2;
            const separatorX = panelX + PADDING;
            const separatorWidth = panelWidth;

            drawRoundedRectangle({
                x: separatorX,
                y: separatorY,
                width: separatorWidth,
                height: 1,
                radius: 5,
                color: UNIVERSAL_GRAY_COLOR,
            });

            const separatorTextWidth = Renderer.getStringWidth(group.title);
            const separatorTextX =
                separatorX + separatorWidth / 2 - separatorTextWidth / 2;
            Renderer.drawString(
                group.title,
                separatorTextX,
                separatorY - 10,
                CATEGORY_DESC_COLOR,
                false
            );
            yOffset += SEPARATOR_HEIGHT;

            let subcategoryItemsInRow = 0;
            group.items.forEach((item) => {
                const col = subcategoryItemsInRow % 3;
                if (col === 0 && subcategoryItemsInRow > 0) {
                    yOffset += CATEGORY_BOX_PADDING + 40;
                }

                const itemX =
                    panelX + PADDING + col * (itemWidth + ITEM_SPACING);

                drawItemBox(
                    item,
                    itemX,
                    yOffset,
                    itemWidth,
                    mouseX,
                    mouseY,
                    cachedItemLayouts,
                    isLayoutCacheValid,
                    true
                );

                subcategoryItemsInRow++;
            });

            const itemsInSubcategory = group.items.length;
            const numRows = Math.ceil(itemsInSubcategory / 3);
            yOffset += numRows > 0 ? 40 + CATEGORY_BOX_PADDING : 0;
        } else {
            if (global.Categories.selectedSubcategory !== null) return;

            const item = group;
            const col = itemIndexInRow % 3;
            if (col === 0 && itemIndexInRow > 0) {
                yOffset += 40 + CATEGORY_BOX_PADDING;
            }

            const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);

            drawItemBox(
                item,
                itemX,
                yOffset,
                itemWidth,
                mouseX,
                mouseY,
                cachedItemLayouts,
                isLayoutCacheValid,
                false
            );

            itemIndexInRow++;
        }
    });
};
