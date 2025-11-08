import { PADDING, BORDER_WIDTH, CORNER_RADIUS, THEME } from '../Utils';

const GUI_COLOR = THEME.GUI_DRAW_PANELS;
const BACKGROUND_BORDER_COLOR = THEME.GUI_DRAW_BACKGROUND_BORDER;
const BORDER_COLOR = THEME.GUI_DRAW_BORDER;

export const ANIMATION_DURATION = 250;

global.GuiState = {
    openStartTime: 0,
    dragging: false,
    isOpening: false,
    myGui: new Gui(),

    animatedBackground: {},
    animatedLeftPanel: {},
    animatedRightPanel: {},
};

global.GuiRectangles = {
    Background: {
        name: 'Background',
        x: Renderer.screen.getWidth() / 2 - 300,
        y: Renderer.screen.getHeight() / 2 - 200,
        width: 600,
        height: 400,
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
