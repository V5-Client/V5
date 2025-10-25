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
    animatedTopPanel: {},
    animatedLeftPanel: {},
    animatedRightPanel: {},
};

global.GuiRectangles = {
    Background: {
        name: 'Background',
        x: Renderer.screen.getWidth() / 2 - 300,
        y: Renderer.screen.getHeight() / 2 - 200,
        width: 600,
        height: 420,
        radius: CORNER_RADIUS,
        color: THEME.GUI_DRAW_BACKGROUND,
        borderWidth: BORDER_WIDTH,
        borderColor: BACKGROUND_BORDER_COLOR,
        isAnimated: true,
    },
    TopPanel: {
        name: 'Top',
        get x() {
            return global.GuiRectangles.Background.x + PADDING;
        },
        get y() {
            return global.GuiRectangles.Background.y + PADDING;
        },
        get width() {
            return global.GuiRectangles.Background.width - PADDING * 2;
        },
        height: 30,
        radius: CORNER_RADIUS,
        color: GUI_COLOR,
        borderWidth: BORDER_WIDTH,
        borderColor: BORDER_COLOR,
        isAnimated: true,
    },
    LeftPanel: {
        name: 'Left',
        get x() {
            return global.GuiRectangles.Background.x + PADDING;
        },
        get y() {
            return (
                global.GuiRectangles.TopPanel.y +
                global.GuiRectangles.TopPanel.height +
                PADDING -
                40
            );
        },
        width: 50,
        get height() {
            const remainingSpace =
                global.GuiRectangles.Background.height -
                PADDING * 3 -
                global.GuiRectangles.TopPanel.height +
                40;
            return remainingSpace;
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
            return (
                global.GuiRectangles.LeftPanel.x +
                global.GuiRectangles.LeftPanel.width +
                PADDING
            );
        },
        get y() {
            return (
                global.GuiRectangles.TopPanel.y +
                global.GuiRectangles.TopPanel.height +
                PADDING
            );
        },
        get width() {
            const remainingWidth =
                global.GuiRectangles.Background.width -
                PADDING * 3 -
                global.GuiRectangles.LeftPanel.width;
            return remainingWidth;
        },
        get height() {
            const remainingSpace =
                global.GuiRectangles.Background.height -
                PADDING * 3 -
                global.GuiRectangles.TopPanel.height;
            return remainingSpace;
        },
        radius: CORNER_RADIUS,
        color: GUI_COLOR,
        borderWidth: BORDER_WIDTH,
        borderColor: BORDER_COLOR,
        isAnimated: true,
    },
};
