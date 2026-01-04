import { Categories } from './categories/CategorySystem';
import { THEME } from './Utils';
import { Color } from '../utils/Constants';

const withAlpha = (color, alpha) => {
    return new Color(color.getRed() / 255, color.getGreen() / 255, color.getBlue() / 255, alpha);
};

const initThemeSettings = () => {
    let settingsCat = Categories.categories.find((c) => c.name === 'Settings');
    if (!settingsCat) {
        Categories.categories.push({
            name: 'Settings',
            items: [],
            subcategories: [],
            directComponents: [],
        });
        settingsCat = Categories.categories.find((c) => c.name === 'Settings');
    } else if (!settingsCat.directComponents) {
        settingsCat.directComponents = [];
    }

    Categories.addSettingsColorPicker('Window Background', THEME.BG_WINDOW, (c) => (THEME.BG_WINDOW = c), 'Main window panel background.', 'Window');

    Categories.addSettingsColorPicker('Window Overlay', THEME.BG_OVERLAY, (c) => (THEME.BG_OVERLAY = c), 'Dimmed background behind the window.', 'Window');

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
        'Interface'
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
        'Interface'
    );

    Categories.addSettingsColorPicker('Component Border', THEME.BORDER, (c) => (THEME.BORDER = c), 'Outline color for modules and components.', 'Interface');

    Categories.addSettingsColorPicker(
        'Hover/Surface',
        THEME.HOVER,
        (c) => {
            THEME.HOVER = c;
            THEME.BG_INSET = c;
            THEME.BG_ELEVATED = c;
        },
        'Color for hovered items. Also ends up affecting secondary surfaces (separators and stuff).',
        'Interface'
    );

    Categories.addSettingsColorPicker('Primary Text', THEME.TEXT, (c) => (THEME.TEXT = c), 'Main text color.', 'Text');

    Categories.addSettingsColorPicker('Secondary Text', THEME.TEXT_MUTED, (c) => (THEME.TEXT_MUTED = c), 'Description text color.', 'Text');
};

initThemeSettings();
