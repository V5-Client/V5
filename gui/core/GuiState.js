import { PADDING, BORDER_WIDTH, CORNER_RADIUS, THEME } from '../Utils';

const GUI_COLOR = THEME.GUI_DRAW_PANELS;
const BACKGROUND_BORDER_COLOR = THEME.GUI_DRAW_BACKGROUND_BORDER;
const BORDER_COLOR = THEME.GUI_DRAW_BORDER;

export const ANIMATION_DURATION = 400;

export const GuiState = {
    openStartTime: 0,
    dragging: false,
    isOpening: false,
    myGui: new Gui(),

    animatedBackground: {},
    animatedLeftPanel: {},
    animatedRightPanel: {},
};

export const Overlays = {
    Gui: new Gui(),
};

export const GuiRectangles = {};

GuiRectangles.Background = {
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
};

GuiRectangles.LeftPanel = {
    name: 'Left',
    get x() {
        return GuiRectangles.Background.x + PADDING;
    },
    get y() {
        return GuiRectangles.Background.y + PADDING;
    },
    width: 50,
    get height() {
        return GuiRectangles.Background.height - PADDING * 2;
    },
    radius: CORNER_RADIUS,
    color: GUI_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    isAnimated: true,
};

GuiRectangles.RightPanel = {
    name: 'Right',
    get x() {
        return GuiRectangles.LeftPanel.x + GuiRectangles.LeftPanel.width + PADDING;
    },
    get y() {
        return GuiRectangles.Background.y + PADDING;
    },
    get width() {
        return GuiRectangles.Background.width - PADDING * 3 - GuiRectangles.LeftPanel.width;
    },
    get height() {
        return GuiRectangles.Background.height - PADDING * 2;
    },
    radius: CORNER_RADIUS,
    color: GUI_COLOR,
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    isAnimated: true,
};
