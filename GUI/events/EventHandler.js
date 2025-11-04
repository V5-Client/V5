import { isInside } from '../utils/helpers';

export class GuiEventHandler {
    constructor(guiState, categoryManager, settingsManager) {
        this.guiState = guiState;
        this.categoryManager = categoryManager;
        this.settingsManager = settingsManager;
    }

    handleClick(mouseX, mouseY) {
        const rects = this.guiState.rectangles;

        if (
            isInside(mouseX, mouseY, rects.background) &&
            !isInside(mouseX, mouseY, rects.topPanel) &&
            !isInside(mouseX, mouseY, rects.leftPanel) &&
            !isInside(mouseX, mouseY, rects.rightPanel)
        ) {
            this.guiState.startDragging(mouseX, mouseY);
        }

        this.categoryManager.handleClick(mouseX, mouseY, rects);
    }

    handleMouseDrag(mouseX, mouseY) {
        if (this.guiState.dragging) {
            this.guiState.updateDrag(mouseX, mouseY);
            this.categoryManager.invalidateLayout();
        }
        this.categoryManager.handleMouseDrag(mouseX, mouseY);
    }

    handleScroll(mouseX, mouseY, dir) {
        this.categoryManager.handleScroll(mouseX, mouseY, dir, this.guiState.rectangles);
    }

    handleMouseRelease() {
        this.guiState.stopDragging();
        this.categoryManager.handleMouseRelease();
    }

    handleGuiClosed() {
        this.settingsManager.save(this.categoryManager);
        this.settingsManager.load(this.categoryManager);
    }
}
