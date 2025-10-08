import './GuiManager';
import {
    drawRoundedRectangle,
    drawRoundedRectangleWithBorder,
    clamp,
    isInside,
    PADDING,
    BORDER_WIDTH,
    CORNER_RADIUS,
    THEME,
} from './Utils';

import { saveSettings, loadSettings } from './GuiSave';

const GUI_COLOR = THEME.GUI_DRAW_PANELS;
const BACKGROUND_BORDER_COLOR = THEME.GUI_DRAW_BACKGROUND_BORDER;
const BORDER_COLOR = THEME.GUI_DRAW_BORDER;
const ANIMATION_DURATION = 250;

let openStartTime = 0;
let animatedBackground = {};
let animatedTopPanel = {};
let animatedLeftPanel = {};
let animatedRightPanel = {};
let dragging = false;

let tooltipToDraw = null;
let tooltipHoverTime = 0;
let currentTooltipText = null;
let isHoveringTooltipSource = false;

global.setTooltip = (text) => {
    isHoveringTooltipSource = true;
    if (text !== currentTooltipText) {
        currentTooltipText = text;
        tooltipHoverTime = Date.now();
        tooltipToDraw = null;
    } else if (Date.now() - tooltipHoverTime > 400) {
        tooltipToDraw = text;
    }
};

let rectangles = {
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
            return rectangles.Background.x + PADDING;
        },
        get y() {
            return rectangles.Background.y + PADDING;
        },
        get width() {
            return rectangles.Background.width - PADDING * 2;
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
            return rectangles.Background.x + PADDING;
        },
        get y() {
            return (
                rectangles.TopPanel.y +
                rectangles.TopPanel.height +
                PADDING -
                40
            );
        },
        width: 50,
        get height() {
            const remainingSpace =
                rectangles.Background.height -
                PADDING * 3 -
                rectangles.TopPanel.height +
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
                rectangles.LeftPanel.x + rectangles.LeftPanel.width + PADDING
            );
        },
        get y() {
            return rectangles.TopPanel.y + rectangles.TopPanel.height + PADDING;
        },
        get width() {
            const remainingWidth =
                rectangles.Background.width -
                PADDING * 3 -
                rectangles.LeftPanel.width;
            return remainingWidth;
        },
        get height() {
            const remainingSpace =
                rectangles.Background.height -
                PADDING * 3 -
                rectangles.TopPanel.height;
            return remainingSpace;
        },
        radius: CORNER_RADIUS,
        color: GUI_COLOR,
        borderWidth: BORDER_WIDTH,
        borderColor: BORDER_COLOR,
        isAnimated: true,
    },
};

const myGui = new Gui();

const categoryManager = global.createCategoriesManager({
    rectangles: rectangles,
    draw: {
        drawRoundedRectangle: drawRoundedRectangle,
        drawRoundedRectangleWithBorder: drawRoundedRectangleWithBorder,
    },
    utils: {},
    colors: {},
});

const drawGUI = (mouseX, mouseY) => {
    isHoveringTooltipSource = false;

    let elapsed = Date.now() - openStartTime;
    const progress = clamp(elapsed / ANIMATION_DURATION, 0, 1);

    let targetBackground = rectangles.Background;
    let startX = targetBackground.x + targetBackground.width / 2;
    let startY = targetBackground.y + targetBackground.height / 2;

    let currentWidth = targetBackground.width * progress;
    let currentHeight = targetBackground.height * progress;

    Object.assign(animatedBackground, targetBackground, {
        x: startX - currentWidth / 2,
        y: startY - currentHeight / 2,
        width: currentWidth,
        height: currentHeight,
    });

    Object.assign(animatedTopPanel, rectangles.TopPanel, {
        x: animatedBackground.x + PADDING,
        y: animatedBackground.y + PADDING,
        width: (targetBackground.width - PADDING * 2) * progress,
        height: rectangles.TopPanel.height * progress,
    });

    Object.assign(animatedLeftPanel, rectangles.LeftPanel, {
        x: animatedBackground.x + PADDING,
        y: animatedTopPanel.y + animatedTopPanel.height + PADDING,
        width: rectangles.LeftPanel.width * progress,
        height:
            (targetBackground.height -
                PADDING * 3 -
                rectangles.TopPanel.height) *
            progress,
    });

    Object.assign(animatedRightPanel, rectangles.RightPanel, {
        x: animatedLeftPanel.x + animatedLeftPanel.width + PADDING,
        y: animatedTopPanel.y + animatedTopPanel.height + PADDING,
        width:
            (targetBackground.width -
                PADDING * 3 -
                rectangles.LeftPanel.width) *
            progress,
        height:
            (targetBackground.height -
                PADDING * 3 -
                rectangles.TopPanel.height) *
            progress,
    });

    Client.getMinecraft().gameRenderer.renderBlur();

    const scale = Renderer.screen.getScale();
    GL11.glEnable(GL11.GL_SCISSOR_TEST);
    GL11.glScissor(
        Math.floor(animatedBackground.x * scale),
        Math.floor(
            (Renderer.screen.getHeight() -
                (animatedBackground.y + animatedBackground.height)) *
                scale
        ),
        Math.floor(animatedBackground.width * scale),
        Math.floor(animatedBackground.height * scale)
    );

    drawRoundedRectangleWithBorder(animatedBackground);
    drawRoundedRectangleWithBorder(animatedTopPanel);
    drawRoundedRectangleWithBorder(animatedLeftPanel);
    drawRoundedRectangleWithBorder(animatedRightPanel);

    if (progress >= 0.99) {
        categoryManager.draw(mouseX, mouseY);
    }

    GL11.glDisable(GL11.GL_SCISSOR_TEST);

    if (!isHoveringTooltipSource) {
        currentTooltipText = null;
        tooltipToDraw = null;
    }

    if (tooltipToDraw) {
        const lines = tooltipToDraw.split('\n');
        const PADDING = 5;
        let tooltipWidth = 0;
        lines.forEach((line) => {
            const lineWidth = Renderer.getStringWidth(line);
            if (lineWidth > tooltipWidth) {
                tooltipWidth = lineWidth;
            }
        });
        tooltipWidth += PADDING * 2;
        const tooltipHeight = lines.length * 9 + PADDING * 2;
        const tooltipX = mouseX + 10;
        const tooltipY = mouseY;

        drawRoundedRectangle({
            x: tooltipX,
            y: tooltipY,
            width: tooltipWidth,
            height: tooltipHeight,
            radius: 3,
            color: THEME.TOOLTIP_BACKGROUND,
        });

        lines.forEach((line, index) => {
            Renderer.drawString(
                line,
                tooltipX + PADDING,
                tooltipY + PADDING + index * 9,
                THEME.TOOLTIP_TEXT,
                true
            );
        });
    }
};

const handleClick = (mouseX, mouseY) => {
    if (
        isInside(mouseX, mouseY, rectangles.Background) &&
        !isInside(mouseX, mouseY, rectangles.TopPanel) &&
        !isInside(mouseX, mouseY, rectangles.LeftPanel) &&
        !isInside(mouseX, mouseY, rectangles.RightPanel)
    ) {
        dragging = true;
        rectangles.Background.dx = mouseX - rectangles.Background.x;
        rectangles.Background.dy = mouseY - rectangles.Background.y;
    }

    categoryManager.handleClick(mouseX, mouseY);
};

const handleMouseDrag = (mouseX, mouseY) => {
    if (dragging) {
        let newX = mouseX - rectangles.Background.dx;
        let newY = mouseY - rectangles.Background.dy;

        const screenWidth = Renderer.screen.getWidth();
        const screenHeight = Renderer.screen.getHeight();

        rectangles.Background.x = clamp(
            newX,
            0,
            screenWidth - rectangles.Background.width
        );
        rectangles.Background.y = clamp(
            newY,
            0,
            screenHeight - rectangles.Background.height
        );
        categoryManager.invalidateLayoutCache(); // Invalidate cache when GUI is dragged
    }
    categoryManager.handleMouseDrag(mouseX, mouseY);
};

const handleScroll = (mouseX, mouseY, dir) => {
    categoryManager.handleScroll(mouseX, mouseY, dir);
};

myGui.registerClicked((mouseX, mouseY, button) => {
    if (button === 0) handleClick(mouseX, mouseY);
});

myGui.registerMouseDragged((mouseX, mouseY, button, _dt) => {
    if (button === 0) handleMouseDrag(mouseX, mouseY);
});

myGui.registerMouseReleased(() => {
    dragging = false;
    categoryManager.handleMouseRelease();
});

myGui.registerClosed(() => {
    saveSettings();
    loadSettings();
});

myGui.registerDraw(drawGUI);

myGui.registerScrolled(handleScroll);

register('command', () => {
    isOpening = true;
    openStartTime = Date.now();
    loadSettings();
    categoryManager.invalidateLayoutCache(); // Invalidate cache on GUI open
    myGui.open();
}).setName('gui');
