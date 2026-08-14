import { GuiRectangles, GuiState } from './core/GuiState';
import { FontSizes, PADDING, THEME, drawImage, drawRoundedRectangle, drawRoundedRectangleWithBorder, drawText, getTextWidth, isInside } from './Utils';
import { loadSettings } from './GuiSave';
import { getEnabledMacros, getModule, modules as registeredModules } from '../utils/MacroState';
import { globalAssetsDir } from '../utils/Constants';
import { Categories } from './categories/CategorySystem';
import { drawSubcategoryButtons, getModuleBorderColor, getModuleNavButtonRect, getModuleNavRect, getModuleNavScrollX } from './categories/CategoryRenderer';
import { getConfigFile, writeConfigFile } from '../utils/Utils';
import { v5Command } from '../utils/V5Commands';

const ROW_HEIGHT = 28;
const FAVORITES_FILE = 'macro-toggle.json';
const SETTINGS_ICON_PATH = `${globalAssetsDir.getPath()}/settings.svg`;
const InputConstants = com.mojang.blaze3d.platform.InputConstants;
const KeyMapping = net.minecraft.client.KeyMapping;

let query = '';
let queryFocused = false;
let favoritesOnly = false;
let bindingModule = null;
let scrollY = 0;
let layout = {};
let favorites = new Set();
const macroCategory = { name: 'Macro Toggle', subcategories: [] };
const macroCategoryState = {
    selectedSubcategory: null,
    subcatScrollCategory: null,
    subcatScrollX: 0,
    subcatScrollUpdatedAt: 0,
    hoverStates: {},
};

const loadFavorites = () => {
    const saved = getConfigFile(FAVORITES_FILE);
    favorites = new Set(Array.isArray(saved?.favorites) ? saved.favorites.filter((name) => typeof name === 'string') : []);
};

const saveFavorites = () => writeConfigFile(FAVORITES_FILE, { favorites: Array.from(favorites) });

const getMacros = () =>
    Array.from(registeredModules.values())
        .filter(
            (module) =>
                module?.isMacro &&
                (!macroCategoryState.selectedSubcategory || module.subcategory === macroCategoryState.selectedSubcategory) &&
                (!favoritesOnly || favorites.has(module.name)) &&
                module.name.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => Number(favorites.has(b.name)) - Number(favorites.has(a.name)) || a.name.localeCompare(b.name));

const syncCategories = () => {
    macroCategory.subcategories = Categories.categories.find((entry) => entry.name === 'Modules')?.subcategories || [];
};

const getRows = () => {
    const macros = getMacros();
    if (macroCategoryState.selectedSubcategory) return macros.map((module) => ({ module }));

    const rows = [];
    macroCategory.subcategories.forEach((subcategory) => {
        const modules = macros.filter((module) => module.subcategory === subcategory);
        if (modules.length) rows.push({ subcategory }, ...modules.map((module) => ({ module })));
    });
    return rows;
};

const getKeyName = (keybind) => {
    const keyCode = keybind?.getKeyCode?.();
    return keyCode === undefined || keyCode === null || keyCode <= 0 ? 'Unbound' : InputConstants.Type.KEYSYM.getOrCreate(keyCode).getDisplayName().getString();
};

const setMacroKeybind = (module, keyCode) => {
    const mapping = Client.getMinecraft().options.keyMappings.find((entry) => entry.getName() === module._wrappedKeyTitle);
    if (!mapping) return;

    mapping.setKey(keyCode === 256 ? InputConstants.getKey('key.keyboard.unknown') : InputConstants.Type.KEYSYM.getOrCreate(keyCode));
    KeyMapping.resetMapping();
    module._saveKey(module._wrappedKeyTitle, keyCode === 256 ? Keyboard.KEY_NONE : keyCode);
};

const drawButton = (rect, text, active = false) => {
    drawRoundedRectangle({
        ...rect,
        radius: 6,
        color: active ? THEME.ACCENT_DIM : THEME.BG_INSET,
    });
    drawText(
        text,
        rect.x + (rect.width - getTextWidth(text, FontSizes.SMALL)) / 2,
        rect.y + rect.height / 2,
        FontSizes.SMALL,
        active ? THEME.TEXT : THEME.TEXT_MUTED
    );
};

export const macroToggleGui = {
    open() {
        loadFavorites();
        query = '';
        queryFocused = false;
        favoritesOnly = false;
        bindingModule = null;
        macroCategoryState.selectedSubcategory = null;
        scrollY = 0;
        GuiState.macroToggleOpen = true;
        GuiState.isOpening = true;
        GuiState.openStartTime = Date.now();
        loadSettings();
        GuiState.myGui.open();
    },

    draw(mouseX, mouseY) {
        syncCategories();
        const panel = GuiRectangles.RightPanel;
        const rows = getRows();
        const x = panel.x + PADDING;
        const y = panel.y + PADDING;
        const width = panel.width - PADDING * 2;
        const nav = getModuleNavRect();
        const listY = nav.y + nav.height + 42;
        const listHeight = panel.height - (listY - panel.y) - PADDING;
        const maxScroll = Math.max(0, rows.reduce((height, row) => height + (row.subcategory ? 20 : ROW_HEIGHT), 0) - listHeight);
        scrollY = Math.max(0, Math.min(scrollY, maxScroll));

        layout = {
            nav,
            filter: { x, y: nav.y + nav.height + 8, width: 76, height: 24 },
            search: {
                x: x + 82,
                y: nav.y + nav.height + 8,
                width: width - 82,
                height: 24,
            },
            settings: {
                x: nav.x + nav.width - 26,
                y: nav.y + 1,
                width: 24,
                height: nav.height - 2,
            },
            list: { x, y: listY, width, height: listHeight },
            rows: [],
        };

        drawRoundedRectangleWithBorder({
            ...panel,
            radius: panel.radius,
            color: THEME.BG_WINDOW,
            borderWidth: 1,
            borderColor: THEME.BORDER_ACCENT,
        });
        drawSubcategoryButtons(macroCategory, mouseX, mouseY, 0, true, macroCategoryState);
        drawImage(SETTINGS_ICON_PATH, layout.settings.x + 5, layout.settings.y + 5, 14, 14);
        drawButton(layout.filter, favoritesOnly ? 'Favorites' : 'All', favoritesOnly);
        drawRoundedRectangleWithBorder({
            ...layout.search,
            radius: 6,
            color: queryFocused ? THEME.BG_INSET : THEME.BG_COMPONENT,
            borderWidth: 1,
            borderColor: THEME.BORDER,
        });
        drawText(query || 'Filter macros...', layout.search.x + 8, layout.search.y + 12, FontSizes.SMALL, query ? THEME.TEXT : THEME.TEXT_MUTED);

        Render2D.save();
        Render2D.scissor(layout.list.x, layout.list.y, layout.list.width, layout.list.height);
        let rowY = listY - scrollY;
        const listBottom = listY + listHeight;
        rows.forEach((entry) => {
            if (entry.subcategory) {
                if (rowY + 20 >= listY && rowY <= listBottom) {
                    drawText(entry.subcategory, x + 8, rowY + 10, FontSizes.SMALL, THEME.TEXT_MUTED);
                }
                rowY += 20;
                return;
            }

            const { module } = entry;
            const row = { x, y: rowY, width, height: ROW_HEIGHT, module };
            rowY += ROW_HEIGHT;
            row.keybind = {
                x: row.x + row.width - 104,
                y: row.y,
                width: 104,
                height: row.height,
            };
            layout.rows.push(row);
            if (row.y + row.height < listY || row.y > listBottom) return;

            const keyName = bindingModule === module ? 'Press a key...' : getKeyName(module._wrappedKey);
            if (isInside(mouseX, mouseY, row) || module.enabled) {
                drawRoundedRectangle({
                    ...row,
                    radius: 6,
                    color: module.enabled ? THEME.ACCENT_DIM : THEME.BG_COMPONENT,
                });
            }

            drawText(
                favorites.has(module.name) ? '★' : '☆',
                row.x + 8,
                row.y + row.height / 2,
                FontSizes.HEADER,
                favorites.has(module.name) ? THEME.ACCENT : THEME.TEXT_MUTED
            );
            const moduleColor = getModuleBorderColor(Categories.findItem('Modules', module.name)?.moduleType);
            drawText(module.name, row.x + 32, row.y + row.height / 2, FontSizes.REGULAR, moduleColor || (module.enabled ? THEME.TEXT : THEME.TEXT_MUTED));
            drawText(keyName, row.x + row.width - 8 - getTextWidth(keyName, FontSizes.SMALL), row.y + row.height / 2, FontSizes.SMALL, THEME.TEXT_MUTED);
        });
        Render2D.restore();

        if (rows.length === 0) drawText('No macros found', x + 8, listY + 12, FontSizes.REGULAR, THEME.TEXT_MUTED);
    },

    handleClick(mouseX, mouseY) {
        if (isInside(mouseX, mouseY, layout.settings)) {
            GuiState.macroToggleOpen = false;
            return;
        }
        if (isInside(mouseX, mouseY, layout.nav)) {
            const scrollX = getModuleNavScrollX(macroCategory, false, macroCategoryState);
            const subcategories = ['All', ...macroCategory.subcategories];
            const index = subcategories.findIndex((subcategory, i) =>
                isInside(mouseX, mouseY, {
                    ...getModuleNavButtonRect(macroCategory, i),
                    x: getModuleNavButtonRect(macroCategory, i).x - scrollX,
                })
            );
            if (index !== -1) {
                macroCategoryState.selectedSubcategory = index ? subcategories[index] : null;
                scrollY = 0;
            }
            return;
        }
        if (isInside(mouseX, mouseY, layout.filter)) {
            favoritesOnly = !favoritesOnly;
            scrollY = 0;
            return;
        }

        queryFocused = isInside(mouseX, mouseY, layout.search);
        const row = layout.rows?.find((entry) => isInside(mouseX, mouseY, entry));
        if (!row) return;
        if (mouseX <= row.x + 28) {
            if (favorites.has(row.module.name)) favorites.delete(row.module.name);
            else favorites.add(row.module.name);
            saveFavorites();
            return;
        }

        if (isInside(mouseX, mouseY, row.keybind)) {
            if (!row.module._wrappedKey) row.module.bindToggleKey();
            bindingModule = row.module;
            queryFocused = false;
            return;
        }

        if (row.module.requestToggleFromUser?.()) Client.currentGui.close();
    },

    handleScroll(mouseX, mouseY, direction) {
        if (isInside(mouseX, mouseY, layout.list)) scrollY = Math.max(0, scrollY - direction * ROW_HEIGHT * 2);
    },

    reset() {
        queryFocused = false;
        bindingModule = null;
        GuiState.macroToggleOpen = false;
    },
};

register('guiKey', (char, keyCode, gui, event) => {
    if (!GuiState.macroToggleOpen) return;
    if (bindingModule) {
        setMacroKeybind(bindingModule, keyCode);
        bindingModule = null;
    } else if (!queryFocused) return;
    else if (keyCode === 256 || keyCode === 257) queryFocused = false;
    else if (keyCode === 259) {
        query = query.slice(0, -1);
        scrollY = 0;
    } else if (char && String(char).length === 1 && String(char).codePointAt(0) >= 32) {
        query += char;
        scrollY = 0;
    }
    cancel(event);
});

const keyName = 'Macro Toggle GUI';
const savedKeycode = getConfigFile('keybinds.json')?.[keyName] ?? Keyboard.KEY_M;
const keybind = new KeyBind(keyName, savedKeycode, 'v5_core');
keybind.registerKeyPress(() => {
    getEnabledMacros().forEach((name) => getModule(name)?.toggle(false));
    macroToggleGui.open();
});
register('gameUnload', () => {
    const keybinds = getConfigFile('keybinds.json') || {};
    keybinds[keyName] = keybind.getKeyCode();
    writeConfigFile('keybinds.json', keybinds);
});

v5Command('macro gui', () => macroToggleGui.open());
