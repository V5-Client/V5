import { FontSizes, PADDING, THEME, colorWithAlpha, drawRoundedRectangle, drawRoundedRectangleWithBorder, drawText, isInside } from './Utils';
import { getEnabledModulesRevision, modules as registeredModules } from '../utils/MacroState';
import { formatUptime } from '../utils/TimeUtils';
import { area, subArea } from '../utils/Utils';
import { getPing, getPingColor, getTPS, getTpsColor } from '../utils/player/ServerInfo';

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
let activeModules = [];
let activeModulesRevision = -1;

const normalizeLocation = (value) => {
    if (!value || String(value).trim().length === 0) return 'Unknown';
    return String(value);
};

const getActiveModules = () => {
    const revision = getEnabledModulesRevision();
    if (revision === activeModulesRevision) return activeModules;

    activeModules = [];

    registeredModules.forEach((module, name) => {
        if (!module?.enabled) return;
        activeModules.push({
            name,
            subcategory: module.subcategory || 'Other',
            isMacro: module.isMacro === true,
        });
    });

    activeModules.sort((a, b) => {
        const categorySort = a.subcategory.localeCompare(b.subcategory);
        if (categorySort !== 0) return categorySort;
        return a.name.localeCompare(b.name);
    });
    activeModulesRevision = revision;
    return activeModules;
};

const getDebugRows = () => {
    const fps = Client.getFPS();
    const ping = getPing();
    const tps = getTPS();

    return [
        { label: 'FPS', value: String(fps), color: getFpsColor(fps) },
        { label: 'Ping', value: `${ping}ms`, color: (0xff000000 | getPingColor(ping)) >>> 0 },
        { label: 'TPS', value: tps.toFixed(2), color: (0xff000000 | getTpsColor(tps)) >>> 0 },
        { label: 'Client Uptime', value: formatUptime(clientStartedAt) },
        { label: 'Area', value: normalizeLocation(area()) },
        { label: 'Subarea', value: normalizeLocation(subArea()) },
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
    drawCard('Debug Information', x, y, width, height);

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
    drawCard('Active Modules', x, y, width, height);

    let rowY = y + CARD_PADDING + HEADER_TO_FIRST_ROW;

    if (modules.length === 0) {
        drawText('No active modules', x + CARD_PADDING, rowY, FontSizes.REGULAR, THEME.TEXT_MUTED);
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

        const meta = module.isMacro ? `${module.subcategory} macro` : module.subcategory;
        const isHovered = isInside(mouseX, mouseY, rowRect);
        if (isHovered) {
            drawRoundedRectangle({ ...rowRect, radius: 6, color: colorWithAlpha(THEME.BG_INSET, 0.7) });
        }

        drawText(module.name, x + CARD_PADDING, textY, FontSizes.REGULAR, isHovered ? THEME.TEXT_LINK : THEME.TEXT);
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
