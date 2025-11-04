import { Color } from '../../Utility/Constants';

export const THEME = {
    // GUI
    GUI_DRAW_BACKGROUND_BORDER: new Color(1, 1, 1, 0.15),
    GUI_DRAW_BACKGROUND: new Color(0.18, 0.18, 0.2, 0.75),
    GUI_DRAW_PANELS: new Color(0.14, 0.14, 0.16, 1),
    GUI_DRAW_BORDER: new Color(1, 1, 1, 0.15),

    // Categories
    GUI_MANAGER_CATEGORY_TITLE: 0xffffff,
    GUI_MANAGER_CATEGORY_DESCRIPTION: 0xcccccc,
    GUI_MANAGER_BACK_TEXT: 0x3ba3ff,
    GUI_MANAGER_CATEGORY_BOX: new Color(0.16, 0.16, 0.18, 1),
    GUI_MANAGER_UNIVERSAL_GRAY: new Color(0.22, 0.23, 0.25, 1),
    GUI_MANAGER_CATEGORY_SELECTED: new Color(0.2, 0.6, 1, 0.5), // soft blue selection
    GUI_MANAGER_CATEGORY_BOX_BORDER: new Color(1, 1, 1, 0.15),

    // Notifications
    NOTIFICATION_BACKGROUND: new Color(0.18, 0.18, 0.2, 0.92),
    NOTIFICATION_ICON_BACKGROUND: new Color(1, 1, 1, 0.06),
    NOTIFICATION_ICON_SYMBOL: 0xdddddd,
    NOTIFICATION_TEXT: 0xffffff,
    NOTIFICATION_DESCRIPTION: 0xb0b0b0,
    NOTIFICATION_CLOSE_BUTTON: 0xaaaaaa,
    NOTIFICATION_CLOSE_BUTTON_HOVER: new Color(1, 1, 1, 0.1),
    NOTIFICATION_PROGRESS_BAR: new Color(1, 1, 1, 0.25),
    NOTIFICATION_SUCCESS: new Color(parseInt('2b9875', 16)),
    NOTIFICATION_ERROR: new Color(parseInt('ef4444', 16)),
    NOTIFICATION_DANGER: new Color(parseInt('ff0f0f', 16)),
    NOTIFICATION_CHECK_IN: new Color(parseInt('99cc33', 16)),
    NOTIFICATION_WARNING: new Color(parseInt('f59e0b', 16)),
    NOTIFICATION_INFO: new Color(parseInt('3b82f6', 16)),

    // Components

    // Slider
    SLIDER_BACKGROUND: new Color(0.16, 0.16, 0.18, 1),
    SLIDER_TEXT: new Color(1, 1, 1, 1),
    SLIDER_FOREGROUND: new Color(0.2, 0.6, 1, 0.6), // blue accent
    SLIDER_HANDLE: new Color(0.85, 0.85, 0.85, 1),
    SLIDER_BAR_BACKGROUND: new Color(0.22, 0.23, 0.25, 1),

    // Toggle
    TOGGLE_BACKGROUND: new Color(0.16, 0.16, 0.18, 1),
    TOGGLE_ACCENT: new Color(0.2, 0.6, 1, 0.6), // blue toggle
    TOGGLE_DISABLED_BOX: new Color(0.4, 0.41, 0.44, 1),
    TOGGLE_TEXT: new Color(1, 1, 1, 1),
    TOGGLE_BORDER: new Color(1, 1, 1, 0.15),

    // Dropdown
    DROPDOWN_BACKGROUND: new Color(0.2, 0.2, 0.22, 1),
    DROPDOWN_FOREGROUND: new Color(0.45, 0.65, 1, 0.9),
    DROPDOWN_TEXT: 0xffffff,
    DROPDOWN_OPTION_BACKGROUND: new Color(0.24, 0.24, 0.26, 1),
    DROPDOWN_TOGGLE_DISABLED: new Color(0.4, 0.4, 0.43, 1),

    // Tooltip
    TOOLTIP_BACKGROUND: new Color(0.3, 0.3, 0.32, 0.95),
    TOOLTIP_TEXT: 0xdddddd,
};
