import { isInside, easeInOutQuad } from '../utils/helpers';
import { playClickSound } from '../utils/sound';
import { PADDING, ANIMATION_DURATION, SUBCATEGORY_BUTTON_HEIGHT, SUBCATEGORY_BUTTON_SPACING } from '../utils/constants';
import { MultiToggle } from '../components/Dropdown';

const ICON_SIZE = 25;
const HIGHLIGHT_PADDING = 1;
const HIGHLIGHT_SIZE = ICON_SIZE + HIGHLIGHT_PADDING * 2;

export class CategoryEventHandler {
    constructor(categoryState) {
        this.state = categoryState;
    }

    handleClick(mouseX, mouseY, rectangles, manager) {
        if (this.state.isTransitioning()) return;

        const panel = rectangles.rightPanel;

        if (this.state.currentPage === 'options' && this.state.selectedItem) {
            return this._handleOptionsClick(mouseX, mouseY, panel, rectangles.leftPanel, manager);
        } else {
            return this._handleCategoryClick(mouseX, mouseY, panel, rectangles.leftPanel, manager);
        }
    }

    _handleOptionsClick(mouseX, mouseY, panel, leftPanel, manager) {
        const optionX = panel.x + PADDING;
        const optionY = panel.y + PADDING;
        const scrollY = this.state.optionsScrollY;

        // Back button
        const backButtonText = 'Back';
        const backButtonWidth = Renderer.getStringWidth(backButtonText);
        const drawnBackY = optionY + 10 - scrollY;
        const backButtonRect = {
            x: optionX + 10,
            y: drawnBackY,
            width: backButtonWidth,
            height: 10,
        };

        if (isInside(mouseX, mouseY, backButtonRect)) {
            this.state.startTransition(-1);
            playClickSound();
            return true;
        }

        // Components
        const components = this.state.selectedItem.components;
        let currentCompY = optionY + 70;
        let currentDrawnCompY = currentCompY - scrollY;

        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (typeof component.handleClick !== 'function') continue;

            component.x = optionX + 10;

            if (component instanceof MultiToggle) {
                component.y = currentDrawnCompY;
                if (component.handleClick(mouseX, mouseY)) {
                    return true;
                }
            } else {
                let componentHeight = 40;
                let clickableArea = {
                    x: optionX,
                    y: currentDrawnCompY,
                    width: panel.width - 2 * PADDING - 20,
                    height: componentHeight,
                };

                if (isInside(mouseX, mouseY, clickableArea)) {
                    component.y = currentDrawnCompY;
                    if (component.handleClick(mouseX, mouseY)) {
                        return true;
                    }
                }
            }

            let thisHeight = 45;
            if (component instanceof MultiToggle && component.animationProgress > 0) {
                thisHeight += component.getExpandedHeight() * component.animationProgress;
            }
            currentCompY += thisHeight;
            currentDrawnCompY += thisHeight;
        }

        // Click on left panel
        if (isInside(mouseX, mouseY, leftPanel)) {
            this.state.startTransition(-1);
            playClickSound();
            return true;
        }

        return false;
    }

    _handleCategoryClick(mouseX, mouseY, panel, leftPanel, manager) {
        const getCategoryRect = (index) => ({
            x: leftPanel.x + PADDING,
            y: leftPanel.y + PADDING + 50 + index * 35,
            width: leftPanel.width - PADDING * 2,
            height: 30,
        });

        // Category selection
        const wasCategoryClicked = this.state.categories.some((cat, i) => {
            const rect = getCategoryRect(i);
            if (isInside(mouseX, mouseY, rect)) {
                if (cat.name !== this.state.selected) {
                    const oldIndex = this.state.categories.findIndex((c) => c.name === this.state.selected);
                    const oldRect = getCategoryRect(oldIndex);

                    const oldIconX = oldRect.x + (oldRect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                    const oldIconY = oldRect.y + (oldRect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                    const newIconX = rect.x + (rect.width - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;
                    const newIconY = rect.y + (rect.height - ICON_SIZE) / 2 - HIGHLIGHT_PADDING;

                    this.state.categoryAnimation.rect = {
                        startX: oldIconX,
                        startY: oldIconY,
                        endX: newIconX,
                        endY: newIconY,
                        width: HIGHLIGHT_SIZE,
                        height: HIGHLIGHT_SIZE,
                        radius: 5,
                    };
                    this.state.categoryAnimation.startTime = Date.now();

                    this.state.startTransition(i > oldIndex ? 1 : -1);
                    this.state.selectCategory(cat.name);
                    this.state.selectedSubcategory = null;

                    manager.invalidateHeight();
                    manager.invalidateLayout();
                    playClickSound();
                }
                return true;
            }
            return false;
        });

        if (!wasCategoryClicked && isInside(mouseX, mouseY, leftPanel)) {
            playClickSound();
        }

        // Subcategory buttons
        const cat = this.state.getSelectedCategory();
        if (cat && cat.subcategories.length > 0) {
            let currentX = panel.x + PADDING;
            let yOffset = panel.y + PADDING;
            const subcategoriesToDraw = ['All', ...cat.subcategories];

            for (const subcat of subcategoriesToDraw) {
                const buttonTextWidth = Renderer.getStringWidth(subcat) + 10;
                const buttonRect = {
                    x: currentX,
                    y: yOffset,
                    width: buttonTextWidth,
                    height: SUBCATEGORY_BUTTON_HEIGHT,
                };

                if (isInside(mouseX, mouseY, buttonRect)) {
                    const newSubcatName = subcat === 'All' ? null : subcat;
                    if (this.state.selectedSubcategory !== newSubcatName) {
                        const oldRect = this.state.selectedSubcategoryButton || buttonRect;
                        this.state.selectedSubcategory = newSubcatName;

                        manager.invalidateHeight();
                        manager.invalidateLayout();

                        this.state.subcatAnimation.startTime = Date.now();
                        this.state.subcatAnimation.progress = 0;
                        this.state.subcatAnimation.rect = {
                            startX: oldRect.x,
                            startY: oldRect.y,
                            startWidth: oldRect.width,
                            startHeight: oldRect.height,
                            endX: buttonRect.x,
                            endY: buttonRect.y,
                            endWidth: buttonRect.width,
                            endHeight: buttonRect.height,
                            x: oldRect.x,
                            y: oldRect.y,
                            width: oldRect.width,
                            height: oldRect.height,
                        };
                        this.state.selectedSubcategoryButton = buttonRect;
                    }
                    playClickSound();
                    return true;
                }
                currentX += buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
            }
        }

        // Item click
        for (const layout of manager.cachedLayouts) {
            if (isInside(mouseX, mouseY, layout.rect)) {
                this.state.startTransition(1);
                this.state.selectItem(layout.item);
                playClickSound();
                return true;
            }
        }

        return false;
    }

    handleScroll(mouseX, mouseY, dir, rectangles, manager) {
        const SCROLL_SPEED = 15;
        const panel = rectangles.rightPanel;

        if (this.state.currentPage === 'options' && this.state.selectedItem) {
            const optionX = panel.x + PADDING;
            const optionY = panel.y + PADDING;

            let scrollHandled = false;
            let componentY = optionY + 70;
            const components = this.state.selectedItem.components;

            if (components) {
                components.forEach((component) => {
                    let compHeight = 45;
                    if (component instanceof MultiToggle) {
                        compHeight += component.getExpandedHeight() * component.animationProgress;
                    }
                    const compRect = {
                        x: optionX + 10,
                        y: componentY - this.state.optionsScrollY,
                        width: panel.width - PADDING * 2 - 20,
                        height: compHeight,
                    };

                    if (isInside(mouseX, mouseY, compRect) && typeof component.handleScroll === 'function') {
                        component.handleScroll(mouseX, mouseY, dir);
                        scrollHandled = true;
                    }
                    componentY += compHeight;
                });
            }

            if (!scrollHandled && isInside(mouseX, mouseY, panel)) {
                let componentsHeight = componentY - (optionY + 70);
                const fixedTop = 70 + PADDING;
                const bottomPadding = PADDING;
                const availableHeight = panel.height - fixedTop - bottomPadding;
                const maxScroll = Math.max(0, componentsHeight - availableHeight);
                const direction = dir > 0 ? -1 : 1;

                this.state.optionsScrollY += direction * SCROLL_SPEED;
                this.state.optionsScrollY = Math.max(0, Math.min(this.state.optionsScrollY, maxScroll));
            }
            return;
        }

        if (this.state.currentPage !== 'categories' || this.state.isTransitioning()) return;
        if (!this.state.selected || !isInside(mouseX, mouseY, panel)) return;

        const maxScroll = Math.max(0, manager.cachedContentHeight - panel.height + PADDING);
        const direction = dir > 0 ? -1 : 1;
        const newScroll = manager.scrollY + direction * SCROLL_SPEED;
        manager.scrollY = Math.max(0, Math.min(newScroll, maxScroll));

        manager.invalidateLayout();
    }

    handleMouseDrag(mouseX, mouseY, state) {
        if (state.currentPage === 'options' && state.selectedItem) {
            const components = state.selectedItem.components;
            if (!components) return;

            components.forEach((component) => {
                if (typeof component.handleMouseDrag === 'function') {
                    component.handleMouseDrag(mouseX, mouseY);
                }
            });
        }
    }

    handleMouseRelease(state) {
        if (state.currentPage === 'options' && state.selectedItem) {
            const components = state.selectedItem.components;
            if (!components) return;

            components.forEach((component) => {
                if (typeof component.handleMouseRelease === 'function') {
                    component.handleMouseRelease();
                }
            });
        }
    }

    updateTransitions() {
        if (this.state.isTransitioning()) {
            const elapsed = Date.now() - this.state.transition.startTime;
            const rawProgress = Math.min(1, elapsed / ANIMATION_DURATION);
            this.state.updateTransition(easeInOutQuad(rawProgress));

            if (rawProgress >= 1) {
                this.state.completeTransition();
                return true;
            }
            return true;
        }
        return false;
    }
}
