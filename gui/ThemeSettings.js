import { Color } from '../utils/Constants';
import { Categories } from './categories/CategorySystem';
import { THEME } from './Utils';

const withAlpha = (color, alpha) => {
    const baseAlpha = color.getAlpha() / 255;
    return new Color(color.getRed() / 255, color.getGreen() / 255, color.getBlue() / 255, baseAlpha * alpha);
};

const DEFAULT_THEME = {
    BG_WINDOW: new Color(0.09, 0.1, 0.13, 1),
    BG_OVERLAY: new Color(0.06, 0.07, 0.09, 0.85),
    BG_COMPONENT: new Color(0.11, 0.12, 0.15, 1),
    HOVER: new Color(0.17, 0.18, 0.22, 1),
    ACCENT: new Color(0.4, 0.7, 1, 1),
    BORDER: new Color(0.2, 0.21, 0.24, 1),
    OV_WINDOW: new Color(0.04, 0.04, 0.04, 0.75),
    OV_BORDER: new Color(0.4, 0.7, 1.0, 0.0),
    OV_ACCENT: new Color(0.4, 0.7, 1.0, 1),
    TEXT: 0xffffffff,
    TEXT_MUTED: 0xff99a3b0,
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
        Categories.categories.push({
            name: 'Theme',
            items: [],
            subcategories: [],
            directComponents: [],
        });
        themeCat = Categories.categories.find((c) => c.name === 'Theme');
    } else if (!themeCat.directComponents) {
        themeCat.directComponents = [];
    }

    const themePickers = [];
    const addThemePicker = (title, currentColor, callback, description, sectionName, defaultColor) => {
        const picker = Categories.addSettingsColorPicker(title, currentColor, callback, description, sectionName, 'Theme');
        themePickers.push({ picker, defaultColor });
        return picker;
    };

    addThemePicker('Window Background', THEME.BG_WINDOW, (c) => (THEME.BG_WINDOW = c), 'Main window panel background.', 'Window', DEFAULT_THEME.BG_WINDOW);

    addThemePicker(
        'Window Overlay',
        THEME.BG_OVERLAY,
        (c) => (THEME.BG_OVERLAY = c),
        'Dimmed background behind the window.',
        'Window',
        DEFAULT_THEME.BG_OVERLAY
    );

    addThemePicker(
        'Global Accent',
        THEME.ACCENT,
        (c) => {
            THEME.ACCENT = c;
            THEME.ACCENT_DIM = withAlpha(c, 0.15);
            THEME.ACCENT_GLOW = withAlpha(c, 0.2);
            THEME.BORDER_ACCENT = withAlpha(c, 0.15);
            THEME.TOOLTIP_BORDER = withAlpha(c, 0.3);
            THEME.NOTIF_PROGRESS = withAlpha(c, 0.5);
        },
        'Main accent color.',
        'Interface',
        DEFAULT_THEME.ACCENT
    );

    addThemePicker(
        'Component Background',
        THEME.BG_COMPONENT,
        (c) => {
            THEME.BG_COMPONENT = c;
            THEME.NOTIF_BG = withAlpha(c, 0.95);
            THEME.TOOLTIP_BG = c;
        },
        'Background for all modules, toggles, sliders, dropdowns, and color pickers.',
        'Interface',
        DEFAULT_THEME.BG_COMPONENT
    );

    addThemePicker('Component Border', THEME.BORDER, (c) => (THEME.BORDER = c), 'Outline color for modules and components.', 'Interface', DEFAULT_THEME.BORDER);

    addThemePicker(
        'Hover/Surface',
        THEME.HOVER,
        (c) => {
            THEME.HOVER = c;
            THEME.BG_INSET = c;
            THEME.BG_ELEVATED = c;
        },
        'Color for hovered items. Also ends up affecting secondary surfaces (separators and stuff).',
        'Interface',
        DEFAULT_THEME.HOVER
    );

    addThemePicker(
        'Overlay Main Color',
        THEME.OV_WINDOW,
        (c) => {
            THEME.OV_WINDOW = c;
        },
        'Main  color for the overlay.',
        'Overlay',
        DEFAULT_THEME.OV_WINDOW
    );

    addThemePicker(
        'Overlay Border Color',
        THEME.OV_BORDER,
        (c) => {
            THEME.OV_BORDER = c;
        },
        'Border color for the overlay.',
        'Overlay',
        DEFAULT_THEME.OV_BORDER
    );

    addThemePicker(
        'Overlay Accent Color',
        THEME.OV_ACCENT,
        (c) => {
            THEME.OV_ACCENT = c;
        },
        'Accent color for the overlay.',
        'Overlay',
        DEFAULT_THEME.OV_ACCENT
    );

    addThemePicker('Primary Text', THEME.TEXT, (c) => (THEME.TEXT = c), 'Main text color.', 'Text', DEFAULT_THEME.TEXT);

    addThemePicker('Secondary Text', THEME.TEXT_MUTED, (c) => (THEME.TEXT_MUTED = c), 'Description text color.', 'Text', DEFAULT_THEME.TEXT_MUTED);

    Categories.addSettingsButton(
        'Reset Theme Colors',
        () => {
            themePickers.forEach(({ picker, defaultColor }) => setPickerColor(picker, defaultColor));
        },
        'Reset all theme colors back to defaults.',
        'Reset',
        'Theme'
    );
};

initThemeSettings();
