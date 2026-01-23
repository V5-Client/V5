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
    drawCenteredText,
    drawImage,
    drawCircularImage,
    scissor,
    resetScissor,
    FontSizes,
    getDiscordPfpPath,
    colorWithAlpha,
    drawRoundedRectangleWithBorder,
} from '../Utils';
import { MultiToggle } from '../components/Dropdown';
import { ColorPicker } from '../components/ColorPicker';
import { Separator } from '../components/Separator';
import { drawRoundedRectangle } from '../Utils';
import { GuiRectangles } from '../core/GuiState';
import { Categories } from './CategorySystem';
import { SearchBar } from './CategorySearchBar';
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
        const isHovered = isInside(mouseX, mouseY, buttonRect) && !cat.isHoverBlocked;

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

    const components = cat.directComponents;
    const panelWidth = panel.width;

    let currentY = yOffset - scrollY;
    let currentSection = null;

    const shouldShowSearchEmptyState = categoryName === 'Settings' || categoryName === 'Theme';
    if (shouldShowSearchEmptyState && SearchBar.query.trim().length > 0) {
        const searchState = cat.searchState || { isEmpty: false };
        if (searchState.isEmpty) {
            const cardWidth = panelWidth - PADDING * 2 - 20;
            const cardX = panelX + PADDING + 10;
            const cardY = currentY + 6;
            const cardHeight = 64;
            drawRoundedRectangleWithBorder({
                x: cardX,
                y: cardY,
                width: cardWidth,
                height: cardHeight,
                radius: 10,
                color: THEME.BG_COMPONENT,
                borderWidth: 1,
                borderColor: THEME.BORDER,
            });
            const title = `No ${categoryName.toLowerCase()} results`;
            const subtitle = 'Try a different keyword.';
            drawText(title, cardX + 12, cardY + 24, FontSizes.REGULAR, THEME.TEXT);
            drawText(subtitle, cardX + 12, cardY + 40, FontSizes.SMALL, THEME.TEXT_MUTED);
            currentY += cardHeight + 10;
        }
    }

    components.forEach((component, index) => {
        if (component.sectionName && component.sectionName !== currentSection) {
            currentSection = component.sectionName;

            if (index > 0) currentY += 16;

            const separator = new Separator(currentSection);
            separator.x = panelX + PADDING;
            separator.y = currentY;
            separator.optionPanelWidth = panelWidth;
            separator.draw(mouseX, mouseY);

            currentY += 26;
        }

        if (typeof component.draw === 'function') {
            const xOffset = component instanceof Separator ? 0 : 10;
            component.x = panelX + PADDING + xOffset;
            component.y = currentY;
            component.optionPanelWidth = panelWidth;
            component.optionPanelHeight = panel.height;
            component.draw(mouseX, mouseY);

            let componentHeight = 48 + 6;

            if (component instanceof Separator) {
                componentHeight = 26;
            } else if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
                if (component.animationProgress !== undefined) {
                    componentHeight += component.getExpandedHeight() * component.animationProgress;
                }
            }
            currentY += componentHeight;
        }
    });

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

    let drawnCompY = optionY + 78 - scrollY;
    selectedItem.components.forEach((component) => {
        if (typeof component.draw !== 'function') return;
        const isSeparator = component instanceof Separator;
        const xOffset = isSeparator ? 0 : 10;
        component.x = optionX + xOffset;
        component.y = drawnCompY;
        component.optionPanelWidth = panel.width;
        component.optionPanelHeight = panel.height;
        component.draw(mouseX, mouseY);
        let thisHeight = isSeparator ? 26 : 48 + 6;

        if (!isSeparator && (component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
            if (component.animationProgress !== undefined) {
                thisHeight += component.getExpandedHeight() * component.animationProgress;
            }
        }
        drawnCompY += thisHeight;
    });
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
    const isDirectComponent = item && item.type === 'direct-component';
    const isModuleComponent = item && item.type === 'module-component';
    const isThemeComponent = item && item.type === 'theme-component';
    const isStacked = isDirectComponent || isModuleComponent || isThemeComponent;
    const itemHeight = 48;
    const itemRect = {
        x: itemX,
        y: itemY,
        width: itemWidth,
        height: itemHeight,
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
    if (isStacked) {
        const centerY = itemY + itemHeight / 2;
        const titleY = centerY - 6;
        const subtitleY = centerY + 6;
        drawText(item.title, itemX + 12, titleY, FontSizes.REGULAR, THEME.TEXT);
        if (isDirectComponent && item.sectionName) {
            const sectionText = `Settings • ${item.sectionName}`;
            drawText(sectionText, itemX + 12, subtitleY, FontSizes.SMALL, THEME.TEXT_MUTED);
        }
        if (isModuleComponent && item.moduleTitle) {
            const moduleText = `Module • ${item.moduleTitle}`;
            drawText(moduleText, itemX + 12, subtitleY, FontSizes.SMALL, THEME.TEXT_MUTED);
        }
        if (isThemeComponent && item.sectionName) {
            const sectionText = `Theme • ${item.sectionName}`;
            drawText(sectionText, itemX + 12, subtitleY, FontSizes.SMALL, THEME.TEXT_MUTED);
        }
    } else {
        const textX = centerText ? itemX + itemWidth / 2 - getTextWidth(item.title, FontSizes.REGULAR) / 2 : itemX + 12;
        drawText(item.title, textX, itemY + 48 / 2, FontSizes.REGULAR, THEME.TEXT);
    }
};

export const drawCategoryItems = (cat, panel, panelX, yOffset, mouseX, mouseY, items, layouts, valid, query = '') => {
    const iw = (panel.width - PADDING * 2 - ITEM_SPACING * 2) / 3;
    let rowIdx = 0;

    if (query.length > 0 && items.length === 0) {
        const emptyHeight = 64;
        const emptyX = panelX + PADDING;
        const emptyY = yOffset + 4;
        const emptyWidth = panel.width - PADDING * 2;
        drawRoundedRectangleWithBorder({
            x: emptyX,
            y: emptyY,
            width: emptyWidth,
            height: emptyHeight,
            radius: 10,
            color: THEME.BG_COMPONENT,
            borderWidth: 1,
            borderColor: THEME.BORDER,
        });
        drawCenteredText('No results found', emptyX, emptyWidth, FontSizes.REGULAR, THEME.TEXT, emptyY + 24);
        drawCenteredText('Try a different search term?', emptyX, emptyWidth, FontSizes.SMALL, THEME.TEXT_MUTED, emptyY + 40);
        return;
    }

    items.forEach((g, i) => {
        if (g.type === 'separator') {
            if (i > 0) yOffset += 12;

            g.x = panelX + PADDING;
            g.y = yOffset;
            g.optionPanelWidth = panel.width;
            if (typeof g.draw === 'function') g.draw(mouseX, mouseY);

            yOffset += 22;
            let subIdx = 0;

            g.items.forEach((item) => {
                if (subIdx % 3 === 0 && subIdx > 0) yOffset += 54;
                drawItemBox(item, panelX + PADDING + (subIdx % 3) * (iw + ITEM_SPACING), yOffset, iw, mouseX, mouseY, layouts, valid, true);
                subIdx++;
            });
            if (g.items.length > 0) {
                yOffset += 48;
            }
        } else {
            if (rowIdx % 3 === 0 && rowIdx > 0) yOffset += 54;
            drawItemBox(g, panelX + PADDING + (rowIdx % 3) * (iw + ITEM_SPACING), yOffset, iw, mouseX, mouseY, layouts, valid, false);
            rowIdx++;
        }
    });
};
