import { Categories } from './categories/CategorySystem';
import { THEME } from './Utils';
import { Color } from '../utils/Constants';

const withAlpha = (color, alpha) => {
    const baseAlpha = color.getAlpha() / 255;
    return new Color(color.getRed() / 255, color.getGreen() / 255, color.getBlue() / 255, baseAlpha * alpha);
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

    Categories.addSettingsColorPicker('Window Background', THEME.BG_WINDOW, (c) => (THEME.BG_WINDOW = c), 'Main window panel background.', 'Window', 'Theme');

    Categories.addSettingsColorPicker(
        'Window Overlay',
        THEME.BG_OVERLAY,
        (c) => (THEME.BG_OVERLAY = c),
        'Dimmed background behind the window.',
        'Window',
        'Theme'
    );

    Categories.addSettingsColorPicker(
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
        'Theme'
    );

    Categories.addSettingsColorPicker(
        'Component Background',
        THEME.BG_COMPONENT,
        (c) => {
            THEME.BG_COMPONENT = c;
            THEME.NOTIF_BG = withAlpha(c, 0.95);
            THEME.TOOLTIP_BG = c;
        },
        'Background for all modules, toggles, sliders, dropdowns, and color pickers.',
        'Interface',
        'Theme'
    );

    Categories.addSettingsColorPicker(
        'Component Border',
        THEME.BORDER,
        (c) => (THEME.BORDER = c),
        'Outline color for modules and components.',
        'Interface',
        'Theme'
    );

    Categories.addSettingsColorPicker(
        'Hover/Surface',
        THEME.HOVER,
        (c) => {
            THEME.HOVER = c;
            THEME.BG_INSET = c;
            THEME.BG_ELEVATED = c;
        },
        'Color for hovered items. Also ends up affecting secondary surfaces (separators and stuff).',
        'Interface',
        'Theme'
    );

    Categories.addSettingsColorPicker('Primary Text', THEME.TEXT, (c) => (THEME.TEXT = c), 'Main text color.', 'Text', 'Theme');

    Categories.addSettingsColorPicker('Secondary Text', THEME.TEXT_MUTED, (c) => (THEME.TEXT_MUTED = c), 'Description text color.', 'Text', 'Theme');
};

initThemeSettings();
