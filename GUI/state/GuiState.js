import { PADDING, BORDER_WIDTH, CORNER_RADIUS } from '../utils/constants';
import { THEME } from '../utils/theme';

export class GuiState {
    constructor() {
        this.gui = new Gui();
        this.openStartTime = 0;
        this.dragging = false;
        this.isOpening = false;

        // Animated rectangles
        this.animated = {
            background: {},
            topPanel: {},
            leftPanel: {},
            rightPanel: {},
        };

        // Base rectangles
        this.initRectangles();
    }

    initRectangles() {
        this.rectangles = {
            background: {
                x: Renderer.screen.getWidth() / 2 - 300,
                y: Renderer.screen.getHeight() / 2 - 200,
                width: 600,
                height: 420,
                radius: CORNER_RADIUS,
                color: THEME.GUI_DRAW_BACKGROUND,
                borderWidth: BORDER_WIDTH,
                borderColor: THEME.GUI_DRAW_BACKGROUND_BORDER,
            },
            get topPanel() {
                return {
                    x: this.background.x + PADDING,
                    y: this.background.y + PADDING,
                    width: this.background.width - PADDING * 2,
                    height: 30,
                    radius: CORNER_RADIUS,
                    color: THEME.GUI_DRAW_PANELS,
                    borderWidth: BORDER_WIDTH,
                    borderColor: THEME.GUI_DRAW_BORDER,
                };
            },
            get leftPanel() {
                const topPanel = this.topPanel;
                return {
                    x: this.background.x + PADDING,
                    y: topPanel.y + topPanel.height + PADDING - 40,
                    width: 50,
                    height: this.background.height - PADDING * 3 - topPanel.height + 40,
                    radius: CORNER_RADIUS,
                    color: THEME.GUI_DRAW_PANELS,
                    borderWidth: BORDER_WIDTH,
                    borderColor: THEME.GUI_DRAW_BORDER,
                };
            },
            get rightPanel() {
                const topPanel = this.topPanel;
                const leftPanel = this.leftPanel;
                return {
                    x: leftPanel.x + leftPanel.width + PADDING,
                    y: topPanel.y + topPanel.height + PADDING,
                    width: this.background.width - PADDING * 3 - leftPanel.width,
                    height: this.background.height - PADDING * 3 - topPanel.height,
                    radius: CORNER_RADIUS,
                    color: THEME.GUI_DRAW_PANELS,
                    borderWidth: BORDER_WIDTH,
                    borderColor: THEME.GUI_DRAW_BORDER,
                };
            },
        };
    }

    open() {
        this.isOpening = true;
        this.openStartTime = Date.now();
        this.gui.open();
    }

    close() {
        this.gui.close();
    }

    startDragging(mouseX, mouseY) {
        this.dragging = true;
        this.rectangles.background.dx = mouseX - this.rectangles.background.x;
        this.rectangles.background.dy = mouseY - this.rectangles.background.y;
    }

    updateDrag(mouseX, mouseY) {
        if (!this.dragging) return;

        const bg = this.rectangles.background;
        const screenWidth = Renderer.screen.getWidth();
        const screenHeight = Renderer.screen.getHeight();

        bg.x = Math.max(0, Math.min(mouseX - bg.dx, screenWidth - bg.width));
        bg.y = Math.max(0, Math.min(mouseY - bg.dy, screenHeight - bg.height));
    }

    stopDragging() {
        this.dragging = false;
    }
}
