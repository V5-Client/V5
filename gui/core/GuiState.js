import { PADDING, BORDER_WIDTH, CORNER_RADIUS, THEME } from '../Utils';

const GUI_COLOR = THEME.GUI_DRAW_PANELS;
const BACKGROUND_BORDER_COLOR = THEME.GUI_DRAW_BACKGROUND_BORDER;
const BORDER_COLOR = THEME.GUI_DRAW_BORDER;

export const ANIMATION_DURATION = 400;

global.GuiState = {
    openStartTime: 0,
    dragging: false,
    isOpening: false,
    myGui: new Gui(),

    animatedBackground: {},
    animatedLeftPanel: {},
    animatedRightPanel: {},
};

global.Overlays = {
    Gui: new Gui(),
};

global.GuiRectangles = {
    Background: {
        name: 'Background',
        _x: null,
        _y: null,
        get x() {
            if (this._x === null) return (Renderer.screen.getWidth() - this.width) / 2;
            return this._x;
        },
        set x(val) {
            this._x = val;
        },
        get y() {
            if (this._y === null) return (Renderer.screen.getHeight() - this.height) / 2;
            return this._y;
        },
        set y(val) {
            this._y = val;
        },
        get width() {
            return Math.round(Renderer.screen.getWidth() * 0.7);
        },
        get height() {
            return Math.round(Renderer.screen.getHeight() * 0.875);
        },
        radius: CORNER_RADIUS,
        color: THEME.GUI_DRAW_BACKGROUND,
        borderWidth: BORDER_WIDTH,
        borderColor: BACKGROUND_BORDER_COLOR,
        isAnimated: true,
    },
    LeftPanel: {
        name: 'Left',
        get x() {
            return global.GuiRectangles.Background.x + PADDING;
        },
        get y() {
            return global.GuiRectangles.Background.y + PADDING;
        },
        width: 50,
        get height() {
            return global.GuiRectangles.Background.height - PADDING * 2;
        },
        radius: CORNER_RADIUS,
        color: GUI_COLOR,
        borderWidth: BORDER_WIDTH,
        borderColor: BORDER_COLOR,
        isAnimated: true,
    },
    RightPanel: {
        name: 'Right',
        get x() {
            return global.GuiRectangles.LeftPanel.x + global.GuiRectangles.LeftPanel.width + PADDING;
        },
        get y() {
            return global.GuiRectangles.Background.y + PADDING;
        },
        get width() {
            return global.GuiRectangles.Background.width - PADDING * 3 - global.GuiRectangles.LeftPanel.width;
        },
        get height() {
            return global.GuiRectangles.Background.height - PADDING * 2;
        },
        radius: CORNER_RADIUS,
        color: GUI_COLOR,
        borderWidth: BORDER_WIDTH,
        borderColor: BORDER_COLOR,
        isAnimated: true,
    },
};
