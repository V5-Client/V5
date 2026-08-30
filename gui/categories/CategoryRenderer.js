import {
    CATEGORY_HEIGHT,
    CATEGORY_PADDING,
    FontSizes,
    ITEM_SPACING,
    PADDING,
    SUBCATEGORY_BUTTON_SPACING,
    THEME,
    colorWithAlpha,
    drawCenteredText,
    drawCircularImage,
    drawImage,
    drawRoundedRectangle,
    drawRoundedRectangleVaried,
    drawRoundedRectangleWithBorder,
    drawText,
    clamp,
    easeInOutQuad,
    easeOutCubic,
    getTextWidth,
    isInside,
    resetScissor,
    scissor,
} from '../Utils';
import { Popup } from '../components/Popup';
import { Separator } from '../components/Separator';
import { getComponentLayoutHeight, getDirectComponentPanelWidth, getDirectComponentX, isComponentVisible, layoutDirectComponents } from '../components/layout';
import { GuiRectangles } from '../core/GuiState';
import { setTooltip } from '../core/GuiTooltip';
import { SearchBar } from './CategorySearchBar';
import { Categories, getVisibleDirectComponents } from './CategorySystem';
import { globalAssetsDir } from '../../utils/Constants';
import { getDiscordPfpPath } from '../../utils/NetworkUtils';

const ASSETS_PATH = globalAssetsDir.getPath() + '/';
const MODULE_ICON_PATH = ASSETS_PATH + 'folder.svg';
const THEME_ICON_PATH = ASSETS_PATH + 'colorpalette.svg';
const SETTINGS_ICON_PATH = ASSETS_PATH + 'settings.svg';
const DASHBOARD_ICON_PATH = ASSETS_PATH + 'dashboard.svg';
const EDIT_ICON_PATH = ASSETS_PATH + 'edit.svg';
const SCRIPT_VERSION = JSON.parse(FileLib.read('V5', 'metadata.json')).version;
const moduleNavLayouts = new WeakMap();
const titleLayouts = new WeakMap();
const BACK_TEXT = 'Back';
const BACK_TEXT_WIDTH = getTextWidth(BACK_TEXT, FontSizes.SMALL);

export const getModuleBorderColor = (moduleType) =>
    moduleType === 'developer' ? colorWithAlpha(THEME.NOTIF_WARNING, 0.75) : moduleType === 'user' ? colorWithAlpha(THEME.NOTIF_ERROR, 0.75) : null;

export const getCategoryRect = (index) => {
    const visibleCategories = Categories.getVisibleCategories();
    const safeIndex = Math.max(0, Math.min(index, visibleCategories.length - 1));
    const menuHeight = visibleCategories.length * (CATEGORY_HEIGHT + CATEGORY_PADDING) - CATEGORY_PADDING;
    return {
        x: GuiRectangles.LeftPanel.x + 4,
        y: GuiRectangles.LeftPanel.y + Math.max(14, (GuiRectangles.LeftPanel.height - menuHeight) / 2) + safeIndex * (CATEGORY_HEIGHT + CATEGORY_PADDING),
        width: GuiRectangles.LeftPanel.width - 8,
        height: CATEGORY_HEIGHT,
    };
};

export const getDiscordPfpRect = () => {
    const leftPanel = GuiRectangles.LeftPanel;
    const pfpSize = 20;
    return {
        x: leftPanel.x + (leftPanel.width - pfpSize) / 2,
        y: leftPanel.y + leftPanel.height - pfpSize - PADDING * 2 - 2,
        width: pfpSize,
        height: pfpSize,
    };
};

export const getVersionButtonRect = () => {
    const leftPanel = GuiRectangles.LeftPanel;
    const width = getTextWidth(`V${SCRIPT_VERSION}`, FontSizes.TINY) + 8;
    return {
        x: leftPanel.x + (leftPanel.width - width) / 2,
        y: leftPanel.y + leftPanel.height - 15,
        width,
        height: 12,
        radius: 4,
    };
};

export const getModuleNavRect = (xOffset = 0) => {
    const panel = GuiRectangles.RightPanel;
    return { x: panel.x + PADDING + xOffset, y: 4, width: panel.width - PADDING * 2, height: 26 };
};

export const drawModuleNavBackground = (xOffset = 0) => {
    drawRoundedRectangleWithBorder({
        ...getModuleNavRect(xOffset),
        radius: 8,
        color: THEME.BG_COMPONENT,
        borderWidth: 1,
        borderColor: THEME.BORDER,
    });
};

export const getCategoryContentY = (catObj, panel) =>
    catObj?.subcategories.length > 0 ? getModuleNavRect().y + getModuleNavRect().height + 16 : catObj?.name === 'Dashboard' ? panel.y : panel.y + PADDING;

export const getModuleNavButtonRect = (catObj, index, xOffset = 0) => {
    const navRect = getModuleNavRect(xOffset);
    let layout = moduleNavLayouts.get(catObj);
    if (!layout || layout.revision !== Categories.dataRevision || layout.subcategories !== catObj.subcategories) {
        let x = 4;
        layout = {
            revision: Categories.dataRevision,
            subcategories: catObj.subcategories,
            buttons: ['All', ...catObj.subcategories].map((label) => {
                const width = getTextWidth(label, FontSizes.MEDIUM) + 16;
                const button = { x, width };
                x += width + SUBCATEGORY_BUTTON_SPACING;
                return button;
            }),
        };
        moduleNavLayouts.set(catObj, layout);
    }
    const button = layout.buttons[index];
    return { x: navRect.x + button.x, y: navRect.y + 1, width: button.width, height: navRect.height - 2 };
};

const getModuleNavScrollTarget = (catObj, state = Categories) => {
    const navRect = getModuleNavRect();
    const subcategories = ['All', ...catObj.subcategories];
    const selectedIndex = Math.max(0, subcategories.indexOf(state.selectedSubcategory || 'All'));
    const selectedRect = getModuleNavButtonRect(catObj, selectedIndex);
    const lastRect = getModuleNavButtonRect(catObj, subcategories.length - 1);
    const maxScroll = Math.max(0, lastRect.x + lastRect.width + 4 - (navRect.x + navRect.width));
    return clamp(selectedRect.x + selectedRect.width / 2 - (navRect.x + navRect.width / 2), 0, maxScroll);
};

export const getModuleNavScrollX = (catObj, animate = false, state = Categories) => {
    const target = getModuleNavScrollTarget(catObj, state);
    if (!animate) return state.subcatScrollX;

    const now = Date.now();
    if (state.subcatScrollCategory !== catObj.name) {
        state.subcatScrollCategory = catObj.name;
        state.subcatScrollX = target;
        state.subcatScrollUpdatedAt = now;
        return target;
    }
    const elapsed = now - state.subcatScrollUpdatedAt;
    state.subcatScrollUpdatedAt = now;
    state.subcatScrollX += (target - state.subcatScrollX) * Math.min(1, elapsed / 150);
    return state.subcatScrollX;
};

export const drawSubcategoryButtons = (catObj, mouseX, mouseY, xOffset = 0, drawBackground = true, state = Categories) => {
    const cat = state;
    const scrollX = getModuleNavScrollX(catObj, xOffset === 0, state);

    if (cat.animationRect && xOffset === 0) {
        const elapsed = Date.now() - cat.subcatTransitionStart;
        const rawProgress = Math.min(1, elapsed / cat.subcatAnimationDuration);
        cat.subcatTransitionProgress = easeInOutQuad(rawProgress);
        const p = cat.subcatTransitionProgress;

        cat.animationRect.x = cat.animationRect.startX + (cat.animationRect.endX - cat.animationRect.startX) * p;
        cat.animationRect.width = cat.animationRect.startWidth + (cat.animationRect.endWidth - cat.animationRect.startWidth) * p;
        cat.animationRect.y = cat.animationRect.startY + (cat.animationRect.endY - cat.animationRect.startY) * p;
        cat.animationRect.height = cat.animationRect.startHeight + (cat.animationRect.endHeight - cat.animationRect.startHeight) * p;
        if (rawProgress >= 1) cat.animationRect = null;
    }

    const subcategoriesToDraw = ['All', ...catObj.subcategories];

    if (drawBackground) drawModuleNavBackground(xOffset);

    const drawSelectedButton = (rect, color = THEME.ACCENT_DIM) => {
        drawRoundedRectangle({
            x: rect.x,
            y: rect.y + 2.5,
            width: rect.width,
            height: rect.height - 5,
            radius: 8,
            color,
        });
    };

    if (cat.animationRect) {
        drawSelectedButton({ ...cat.animationRect, x: cat.animationRect.x + xOffset - scrollX });
    }

    subcategoriesToDraw.forEach((subcat) => {
        const rawButtonRect = getModuleNavButtonRect(catObj, subcategoriesToDraw.indexOf(subcat), xOffset);
        const buttonRect = { ...rawButtonRect, x: rawButtonRect.x - scrollX };
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

        if (isSelected) cat.selectedSubcategoryButton = rawButtonRect;

        if (!cat.animationRect) {
            if (isSelected) {
                drawSelectedButton(buttonRect);
            } else if (state.progress > 0) {
                drawSelectedButton(buttonRect, colorWithAlpha(THEME.ACCENT_DIM, state.progress));
            }
        }

        const textColor = isSelected ? THEME.TEXT : THEME.TEXT_MUTED;
        drawText(subcat, buttonRect.x + buttonRect.width / 2, buttonRect.y + buttonRect.height / 2, FontSizes.MEDIUM, textColor, 18);
    });
};

export const drawDirectComponents = (panel, panelX, yOffset, mouseX, mouseY, scrollY, categoryName) => {
    const cat = Categories.categories.find((c) => c.name === categoryName);
    if (!cat || !cat.directComponents) return yOffset;

    const components = getVisibleDirectComponents(categoryName);
    const panelWidth = panel.width;
    let currentY = yOffset - scrollY;

    const layout = layoutDirectComponents(components, yOffset);

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

    layout.sections.forEach((section) => {
        const sectionY = layout.baseY + section.y - scrollY;
        if (sectionY + section.height < panel.y || sectionY > panel.y + panel.height) return;

        const separator = section.separator || (section.separator = new Separator(section.name, true));
        separator.x = panelX + PADDING;
        separator.y = sectionY;
        separator.optionPanelWidth = panelWidth;
        separator.draw(mouseX, mouseY);
    });

    layout.rows.forEach(({ component, y, height }) => {
        const componentY = layout.baseY + y - scrollY;
        if (componentY + height < panel.y || componentY > panel.y + panel.height) {
            component.updateAnimation?.();
            return;
        }

        const isPopup = component instanceof Popup;
        if (typeof component.draw === 'function' || isPopup) {
            component.x = getDirectComponentX(panel, panelX);
            component.y = componentY;
            component.optionPanelWidth = getDirectComponentPanelWidth(panel);
            component.optionPanelHeight = panel.height;
            if (isPopup && typeof component.drawButton === 'function') {
                component.drawButton(mouseX, mouseY);
            } else {
                component.draw(mouseX, mouseY);
            }
        }
    });

    return layout.rows.length > 0 ? yOffset + layout.height : currentY + scrollY;
};

export const drawOptionsPanel = (panel, mouseX, mouseY, macroToggleButton = null, keybindButton = null, documentationButton = null) => {
    const selectedItem = Categories.selectedItem;
    if (!selectedItem) return;

    let optionPanelX = panel.x;
    if (Categories.transitionDirection === 1) optionPanelX += panel.width * (1 - Categories.transitionProgress);
    else if (Categories.transitionDirection === -1) optionPanelX += panel.width * Categories.transitionProgress;

    const optionX = optionPanelX + PADDING;
    const optionY = panel.y + PADDING;
    const scrollY = Categories.optionsScrollY;

    const backButtonText = BACK_TEXT;
    const backButtonX = optionX;
    const backButtonY = optionY + 12;
    const drawnBackY = backButtonY - scrollY;
    const isBackHovered = isInside(mouseX, mouseY, { x: backButtonX, y: drawnBackY, width: BACK_TEXT_WIDTH, height: 10 });

    drawText(backButtonText, backButtonX, drawnBackY + 5, FontSizes.SMALL, isBackHovered ? THEME.TEXT : THEME.TEXT_LINK);
    const drawnTitleY = optionY + 36 - scrollY;
    drawText(selectedItem.title, backButtonX, drawnTitleY + 7, FontSizes.HEADER, THEME.TEXT);
    const drawnDescY = optionY + 52 - scrollY;
    drawText(selectedItem.description, backButtonX, drawnDescY + 5, FontSizes.SMALL, THEME.TEXT_MUTED);

    let buttonRight = optionPanelX + panel.width - PADDING - 10;
    [macroToggleButton, keybindButton, documentationButton].filter(Boolean).forEach((button) => {
        const buttonTextWidth = getTextWidth(button.buttonText, FontSizes.REGULAR);
        const buttonWidth = Math.max(64, buttonTextWidth + 20);
        const titleCenterY = drawnTitleY + 7;

        button.x = buttonRight - buttonWidth;
        button.y = titleCenterY - 11;
        button.optionPanelWidth = buttonWidth;
        button.optionPanelHeight = panel.height;
        button.draw(mouseX, mouseY);
        buttonRight = button.x - 6;
    });

    const dividerY = optionY + 66 - scrollY;
    drawRoundedRectangle({ x: backButtonX, y: dividerY, width: panel.width - PADDING * 2, height: 1, radius: 1, color: THEME.BG_INSET });

    let drawnCompY = optionY + 78 - scrollY;
    selectedItem.components.forEach((component) => {
        if (!isComponentVisible(component)) return;
        const isPopup = component instanceof Popup;
        if (!isPopup && typeof component.draw !== 'function') return;
        const componentHeight = getComponentLayoutHeight(component);

        if (drawnCompY + componentHeight < panel.y || drawnCompY > panel.y + panel.height) {
            component.updateAnimation?.();
            drawnCompY += componentHeight;
            return;
        }

        component.x = optionX;
        component.y = drawnCompY;
        component.optionPanelWidth = panel.width;
        component.optionPanelHeight = panel.height;
        if (isPopup && typeof component.drawButton === 'function') {
            component.drawButton(mouseX, mouseY);
        } else {
            component.draw(mouseX, mouseY);
        }
        drawnCompY += componentHeight;
    });
};

export const drawLeftPanelBackgrounds = (mouseX, mouseY) => {
    const leftPanel = GuiRectangles.LeftPanel;
    const pfpRect = getDiscordPfpRect();
    const pfpY = pfpRect.y;
    const editIconSize = 14;
    const editIconX = leftPanel.x + (leftPanel.width - editIconSize) / 2;
    const editIconY = pfpY - editIconSize - 8;
    const editButtonRect = { x: editIconX - 4, y: editIconY - 4, width: editIconSize + 8, height: editIconSize + 8, radius: 4 };
    const displaySelectedCategory =
        Categories.transitionType === 'page' && Categories.transitionDirection === -1 && Categories.optionsReturnCategory
            ? Categories.optionsReturnCategory
            : Categories.selected;
    const versionRect = getVersionButtonRect();
    const isVersionHovered = isInside(mouseX, mouseY, versionRect);

    drawRoundedRectangleWithBorder({
        ...versionRect,
        color: isVersionHovered ? colorWithAlpha(THEME.ACCENT, 0.12) : THEME.BG_INSET,
        borderWidth: 1,
        borderColor: colorWithAlpha(THEME.ACCENT, 0.45),
    });

    if (Categories.catAnimationRect) {
        const elapsed = Date.now() - Categories.catTransitionStart;
        const rawProgress = Math.min(1, elapsed / Categories.catAnimationDuration);
        const catAnimProgress = easeInOutQuad(rawProgress);
        const rect = Categories.catAnimationRect;
        rect.x = rect.startX + (rect.endX - rect.startX) * catAnimProgress;
        rect.y = rect.startY + (rect.endY - rect.startY) * catAnimProgress;
        if (rect.startRadius !== undefined && rect.endRadius !== undefined) {
            rect.radius = rect.startRadius + (rect.endRadius - rect.startRadius) * catAnimProgress;
        }
        if (rawProgress >= 1) Categories.catAnimationRect = null;
    }

    const allCategoryItems = [
        ...Categories.getVisibleCategories().map((c, i) => ({ name: c.name, rect: getCategoryRect(i) })),
        {
            name: 'Discord',
            rect: { x: pfpRect.x - 2, y: pfpRect.y - 2, width: pfpRect.width + 4, height: pfpRect.height + 4, radius: 16 },
        },
        { name: 'Edit', rect: editButtonRect },
    ];

    const drawHoverHighlight = (rect, color, itemName) => {
        const isSelectionWipingThisItem = Categories.catAnimationRect && itemName === Categories.selected;
        if (!isSelectionWipingThisItem) {
            drawRoundedRectangle({ ...rect, color });
            return;
        }

        const wipeRect = Categories.catAnimationRect;
        const overlapX = Math.max(rect.x, wipeRect.x);
        const overlapRight = Math.min(rect.x + rect.width, wipeRect.x + wipeRect.width);
        if (overlapRight <= overlapX) {
            drawRoundedRectangle({ ...rect, color });
            return;
        }

        if (Categories.transitionDirection >= 0) {
            const wipeBottom = wipeRect.y + wipeRect.height;
            const hasHit = wipeBottom > rect.y;
            if (!hasHit) {
                drawRoundedRectangle({ ...rect, color });
                return;
            }
            const penetration = Math.min(rect.height, Math.max(0, wipeBottom - rect.y));
            const visibleStartY = Math.max(rect.y, Math.min(rect.y + rect.height, wipeBottom));
            const visibleHeight = rect.y + rect.height - visibleStartY;
            if (visibleHeight <= 0) return;
            scissor(rect.x, visibleStartY, rect.width, visibleHeight);
            const r = rect.radius || 0;
            const liveTopRadius = Math.max(0, r - penetration);
            drawRoundedRectangleVaried({ ...rect, tl: liveTopRadius, tr: liveTopRadius, br: r, bl: r, color });
            resetScissor();
            return;
        }

        const wipeTop = wipeRect.y;
        const hasHit = wipeTop < rect.y + rect.height;
        if (!hasHit) {
            drawRoundedRectangle({ ...rect, color });
            return;
        }
        const penetration = Math.min(rect.height, Math.max(0, rect.y + rect.height - wipeTop));
        const visibleEndY = Math.max(rect.y, Math.min(rect.y + rect.height, wipeTop));
        const visibleHeight = visibleEndY - rect.y;
        if (visibleHeight <= 0) return;
        scissor(rect.x, rect.y, rect.width, visibleHeight);
        const r = rect.radius || 0;
        const liveBottomRadius = Math.max(0, r - penetration);
        drawRoundedRectangleVaried({ ...rect, tl: r, tr: r, br: liveBottomRadius, bl: liveBottomRadius, color });
        resetScissor();
    };

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

        if (isHovered) state.progress = Math.min(1, state.progress + delta);
        else state.progress = Math.max(0, state.progress - delta);

        if (state.progress > 0 && (displaySelectedCategory !== name || Categories.catAnimationRect)) {
            const rect = item.rect;
            const easedProgress = easeOutCubic(state.progress);
            const finalRect = { ...item.rect, radius: name === 'Discord' ? 16 : item.rect.radius || 8 };

            drawHoverHighlight(finalRect, colorWithAlpha(THEME.BG_INSET, easedProgress), name);
        }
    });

    // Draw selection after hover so the moving/selected highlight overwrites hover as it arrives.
    if (Categories.catAnimationRect) {
        const rect = Categories.catAnimationRect;
        drawRoundedRectangle({ ...rect, color: THEME.ACCENT_DIM });
        drawRoundedRectangle({ ...rect, color: colorWithAlpha(THEME.ACCENT, 0.16) });
    } else {
        const selectedCat = Categories.getVisibleCategories().find((cat) => cat.name === displaySelectedCategory);
        if (selectedCat) {
            const i = Categories.getVisibleCategories().indexOf(selectedCat);
            const rect = getCategoryRect(i);
            drawRoundedRectangle({ ...rect, radius: 8, color: THEME.ACCENT_DIM });
            drawRoundedRectangle({ ...rect, radius: 8, color: colorWithAlpha(THEME.ACCENT, 0.12) });
        } else if (displaySelectedCategory === 'Discord') {
            drawRoundedRectangle({
                x: pfpRect.x - 2,
                y: pfpRect.y - 2,
                width: pfpRect.width + 4,
                height: pfpRect.height + 4,
                radius: 16,
                color: THEME.ACCENT_DIM,
            });
        } else if (displaySelectedCategory === 'Edit') {
            drawRoundedRectangle({ ...editButtonRect, color: THEME.ACCENT_DIM });
        } else if (displaySelectedCategory === 'Changelog') {
            drawRoundedRectangle({ ...versionRect, color: THEME.ACCENT_DIM });
        }
    }
};

export const drawLeftPanelIcons = (mouseX, mouseY) => {
    Categories.getVisibleCategories().forEach((cat, i) => {
        const rect = getCategoryRect(i);
        const moduleSize = 14;
        const iconX = rect.x + (rect.width - moduleSize) / 2;
        const iconY = rect.y + 3;
        let iconPath = SETTINGS_ICON_PATH;
        if (cat.name === 'Dashboard') iconPath = DASHBOARD_ICON_PATH;
        else if (cat.name === 'Modules') iconPath = MODULE_ICON_PATH;
        else if (cat.name === 'Theme') iconPath = THEME_ICON_PATH;
        drawImage(iconPath, iconX, iconY, moduleSize, moduleSize);
        drawCenteredText(cat.name, rect.x, rect.width, FontSizes.TINY, THEME.TEXT_MUTED, rect.y + 23);
    });

    const leftPanel = GuiRectangles.LeftPanel;
    const pfpRect = getDiscordPfpRect();

    const editIconSize = 14;
    const editIconX = leftPanel.x + (leftPanel.width - editIconSize) / 2;
    const editIconY = pfpRect.y - editIconSize - 8;

    drawImage(EDIT_ICON_PATH, editIconX, editIconY, editIconSize, editIconSize);

    const discordPfpPath = getDiscordPfpPath();
    if (discordPfpPath) {
        drawCircularImage(discordPfpPath, pfpRect.x, pfpRect.y, pfpRect.width);
    }
    const versionRect = getVersionButtonRect();
    drawCenteredText(
        `V${SCRIPT_VERSION}`,
        versionRect.x,
        versionRect.width,
        FontSizes.TINY,
        isInside(mouseX, mouseY, versionRect) ? THEME.TEXT_LINK : THEME.TEXT,
        versionRect.y + versionRect.height / 2
    );
};

const drawItemBox = (item, itemX, itemY, itemWidth, itemHeight, mouseX, mouseY, cachedItemLayouts, isLayoutCacheValid, centerText = false) => {
    if (itemY + itemHeight < GuiRectangles.RightPanel.y || itemY > GuiRectangles.RightPanel.y + GuiRectangles.RightPanel.height) {
        return;
    }

    const isDirectComponent = item && item.type === 'direct-component';
    const isModuleComponent = item && item.type === 'module-component';
    const isThemeComponent = item && item.type === 'theme-component';
    const isStacked = isDirectComponent || isModuleComponent || isThemeComponent;
    const moduleBorderColor = getModuleBorderColor(item.moduleType);
    const itemRect = {
        x: itemX,
        y: itemY,
        width: itemWidth,
        height: itemHeight,
        radius: 10,
        color: THEME.BG_COMPONENT,
        borderWidth: 1,
        borderColor: moduleBorderColor || THEME.BORDER,
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
        drawText(item.title, itemX + 12, titleY, FontSizes.REGULAR, moduleBorderColor || THEME.TEXT);
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
        const maxWidth = itemWidth - 16;
        let layout = titleLayouts.get(item);
        if (!layout || layout.title !== item.title || layout.maxWidth !== maxWidth) {
            const lines = item.title.split(' ').reduce(
                (lines, word) => {
                    const line = lines[lines.length - 1];
                    if (line && getTextWidth(`${line} ${word}`, FontSizes.REGULAR) > maxWidth) lines.push(word);
                    else lines[lines.length - 1] = line ? `${line} ${word}` : word;
                    return lines;
                },
                ['']
            );
            layout = { title: item.title, maxWidth, lines };
            titleLayouts.set(item, layout);
        }
        const lines = layout.lines;
        const lineHeight = 12;
        const textY = itemY + itemHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, index) => {
            drawText(line, centerText ? itemX + itemWidth / 2 : itemX + 12, textY + index * lineHeight, FontSizes.REGULAR, THEME.TEXT, centerText ? 18 : 17);
        });
    }
};

export const drawCategoryItems = (cat, panel, panelX, yOffset, mouseX, mouseY, items, layouts, valid, query = '') => {
    const columns = panel.width < 300 ? 1 : 3;
    const iw = (panel.width - PADDING * 2 - ITEM_SPACING * (columns - 1)) / columns;
    const itemHeight = cat.name === 'Modules' ? 40 : 48;
    const rowHeight = itemHeight + ITEM_SPACING;
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
                if (subIdx % columns === 0 && subIdx > 0) yOffset += rowHeight;
                drawItemBox(item, panelX + PADDING + (subIdx % columns) * (iw + ITEM_SPACING), yOffset, iw, itemHeight, mouseX, mouseY, layouts, valid, true);
                subIdx++;
            });
            if (g.items.length > 0) {
                yOffset += itemHeight;
            }
        } else {
            if (rowIdx % columns === 0 && rowIdx > 0) yOffset += rowHeight;
            drawItemBox(g, panelX + PADDING + (rowIdx % columns) * (iw + ITEM_SPACING), yOffset, iw, itemHeight, mouseX, mouseY, layouts, valid, false);
            rowIdx++;
        }
    });
};
