import { FontSizes, PADDING, THEME, colorWithAlpha, drawRoundedRectangle, drawRoundedRectangleWithBorder, drawText, isInside } from './Utils';
import { modules as registeredModules } from '../utils/MacroState';
import { formatUptime } from '../utils/TimeUtils';
import { area, subArea } from '../utils/Utils';
import { getPing, getPingColor, getTPS, getTpsColor } from '../utils/player/ServerInfo';
import { t, translationKey } from '../utils/I18n';

const clientStartedAt = Date.now();

const CARD_GAP = 10;
const CARD_PADDING = 12;
const CARD_RADIUS = 10;
const ROW_HEIGHT = 20;
const MODULE_ROW_HEIGHT = 22;
const EMPTY_STATE_HEIGHT = 24;
const HEADER_TO_FIRST_ROW = 24;
const CARD_BOTTOM_PADDING = 4;

let lastModuleLayouts = [];

const normalizeLocation = (value) => {
    if (!value || String(value).trim().length === 0) return t('dashboard.unknown');
    return String(value);
};

const getActiveModules = () => {
    const activeModules = [];

    registeredModules.forEach((module, name) => {
        if (!module?.enabled) return;
        activeModules.push({
            name,
            nameKey: module.nameKey,
            subcategory: module.subcategory || 'Other',
            isMacro: module.isMacro === true,
        });
    });

    return activeModules.sort((a, b) => {
        const categorySort = a.subcategory.localeCompare(b.subcategory);
        if (categorySort !== 0) return categorySort;
        return a.name.localeCompare(b.name);
    });
};

const getDebugRows = () => {
    const fps = Client.getFPS();
    const ping = getPing();
    const tps = getTPS();

    return [
        { label: t('dashboard.fps'), value: String(fps), color: getFpsColor(fps) },
        { label: t('dashboard.ping'), value: `${ping}ms`, color: (0xff000000 | getPingColor(ping)) >>> 0 },
        { label: t('dashboard.tps'), value: tps.toFixed(2), color: (0xff000000 | getTpsColor(tps)) >>> 0 },
        { label: t('dashboard.clientUptime'), value: formatUptime(clientStartedAt) },
        { label: t('dashboard.area'), value: normalizeLocation(area()) },
        { label: t('dashboard.subarea'), value: normalizeLocation(subArea()) },
    ];
};

const getFpsColor = (fps) => {
    if (fps < 20) return 0xffff5555;
    if (fps < 50) return 0xffffaa00;
    if (fps > 100) return 0xff00aa00;
    return 0xff55ff55;
};

const getCardHeight = (rowCount, rowHeight = ROW_HEIGHT) =>
    CARD_PADDING + HEADER_TO_FIRST_ROW + Math.max(rowCount - 1, 0) * rowHeight + CARD_PADDING + CARD_BOTTOM_PADDING;

const drawCard = (title, x, y, width, height) => {
    drawRoundedRectangleWithBorder({
        x,
        y,
        width,
        height,
        radius: CARD_RADIUS,
        color: THEME.BG_COMPONENT,
        borderWidth: 1,
        borderColor: THEME.BORDER,
    });

    drawText(title, x + CARD_PADDING, y + CARD_PADDING + 5, FontSizes.HEADER, THEME.TEXT);
};

const drawDebugCard = (x, y, width) => {
    const rows = getDebugRows();
    const height = getCardHeight(rows.length);
    drawCard(t('dashboard.debugInformation'), x, y, width, height);

    const labelX = x + CARD_PADDING;
    const valueRightX = x + width - CARD_PADDING;
    let rowY = y + CARD_PADDING + HEADER_TO_FIRST_ROW;

    rows.forEach((row) => {
        const value = String(row.value);
        drawText(row.label, labelX, rowY, FontSizes.REGULAR, THEME.TEXT_MUTED);
        drawText(value, valueRightX, rowY, FontSizes.REGULAR, row.color || THEME.TEXT, 20);
        rowY += ROW_HEIGHT;
    });

    return height;
};

const drawModulesCard = (panel, x, y, width, mouseX, mouseY) => {
    const modules = getActiveModules();
    const rowCount = modules.length > 0 ? modules.length : 1;
    const height = getCardHeight(rowCount, modules.length > 0 ? MODULE_ROW_HEIGHT : EMPTY_STATE_HEIGHT);
    lastModuleLayouts = [];
    drawCard(t('dashboard.activeModules'), x, y, width, height);

    let rowY = y + CARD_PADDING + HEADER_TO_FIRST_ROW;

    if (modules.length === 0) {
        drawText(t('dashboard.noActiveModules'), x + CARD_PADDING, rowY, FontSizes.REGULAR, THEME.TEXT_MUTED);
        return height;
    }

    modules.forEach((module) => {
        const textY = rowY;
        const rowHitPaddingY = 1;
        const rowRect = {
            x: x + CARD_PADDING - 4,
            y: textY - MODULE_ROW_HEIGHT / 2 + rowHitPaddingY,
            width: width - CARD_PADDING * 2 + 8,
            height: MODULE_ROW_HEIGHT - rowHitPaddingY * 2,
        };
        lastModuleLayouts.push({ name: module.name, rect: rowRect });
        rowY += MODULE_ROW_HEIGHT;
        if (rowRect.y + rowRect.height < panel.y || rowRect.y > panel.y + panel.height) return;

        const meta = module.isMacro
            ? `${t(translationKey('categories.subcategory', module.subcategory), {}, module.subcategory)} ${t('dashboard.macroSuffix')}`
            : t(translationKey('categories.subcategory', module.subcategory), {}, module.subcategory);
        const isHovered = isInside(mouseX, mouseY, rowRect);
        if (isHovered) {
            drawRoundedRectangle({ ...rowRect, radius: 6, color: colorWithAlpha(THEME.BG_INSET, 0.7) });
        }

        drawText(t(module.nameKey || module.name, {}, module.name), x + CARD_PADDING, textY, FontSizes.REGULAR, isHovered ? THEME.TEXT_LINK : THEME.TEXT);
        drawText(meta, x + width - CARD_PADDING, textY, FontSizes.SMALL, THEME.TEXT_MUTED, 20);
    });

    return height;
};

export const getDashboardContentHeight = () => {
    const modules = getActiveModules();
    const debugHeight = getCardHeight(getDebugRows().length);
    const modulesHeight = getCardHeight(modules.length > 0 ? modules.length : 1, modules.length > 0 ? MODULE_ROW_HEIGHT : EMPTY_STATE_HEIGHT);
    return PADDING + debugHeight + CARD_GAP + modulesHeight + PADDING;
};

export const drawDashboard = (panel, panelX, yOffset, mouseX, mouseY, scrollY) => {
    const x = panelX + PADDING;
    const width = panel.width - PADDING * 2;
    let y = yOffset - scrollY;

    const debugHeight = drawDebugCard(x, y, width);
    y += debugHeight + CARD_GAP;
    drawModulesCard(panel, x, y, width, mouseX, mouseY);
};

export const getDashboardModuleAt = (mouseX, mouseY) => {
    const match = lastModuleLayouts.find((layout) => isInside(mouseX, mouseY, layout.rect));
    return match?.name || null;
};
