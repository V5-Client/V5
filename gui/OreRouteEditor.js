import {
    FontSizes,
    THEME,
    clamp,
    drawRect,
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    drawText,
    getTextWidth,
    getTypedCharacter,
    isInside,
    playClickSound,
} from './Utils';

const ROW_HEIGHT = 30;
const MINE_ROW_HEIGHT = 20;
const ROUTE_MENU_ROW_HEIGHT = 22;
const ROUTE_MENU_VISIBLE_ROWS = 10;
const routeEditorGui = new Gui();

let oreMiner = null;
let routeName = 'route';
let scrollY = 0;
let expandedWaypoint = -1;
let activeField = null;
let status = '';
let routesOpen = false;
let routeNames = [];
let routeScroll = 0;
let fields = { x: '', y: '', z: '', warp: '' };
let layout = { buttons: [], inputs: {}, rows: [], list: null, routeButton: null, routeMenu: null };

const currentWaypoint = () => oreMiner?.loadedWaypoints?.[oreMiner.selectedWaypoint] || null;

const syncFields = () => {
    const waypoint = currentWaypoint();
    fields = waypoint
        ? { x: String(waypoint.pos.x), y: String(waypoint.pos.y), z: String(waypoint.pos.z), warp: String(waypoint.warpCommand || '') }
        : { x: '', y: '', z: '', warp: '' };
};

const routeNameFromPath = (path) => {
    const filename = String(path || '')
        .replace(/\\/g, '/')
        .split('/')
        .pop();
    return filename ? filename.replace(/\.json$/i, '') : 'route';
};

const commitField = () => {
    if (!activeField || !oreMiner) return;
    const field = activeField;
    activeField = null;

    if (field === 'route') {
        routeName = routeName.trim() || 'route';
        return;
    }

    const waypoint = currentWaypoint();
    if (!waypoint) return;
    if (field === 'warp') {
        const value = fields.warp.trim();
        if (value !== waypoint.warpCommand) {
            oreMiner.recordUndo();
            waypoint.warpCommand = value;
        }
        return;
    }

    const value = Number(fields[field]);
    if (!Number.isFinite(value)) {
        fields[field] = String(waypoint.pos[field]);
        status = `${field.toUpperCase()} must be a number.`;
        return;
    }
    const coordinate = Math.floor(value);
    if (coordinate !== waypoint.pos[field]) {
        oreMiner.recordUndo();
        waypoint.pos[field] = coordinate;
        fields[field] = String(coordinate);
    }
};

const mutateSelected = (callback) => {
    const waypoint = currentWaypoint();
    if (!waypoint) return;
    commitField();
    oreMiner.recordUndo();
    callback(waypoint);
    syncFields();
};

const addWaypoint = (type) => {
    commitField();
    oreMiner.addWaypoint(type);
    oreMiner.selectedWaypoint = oreMiner.loadedWaypoints.length - 1;
    expandedWaypoint = oreMiner.selectedWaypoint;
    syncFields();
    status = `Added ${type === 'tp' ? 'Tp' : 'Walk'} waypoint at your current position.`;
};

const addMineable = (type) => {
    commitField();
    const before = currentWaypoint()?.minableBlocks.length || 0;
    oreMiner.addMineBlock(type, oreMiner.selectedWaypoint);
    const after = currentWaypoint()?.minableBlocks.length || 0;
    status = after > before ? 'Added the block under your crosshair.' : 'Look at a block within 10 blocks.';
};

const loadRoute = (name) => {
    const warning = `Unsaved changes. Choose ${name} again to discard them.`;
    if (oreMiner.undoStack.length && status !== warning) {
        status = warning;
        return;
    }
    if (!oreMiner.loadRoute(name)) {
        status = `Could not load ${name}.`;
        return;
    }
    routeName = routeNameFromPath(oreMiner.loadedPath);
    expandedWaypoint = oreMiner.selectedWaypoint;
    scrollY = 0;
    routesOpen = false;
    syncFields();
    status = `Loaded ${routeName}.json`;
};

const drawButton = (text, rect, action, selected = false, danger = false) => {
    layout.buttons.push({ rect, action });
    drawRoundedRectangleWithBorder({
        ...rect,
        radius: 6,
        color: selected ? THEME.ACCENT_DIM : danger ? THEME.NOTIF_ERROR : THEME.BG_COMPONENT,
        borderWidth: 1,
        borderColor: selected ? THEME.ACCENT : THEME.BORDER,
    });
    drawText(text, rect.x + (rect.width - getTextWidth(text, FontSizes.SMALL)) / 2, rect.y + rect.height / 2, FontSizes.SMALL, THEME.TEXT);
};

const drawInput = (name, value, rect, placeholder = '') => {
    layout.inputs[name] = rect;
    drawRoundedRectangleWithBorder({
        ...rect,
        radius: 6,
        color: THEME.BG_INSET,
        borderWidth: 1,
        borderColor: activeField === name ? THEME.ACCENT : THEME.BORDER,
    });
    const text = value || placeholder;
    drawText(text, rect.x + 7, rect.y + rect.height / 2, FontSizes.REGULAR, value ? THEME.TEXT : THEME.TEXT_MUTED);
    if (activeField === name && Date.now() % 1000 < 500) {
        const cursorX = Math.min(rect.x + rect.width - 5, rect.x + 7 + getTextWidth(text, FontSizes.REGULAR));
        drawRect({ x: cursorX, y: rect.y + 5, width: 1, height: rect.height - 10, color: THEME.TEXT });
    }
};

const waypointHeight = (waypoint, index) => {
    if (index !== expandedWaypoint || waypoint.type === 'Warp') return ROW_HEIGHT;
    return ROW_HEIGHT + 8 + waypoint.minableBlocks.length * MINE_ROW_HEIGHT + 26;
};

const drawWaypointList = (mouseX, mouseY, rect) => {
    const waypoints = oreMiner.loadedWaypoints || [];
    const contentHeight = waypoints.reduce((height, waypoint, index) => height + waypointHeight(waypoint, index) + 4, 0);
    scrollY = clamp(scrollY, 0, Math.max(0, contentHeight - rect.height));
    layout.list = rect;

    NVG.save();
    NVG.scissor(rect.x, rect.y, rect.width, rect.height);
    let y = rect.y - scrollY;
    waypoints.forEach((waypoint, index) => {
        const height = waypointHeight(waypoint, index);
        const row = { x: rect.x, y, width: rect.width, height: ROW_HEIGHT, index };
        if (row.y + row.height >= rect.y && row.y <= rect.y + rect.height) layout.rows.push(row);
        drawRoundedRectangle({
            x: row.x,
            y: row.y,
            width: row.width,
            height,
            radius: 7,
            color: index === oreMiner.selectedWaypoint ? THEME.ACCENT_DIM : isInside(mouseX, mouseY, row) ? THEME.HOVER : THEME.BG_COMPONENT,
        });

        const expandable = waypoint.type !== 'Warp';
        drawText(expandable ? (index === expandedWaypoint ? '▼' : '▶') : '•', row.x + 8, row.y + ROW_HEIGHT / 2, FontSizes.SMALL, THEME.TEXT_MUTED);
        drawText(`[${index}] ${waypoint.type}`, row.x + 24, row.y + ROW_HEIGHT / 2, FontSizes.REGULAR, THEME.TEXT);
        const coordinates = `${waypoint.pos.x}, ${waypoint.pos.y}, ${waypoint.pos.z}`;
        drawText(coordinates, row.x + row.width - 8 - getTextWidth(coordinates, FontSizes.SMALL), row.y + ROW_HEIGHT / 2, FontSizes.SMALL, THEME.TEXT_MUTED);

        if (index === expandedWaypoint && expandable) {
            let mineY = row.y + ROW_HEIGHT + 4;
            waypoint.minableBlocks.forEach((block, mineIndex) => {
                const flag = block.oneTap ? '1T' : block.rOneTap ? 'RT' : 'M';
                drawText(`${flag} ${block.x}, ${block.y}, ${block.z}`, row.x + 24, mineY + MINE_ROW_HEIGHT / 2, FontSizes.SMALL, THEME.TEXT_MUTED);
                const removeRect = { x: row.x + row.width - 26, y: mineY + 2, width: 18, height: 16 };
                if (removeRect.y + removeRect.height >= rect.y && removeRect.y <= rect.y + rect.height) {
                    drawButton('×', removeRect, () => oreMiner.removeRoutePoint(index, mineIndex));
                }
                mineY += MINE_ROW_HEIGHT;
            });
            const buttonY = row.y + height - 22;
            const buttonWidth = (row.width - 32) / 3;
            if (buttonY + 18 >= rect.y && buttonY <= rect.y + rect.height) {
                drawButton('+ Mine', { x: row.x + 8, y: buttonY, width: buttonWidth, height: 18 }, () => addMineable('mine'));
                drawButton('+ 1 Tap', { x: row.x + 16 + buttonWidth, y: buttonY, width: buttonWidth, height: 18 }, () => addMineable('onetap'));
                drawButton('+ R Tap', { x: row.x + 24 + buttonWidth * 2, y: buttonY, width: buttonWidth, height: 18 }, () => addMineable('ronetap'));
            }
        }
        y += height + 4;
    });
    NVG.restore();

    if (!waypoints.length) drawText('Add a Tp or Walk waypoint to begin.', rect.x + 12, rect.y + 18, FontSizes.REGULAR, THEME.TEXT_MUTED);
};

const drawDetails = (rect) => {
    const waypoint = currentWaypoint();
    drawRoundedRectangleWithBorder({
        x: rect.x + 1,
        y: rect.y + 1,
        width: rect.width - 2,
        height: rect.height - 2,
        radius: 7,
        color: THEME.BG_COMPONENT,
        borderWidth: 1,
        borderColor: THEME.BORDER,
    });
    if (!waypoint) {
        drawText('No waypoint selected', rect.x + 16, rect.y + 22, FontSizes.HEADER, THEME.TEXT_MUTED);
        return;
    }

    drawText(`Waypoint [${oreMiner.selectedWaypoint}]`, rect.x + 16, rect.y + 22, FontSizes.HEADER, THEME.TEXT);
    const typeY = rect.y + 40;
    drawText('Type', rect.x + 16, typeY + 10, FontSizes.REGULAR, THEME.TEXT_MUTED);
    drawButton(
        'Tp',
        { x: rect.x + 68, y: typeY, width: 54, height: 20 },
        () =>
            mutateSelected((entry) => {
                entry.type = 'Tp';
                delete entry.warpCommand;
            }),
        waypoint.type === 'Tp'
    );
    drawButton(
        'Walk',
        { x: rect.x + 130, y: typeY, width: 58, height: 20 },
        () =>
            mutateSelected((entry) => {
                entry.type = 'Walk';
                delete entry.warpCommand;
            }),
        waypoint.type === 'Walk'
    );

    const inputWidth = Math.max(50, (rect.width - 48) / 3);
    const coordinateY = typeY + 44;
    ['x', 'y', 'z'].forEach((axis, index) => {
        const x = rect.x + 16 + index * (inputWidth + 8);
        drawText(axis.toUpperCase(), x, coordinateY - 8, FontSizes.SMALL, THEME.TEXT_MUTED);
        drawInput(axis, fields[axis], { x, y: coordinateY, width: inputWidth, height: 22 });
    });

    const actionY = coordinateY + 38;
    drawButton('Use Current Position', { x: rect.x + 16, y: actionY, width: 130, height: 22 }, () =>
        mutateSelected((entry) => {
            entry.pos = { x: Math.floor(Player.getX()), y: Math.floor(Player.getY()) - 1, z: Math.floor(Player.getZ()) };
        })
    );
    drawButton(
        'Delete',
        { x: rect.x + rect.width - 76, y: actionY, width: 60, height: 22 },
        () => {
            const index = oreMiner.selectedWaypoint;
            oreMiner.removeRoutePoint(index);
            oreMiner.selectedWaypoint = Math.min(index, oreMiner.loadedWaypoints.length - 1);
            expandedWaypoint = oreMiner.selectedWaypoint;
            syncFields();
        },
        false,
        true
    );

    if (waypoint.type === 'Warp') {
        drawText('Warp destination', rect.x + 16, actionY + 48, FontSizes.SMALL, THEME.TEXT_MUTED);
        drawInput('warp', fields.warp, { x: rect.x + 16, y: actionY + 56, width: rect.width - 32, height: 22 }, 'forge');
    } else {
        drawText(
            `${waypoint.minableBlocks.length} mineable block${waypoint.minableBlocks.length === 1 ? '' : 's'}`,
            rect.x + 16,
            actionY + 58,
            FontSizes.REGULAR,
            THEME.TEXT_MUTED
        );
    }
};

const drawRouteMenu = (mouseX, mouseY, anchor) => {
    if (!routesOpen) return;
    const visibleRows = Math.min(ROUTE_MENU_VISIBLE_ROWS, Math.max(1, routeNames.length));
    const width = Math.max(150, Math.min(220, Math.max(...routeNames.map((name) => getTextWidth(name, FontSizes.REGULAR) + 24), 0)));
    const menu = {
        x: anchor.x,
        y: anchor.y + anchor.height + 4,
        width,
        height: visibleRows * ROUTE_MENU_ROW_HEIGHT + 8,
    };
    layout.routeMenu = menu;
    drawRoundedRectangleWithBorder({ ...menu, radius: 7, color: THEME.BG_COMPONENT, borderWidth: 1, borderColor: THEME.BORDER });

    if (!routeNames.length) {
        drawText('No saved routes', menu.x + 10, menu.y + menu.height / 2, FontSizes.REGULAR, THEME.TEXT_MUTED);
        return;
    }

    routeScroll = clamp(routeScroll, 0, Math.max(0, routeNames.length - ROUTE_MENU_VISIBLE_ROWS));
    routeNames.slice(routeScroll, routeScroll + ROUTE_MENU_VISIBLE_ROWS).forEach((name, index) => {
        const row = { x: menu.x + 4, y: menu.y + 4 + index * ROUTE_MENU_ROW_HEIGHT, width: menu.width - 8, height: ROUTE_MENU_ROW_HEIGHT };
        layout.buttons.push({ rect: row, action: () => loadRoute(name) });
        if (name === routeName || isInside(mouseX, mouseY, row)) {
            drawRoundedRectangle({ ...row, radius: 5, color: name === routeName ? THEME.ACCENT_DIM : THEME.HOVER });
        }
        drawText(name, row.x + 8, row.y + row.height / 2, FontSizes.REGULAR, name === routeName ? THEME.TEXT : THEME.TEXT_MUTED);
    });
};

const drawEditor = (mouseX, mouseY) => {
    const screenWidth = Renderer.screen.getWidth();
    const screenHeight = Renderer.screen.getHeight();
    const panel = {
        width: Math.min(820, screenWidth - 20),
        height: Math.min(500, screenHeight - 20),
    };
    panel.x = (screenWidth - panel.width) / 2;
    panel.y = (screenHeight - panel.height) / 2;
    layout = { buttons: [], inputs: {}, rows: [], list: null, routeButton: null, routeMenu: null };

    drawRect({ x: 0, y: 0, width: screenWidth, height: screenHeight, color: THEME.BG_OVERLAY });
    drawRoundedRectangleWithBorder({ ...panel, radius: 12, color: THEME.BG_WINDOW, borderWidth: 1, borderColor: THEME.BORDER_ACCENT });
    const compactHeader = panel.width < 500;
    const sidePadding = compactHeader ? 8 : 16;
    const buttonGap = compactHeader ? 4 : 8;
    const sectionGap = compactHeader ? 4 : 16;
    const headerY = panel.y + 10;
    layout.routeButton = { x: panel.x + sidePadding, y: headerY, width: compactHeader ? 56 : 92, height: 24 };
    const closeButton = { x: panel.x + panel.width - sidePadding - (compactHeader ? 50 : 82), y: headerY, width: compactHeader ? 50 : 82, height: 24 };
    const saveButton = { x: closeButton.x - buttonGap - (compactHeader ? 44 : 62), y: headerY, width: compactHeader ? 44 : 62, height: 24 };
    const undoButton = { x: saveButton.x - buttonGap - (compactHeader ? 44 : 62), y: headerY, width: compactHeader ? 44 : 62, height: 24 };
    const routeInputX = layout.routeButton.x + layout.routeButton.width + sectionGap;
    const routeInput = { x: routeInputX, y: headerY, width: Math.max(1, undoButton.x - sectionGap - routeInputX), height: 24 };
    drawInput('route', routeName, routeInput, 'route name');
    drawButton('Routes', layout.routeButton, () => {
        commitField();
        routesOpen = !routesOpen;
        if (routesOpen) {
            routeNames = oreMiner.getRouteNames();
            routeScroll = clamp(routeScroll, 0, Math.max(0, routeNames.length - ROUTE_MENU_VISIBLE_ROWS));
        }
    });
    drawButton('Undo', undoButton, () => {
        commitField();
        oreMiner.undoRouteEdit();
        expandedWaypoint = oreMiner.selectedWaypoint;
        syncFields();
    });
    drawButton('Save', saveButton, () => {
        commitField();
        if (!oreMiner.loadedWaypoints.length) {
            status = 'Add a waypoint before saving.';
            return;
        }
        oreMiner.saveRoute(routeName);
        routeName = routeNameFromPath(oreMiner.loadedPath);
        status = `Saved ${routeName}.json`;
    });
    drawButton('Close', closeButton, () => Client.currentGui.close());

    const contentY = panel.y + 46;
    const footerY = panel.y + panel.height - 40;
    const leftWidth = Math.min(360, panel.width * 0.46);
    const listRect = { x: panel.x + 12, y: contentY, width: leftWidth, height: footerY - contentY - 6 };
    drawWaypointList(mouseX, mouseY, listRect);
    drawDetails({
        x: listRect.x + listRect.width + 10,
        y: contentY,
        width: panel.x + panel.width - 12 - (listRect.x + listRect.width + 10),
        height: listRect.height,
    });

    drawButton('+ Tp at Current', { x: panel.x + 13, y: footerY + 6, width: 118, height: 24 }, () => addWaypoint('tp'));
    drawButton('+ Walk at Current', { x: panel.x + 139, y: footerY + 6, width: 128, height: 24 }, () => addWaypoint('walk'));
    drawText(
        status || 'Changes stay in memory until Save is clicked.',
        panel.x + 280,
        footerY + 18,
        FontSizes.SMALL,
        status ? THEME.TEXT_LINK : THEME.TEXT_MUTED
    );
    drawRouteMenu(mouseX, mouseY, layout.routeButton);
};

const activateField = (name) => {
    commitField();
    activeField = name;
};

routeEditorGui.registerClicked((mouseX, mouseY, button) => {
    if (button !== 0 || !oreMiner) return;
    if (routesOpen && !isInside(mouseX, mouseY, layout.routeButton) && (!layout.routeMenu || !isInside(mouseX, mouseY, layout.routeMenu))) routesOpen = false;
    const input = Object.keys(layout.inputs).find((name) => isInside(mouseX, mouseY, layout.inputs[name]));
    if (input) return activateField(input);
    commitField();

    const clickedButton = [...layout.buttons].reverse().find((entry) => isInside(mouseX, mouseY, entry.rect));
    if (clickedButton) {
        playClickSound();
        clickedButton.action();
        return;
    }

    const row = layout.rows.find((entry) => isInside(mouseX, mouseY, entry));
    if (row) {
        expandedWaypoint = row.index === expandedWaypoint ? -1 : row.index;
        oreMiner.selectedWaypoint = row.index;
        syncFields();
        playClickSound();
    }
});

routeEditorGui.registerScrolled((mouseX, mouseY, direction) => {
    if (routesOpen && layout.routeMenu && isInside(mouseX, mouseY, layout.routeMenu)) {
        routeScroll = clamp(routeScroll - direction, 0, Math.max(0, routeNames.length - ROUTE_MENU_VISIBLE_ROWS));
        return;
    }
    if (layout.list && isInside(mouseX, mouseY, layout.list)) scrollY = Math.max(0, scrollY - direction * ROW_HEIGHT * 2);
});

routeEditorGui.registerClosed(() => {
    commitField();
    routesOpen = false;
    oreMiner = null;
});

register('guiKey', (char, keyCode, gui, event) => {
    if (!routeEditorGui.isOpen() || !activeField) return;
    if (keyCode === 256 || keyCode === 257) {
        commitField();
        cancel(event);
        return;
    }

    const key = activeField;
    let value = key === 'route' ? routeName : fields[key];
    if (keyCode === 259) value = value.slice(0, -1);
    else if (char && String(char).length === 1) {
        const typed = getTypedCharacter(String(char));
        if (!['x', 'y', 'z'].includes(key) || /[\d-]/.test(typed)) value += typed;
    } else return;

    if (key === 'route') routeName = value;
    else fields[key] = value;
    cancel(event);
});

NVG.registerV5Render(() => {
    if (!routeEditorGui.isOpen()) return;
    try {
        NVG.beginFrame(Renderer.screen.getWidth(), Renderer.screen.getHeight());
        drawEditor(Client.getMouseX(), Client.getMouseY());
    } catch (error) {
        console.error('[Ore Route Editor] Render error:', error);
    } finally {
        NVG.endFrame();
    }
});

export const oreRouteEditor = {
    open(module) {
        if (module.routeActive) return module.message('&cStop Ore Miner before opening the route editor.');
        oreMiner = module;
        oreMiner.loadedWaypoints ||= [];
        oreMiner.editing = true;
        oreMiner.selectedWaypoint = clamp(oreMiner.selectedWaypoint, 0, Math.max(0, oreMiner.loadedWaypoints.length - 1));
        routeName = routeNameFromPath(oreMiner.loadedPath);
        expandedWaypoint = oreMiner.loadedWaypoints.length ? oreMiner.selectedWaypoint : -1;
        scrollY = 0;
        activeField = null;
        routesOpen = false;
        status = '';
        syncFields();
        routeEditorGui.open();
    },
};
