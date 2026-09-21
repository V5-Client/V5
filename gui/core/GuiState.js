import { BORDER_WIDTH, PADDING, THEME } from '../Utils';

export const ANIMATION_DURATION = 400;

const MIN_GUI_WIDTH = 300;
const MIN_GUI_HEIGHT = 150;
const MAX_GUI_SCALE = 2;

export const GuiState = {
    openStartTime: 0,
    dragging: false,
    isOpening: false,
    macroToggleOpen: false,
    guiScale: 1,
    limitRightPanelWidth: true,
    pendingGuiScale: null,
    myGui: new Gui(),

    animatedBackground: {},
    animatedLeftPanel: {},
    animatedRightPanel: {},
};

GuiState.getMaxGuiScale = () =>
    Math.max(
        0.5,
        Math.min(MAX_GUI_SCALE, Math.floor(Math.min(Render2D.screen.getWidth() / MIN_GUI_WIDTH, Render2D.screen.getHeight() / MIN_GUI_HEIGHT) * 10) / 10)
    );

GuiState.setGuiScale = (value) => {
    GuiState.guiScale = Math.max(0.5, Math.min(MAX_GUI_SCALE, Number(value) || 1));
};

GuiState.getEffectiveGuiScale = () => Math.min(GuiState.guiScale, GuiState.getMaxGuiScale());

GuiState.applyPendingGuiScale = () => {
    if (GuiState.pendingGuiScale === null) return;
    GuiState.setGuiScale(GuiState.pendingGuiScale);
    GuiState.pendingGuiScale = null;
};

GuiState.getGuiWidth = () => Render2D.screen.getWidth() / GuiState.getEffectiveGuiScale();
GuiState.getGuiHeight = () => Render2D.screen.getHeight() / GuiState.getEffectiveGuiScale();

GuiState.toGuiCoordinates = (x, y) => {
    const guiScale = GuiState.getEffectiveGuiScale();
    if (guiScale === 1) return { x, y };

    return {
        x: x / guiScale,
        y: y / guiScale,
    };
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
        if (this._x === null) return 0;
        return this._x;
    },
    set x(val) {
        this._x = val;
    },
    get y() {
        if (this._y === null) return 0;
        return this._y;
    },
    set y(val) {
        this._y = val;
    },
    get width() {
        return GuiState.getGuiWidth();
    },
    get height() {
        return GuiState.getGuiHeight();
    },
    radius: 0,
    get color() {
        return THEME.BG_OVERLAY;
    },
    borderWidth: 0,
    get borderColor() {
        return THEME.ACCENT_GLOW;
    },
    isAnimated: true,
};

GuiRectangles.LeftPanel = {
    name: 'Left',
    get x() {
        return GuiRectangles.Background.x;
    },
    get y() {
        return GuiRectangles.Background.y;
    },
    width: 44,
    get height() {
        return GuiRectangles.Background.height;
    },
    radius: 0,
    get color() {
        return THEME.BG_WINDOW;
    },
    borderWidth: 0,
    get borderColor() {
        return THEME.BORDER_ACCENT;
    },
    isAnimated: true,
};

GuiRectangles.ModuleSearch = {
    get x() {
        return GuiRectangles.LeftPanel.x;
    },
    get y() {
        return GuiRectangles.LeftPanel.y;
    },
    width: 220,
    get height() {
        return GuiRectangles.LeftPanel.height;
    },
};

GuiRectangles.RightPanel = {
    name: 'Right',
    get x() {
        const leftEdge = GuiRectangles.LeftPanel.x + GuiRectangles.LeftPanel.width + PADDING / 2;
        const rightEdge = GuiState.getGuiWidth() - PADDING / 2;
        return leftEdge + (rightEdge - leftEdge - this.width) / 2;
    },
    get y() {
        return 4;
    },
    get width() {
        const availableWidth = GuiState.getGuiWidth() - GuiRectangles.LeftPanel.width - PADDING;
        return GuiState.limitRightPanelWidth ? Math.min(440, availableWidth) : availableWidth;
    },
    get height() {
        return GuiState.getGuiHeight() - this.y;
    },
    radius: 12,
    get color() {
        return THEME.BG_WINDOW;
    },
    borderWidth: BORDER_WIDTH,
    get borderColor() {
        return THEME.BORDER_ACCENT;
    },
    isAnimated: true,
};
