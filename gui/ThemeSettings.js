import { Color } from '../utils/Constants';
import { Categories } from './categories/CategorySystem';
import { GuiState } from './core/GuiState';
import { THEME } from './Utils';

const withAlpha = (color, alpha) => {
    const baseAlpha = color.getAlpha() / 255;
    return new Color(color.getRed() / 255, color.getGreen() / 255, color.getBlue() / 255, baseAlpha * alpha);
};

const DEFAULT_THEME = {
    BG_WINDOW: new Color(0.07, 0.06, 0.055, 1),
    BG_OVERLAY: new Color(0, 0, 0, 0.8),
    BG_COMPONENT: new Color(0.09, 0.075, 0.07, 1),
    HOVER: new Color(0.15, 0.12, 0.115, 1),
    ACCENT: new Color(0.9, 0.77, 0.73, 1),
    BORDER: new Color(0.3, 0.26, 0.24, 1),
    TEXT: 0xffeeeeee,
    TEXT_MUTED: 0xffaaaaaa,
};

const setPickerColor = (picker, value) => {
    if (!picker) return;

    let safeValue = value;
    if (typeof safeValue === 'number') {
        safeValue = Math.trunc(safeValue) | 0;
    }

    const resolved = safeValue instanceof Color ? safeValue : new Color(safeValue);
    picker.color = resolved;

    const hsv = java.awt.Color.RGBtoHSB(resolved.getRed(), resolved.getGreen(), resolved.getBlue(), null);
    picker.hue = hsv[0];
    picker.sat = hsv[1];
    picker.val = hsv[2];
    picker.alpha = resolved.getAlpha() / 255;

    if (picker.callback) picker.callback(resolved);
};

const initThemeSettings = () => {
    let themeCat = Categories.categories.find((c) => c.name === 'Theme');
    if (!themeCat) {
        themeCat = {
            name: 'Theme',
            items: [],
            subcategories: [],
            directComponents: [],
        };
        Categories.categories.push(themeCat);
    } else if (!themeCat.directComponents) {
        themeCat.directComponents = [];
    }

    const themePickers = [];
    const addThemePicker = (title, currentColor, callback, description, sectionName, defaultColor) => {
        const picker = Categories.addSettingsColorPicker(title, currentColor, callback, description, sectionName, 'Theme');
        themePickers.push({ picker, defaultColor });
        return picker;
    };

    addThemePicker(
        'labels.window_background',
        THEME.BG_WINDOW,
        (c) => (THEME.BG_WINDOW = c),
        'descriptions.window_background',
        'Window',
        DEFAULT_THEME.BG_WINDOW
    );

    addThemePicker('labels.window_overlay', THEME.BG_OVERLAY, (c) => (THEME.BG_OVERLAY = c), 'descriptions.window_overlay', 'Window', DEFAULT_THEME.BG_OVERLAY);

    Categories.addSettingsToggle(
        'labels.limit_content_width',
        (value) => (GuiState.limitRightPanelWidth = !!value),
        'descriptions.limit_content_width',
        GuiState.limitRightPanelWidth,
        'Window',
        'Theme'
    );

    addThemePicker(
        'labels.global_accent',
        THEME.ACCENT,
        (c) => {
            THEME.ACCENT = c;
            THEME.ACCENT_DIM = withAlpha(c, 0.15);
            THEME.ACCENT_GLOW = withAlpha(c, 0.2);
            THEME.BORDER_ACCENT = withAlpha(c, 0.15);
            THEME.TOOLTIP_BORDER = withAlpha(c, 0.3);
            THEME.NOTIF_PROGRESS = withAlpha(c, 0.5);
        },
        'descriptions.global_accent',
        'Interface',
        DEFAULT_THEME.ACCENT
    );

    addThemePicker(
        'labels.component_background',
        THEME.BG_COMPONENT,
        (c) => {
            THEME.BG_COMPONENT = c;
            THEME.NOTIF_BG = withAlpha(c, 0.95);
            THEME.TOOLTIP_BG = c;
        },
        'descriptions.component_background',
        'Interface',
        DEFAULT_THEME.BG_COMPONENT
    );

    addThemePicker('labels.component_border', THEME.BORDER, (c) => (THEME.BORDER = c), 'descriptions.component_border', 'Interface', DEFAULT_THEME.BORDER);

    addThemePicker(
        'labels.hover_surface',
        THEME.HOVER,
        (c) => {
            THEME.HOVER = c;
            THEME.BG_INSET = c;
            THEME.BG_ELEVATED = c;
        },
        'descriptions.hover_surface',
        'Interface',
        DEFAULT_THEME.HOVER
    );

    addThemePicker('labels.primary_text', THEME.TEXT, (c) => (THEME.TEXT = c), 'descriptions.primary_text', 'Text', DEFAULT_THEME.TEXT);

    addThemePicker('labels.secondary_text', THEME.TEXT_MUTED, (c) => (THEME.TEXT_MUTED = c), 'descriptions.secondary_text', 'Text', DEFAULT_THEME.TEXT_MUTED);

    Categories.addSettingsButton(
        'labels.reset_theme_colors',
        () => {
            themePickers.forEach(({ picker, defaultColor }) => setPickerColor(picker, defaultColor));
        },
        'descriptions.reset_theme_colors',
        'Reset',
        'Theme'
    );
};

initThemeSettings();
