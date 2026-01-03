import {
    PADDING,
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
    FontSizes,
    getDiscordPfpPath,
} from '../Utils';
import { MultiToggle } from '../components/Dropdown';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder } from '../Utils';
import { GuiRectangles } from '../core/GuiState';
import { Categories } from './CategorySystem';
import { setTooltip } from '../core/GuiTooltip';

const ASSETS_PATH = 'config/ChatTriggers/modules/V5/assets/';
const Module_icon_path = ASSETS_PATH + 'folder.svg';
const Setting_icon_path = ASSETS_PATH + 'settings.svg';
const Edit_icon_path = ASSETS_PATH + 'edit.svg';

const CATEGORY_TITLE_COLOR = THEME.GUI_MANAGER_CATEGORY_TITLE;
const CATEGORY_DESC_COLOR = THEME.GUI_MANAGER_CATEGORY_DESCRIPTION;
const BACK_TEXT_COLOR = THEME.GUI_MANAGER_BACK_TEXT;
const CATEGORY_BOX_COLOR = THEME.GUI_MANAGER_CATEGORY_BOX;
const CATEGORY_BOX_HOVER = THEME.GUI_MANAGER_CATEGORY_BOX_HOVER;
const UNIVERSAL_GRAY_COLOR = THEME.GUI_MANAGER_UNIVERSAL_GRAY;
const CATEGORY_SELECTED_COLOR = THEME.GUI_MANAGER_CATEGORY_SELECTED;

export const getCategoryRect = (index) => {
    return {
        x: GuiRectangles.LeftPanel.x + PADDING,
        y: GuiRectangles.LeftPanel.y + PADDING + index * (CATEGORY_HEIGHT + CATEGORY_PADDING),
        width: GuiRectangles.LeftPanel.width - PADDING * 2,
        height: CATEGORY_HEIGHT,
    };
};

export const drawSubcategoryButtons = (panelX, yOffset, mouseX, mouseY) => {
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

    const subcategoriesToDraw = ['All', ...cat.categories.find((c) => c.name === cat.selected).subcategories];

    const drawSelectedButton = (rect) => {
        drawRoundedRectangle({
            x: rect.x,
            y: rect.y + 2.5,
            width: rect.width,
            height: rect.height - 5,
            radius: 8,
            color: CATEGORY_SELECTED_COLOR,
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

        if (isSelected) cat.selectedSubcategoryButton = buttonRect;

        if (!cat.animationRect) {
            if (isSelected) {
                drawSelectedButton(buttonRect);
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

    drawText(backButtonText, backButtonX, drawnBackY + 5, FontSizes.SMALL, isBackHovered ? CATEGORY_TITLE_COLOR : BACK_TEXT_COLOR);
    const drawnTitleY = optionY + 36 - scrollY;
    drawText(selectedItem.title, backButtonX, drawnTitleY + 7, FontSizes.HEADER, CATEGORY_TITLE_COLOR);
    const drawnDescY = optionY + 52 - scrollY;
    drawText(selectedItem.description, backButtonX, drawnDescY + 5, FontSizes.SMALL, CATEGORY_DESC_COLOR);

    const dividerY = optionY + 66 - scrollY;
    drawRoundedRectangle({ x: backButtonX, y: dividerY, width: panel.width - PADDING * 2 - 20, height: 1, radius: 1, color: UNIVERSAL_GRAY_COLOR });

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

export const drawLeftPanelBackgrounds = (mouseX, mouseY) => {
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
        drawRoundedRectangle({ ...rect, color: CATEGORY_SELECTED_COLOR });
    } else {
        const selectedCat = Categories.categories.find((cat) => cat.name === Categories.selected);
        if (selectedCat) {
            const i = Categories.categories.indexOf(selectedCat);
            const rect = getCategoryRect(i);
            const moduleRectSize = 28;
            const iconX = rect.x + (rect.width - moduleRectSize) / 2;
            const iconY = rect.y + (rect.height - moduleRectSize) / 2;
            const highlightRect = { x: iconX - 2, y: iconY - 2, width: moduleRectSize + 4, height: moduleRectSize + 4, radius: 8 };
            drawRoundedRectangle({ ...highlightRect, color: CATEGORY_SELECTED_COLOR });
        } else if (Categories.selected === 'Edit') {
            const leftPanel = GuiRectangles.LeftPanel;
            const pfpSize = 28;
            const pfpY = leftPanel.y + leftPanel.height - pfpSize - PADDING;
            const editIconSize = 16;
            const editIconX = leftPanel.x + (leftPanel.width - editIconSize) / 2;
            const editIconY = pfpY - editIconSize - 15;
            const highlightRect = { x: editIconX - 6, y: editIconY - 6, width: editIconSize + 12, height: editIconSize + 12, radius: 8 };
            drawRoundedRectangle({ ...highlightRect, color: CATEGORY_SELECTED_COLOR });
        }
    }
};

export const drawLeftPanelIcons = (mouseX, mouseY) => {
    Categories.categories.forEach((cat, i) => {
        const rect = getCategoryRect(i);
        const moduleSize = 17;
        const iconX = rect.x + (rect.width - moduleSize) / 2;
        const iconY = rect.y + (rect.height - moduleSize) / 2;
        const iconPath = cat.name === 'Modules' ? Module_icon_path : Setting_icon_path;
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
        color: CATEGORY_BOX_COLOR,
        borderWidth: 1,
        borderColor: THEME.GUI_MANAGER_CATEGORY_BOX_BORDER,
    };
    const isHovered = isInside(mouseX, mouseY, itemRect);
    itemRect.color = isHovered ? CATEGORY_BOX_HOVER : CATEGORY_BOX_COLOR;
    if (isHovered && item.tooltip) setTooltip(item.tooltip);
    drawRoundedRectangleWithBorder(itemRect);
    if (!isLayoutCacheValid) cachedItemLayouts.push({ rect: itemRect, item });
    const textX = centerText ? itemX + itemWidth / 2 - getTextWidth(item.title, FontSizes.REGULAR) / 2 : itemX + 12;
    drawText(item.title, textX, itemY + 48 / 2, FontSizes.REGULAR, CATEGORY_TITLE_COLOR);
};

export const drawCategoryItems = (cat, panel, panelX, yOffset, mouseX, mouseY, itemsToDisplay, cachedItemLayouts, isLayoutCacheValid) => {
    const panelWidth = panel.width - PADDING * 2;
    const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
    let itemIndexInRow = 0;

    itemsToDisplay.forEach((group, groupIndex) => {
        if (group.type === 'separator') {
            if (groupIndex > 0) yOffset += 12;
            const separatorY = yOffset;
            const separatorX = panelX + PADDING;
            const separatorWidth = panelWidth;
            drawRoundedRectangle({ x: separatorX, y: separatorY + 8, width: separatorWidth, height: 1, radius: 1, color: UNIVERSAL_GRAY_COLOR });
            const separatorTextWidth = getTextWidth(group.title, FontSizes.REGULAR);
            const separatorTextX = separatorX + 8;
            const separatorBgWidth = separatorTextWidth + 16;
            drawRoundedRectangle({ x: separatorTextX - 8, y: separatorY, width: separatorBgWidth, height: 16, radius: 6, color: THEME.GUI_DRAW_PANELS });
            drawText(group.title, separatorTextX, separatorY + 8, FontSizes.REGULAR, CATEGORY_TITLE_COLOR);
            yOffset += 22;
            let subcategoryItemsInRow = 0;
            group.items.forEach((item) => {
                const col = subcategoryItemsInRow % 3;
                if (col === 0 && subcategoryItemsInRow > 0) yOffset += 48 + 6;
                const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
                drawItemBox(item, itemX, yOffset, itemWidth, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, true);
                subcategoryItemsInRow++;
            });
            if (group.items.length > 0) yOffset += 48;
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
