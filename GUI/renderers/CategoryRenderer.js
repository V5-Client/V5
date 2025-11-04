import {
    PADDING,
    CORNER_RADIUS,
    CATEGORY_HEIGHT,
    CATEGORY_PADDING,
    CATEGORY_OFFSET_Y,
    CATEGORY_BOX_PADDING,
    ITEM_SPACING,
    SEPARATOR_HEIGHT,
    SUBCATEGORY_BUTTON_HEIGHT,
    SUBCATEGORY_BUTTON_SPACING,
} from '../utils/constants';
import { THEME } from '../utils/theme';
import { easeInOutQuad, isInside } from '../utils/helpers';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder } from '../utils/drawing';
import { MultiToggle } from '../components/Dropdown';

const Module_icon = Image.fromAsset('folder.png');
const Setting_icon = Image.fromAsset('settings.png');

export class CategoryRenderer {
    constructor(categoryState) {
        this.state = categoryState;
    }

    draw(mouseX, mouseY, rectangles, manager) {
        const panel = rectangles.rightPanel;

        const scale = Renderer.screen.getScale();
        GL11.glEnable(GL11.GL_SCISSOR_TEST);

        const inset = 2;
        const scissorX = panel.x + inset;
        const scissorY = panel.y + inset;
        const scissorW = panel.width - inset * 2;
        const scissorH = panel.height - inset * 2;

        GL11.glScissor(
            Math.floor(scissorX * scale),
            Math.floor((Renderer.screen.getHeight() - (scissorY + scissorH)) * scale),
            Math.floor(scissorW * scale),
            Math.floor(scissorH * scale)
        );

        const transitionActive = this.state.isTransitioning();
        const shouldDrawItems = this.state.currentPage === 'categories' || transitionActive;
        const shouldDrawOptions = this.state.currentPage === 'options' || transitionActive;

        if (shouldDrawItems) {
            this.drawCategoryPage(panel, mouseX, mouseY, manager);
        }

        if (shouldDrawOptions) {
            this.drawOptionsPanel(panel, mouseX, mouseY);
        }

        GL11.glDisable(GL11.GL_SCISSOR_TEST);

        this.drawLeftPanel(rectangles.leftPanel, mouseX, mouseY);
    }

    drawCategoryPage(panel, mouseX, mouseY, manager) {
        if (!manager.layoutValid) manager.cachedLayouts = [];

        const cat = this.state.getSelectedCategory();
        if (!cat) return;

        let panelX = panel.x;
        if (this.state.transition.direction === 1) {
            panelX -= panel.width * this.state.transition.progress;
        } else if (this.state.transition.direction === -1) {
            panelX -= panel.width * (1 - this.state.transition.progress);
        }

        let yOffset = panel.y + PADDING - manager.scrollY;

        if (cat.subcategories.length > 0) {
            yOffset = this.drawSubcategoryButtons(panelX, yOffset, mouseX, mouseY, cat);
        }

        const itemsToDisplay = this.state.selectedSubcategory
            ? cat.items.filter((group) => group.type === 'separator' && group.title === this.state.selectedSubcategory)
            : cat.items;

        this.drawCategoryItems(cat, panel, panelX, yOffset, mouseX, mouseY, itemsToDisplay, manager);

        if (!manager.layoutValid) manager.layoutValid = true;
    }

    drawSubcategoryButtons(panelX, yOffset, mouseX, mouseY, cat) {
        if (this.state.subcatAnimation.rect) {
            const elapsed = Date.now() - this.state.subcatAnimation.startTime;
            const rawProgress = Math.min(1, elapsed / this.state.subcatAnimation.duration);
            this.state.subcatAnimation.progress = easeInOutQuad(rawProgress);
            const p = this.state.subcatAnimation.progress;

            const rect = this.state.subcatAnimation.rect;
            rect.x = rect.startX + (rect.endX - rect.startX) * p;
            rect.width = rect.startWidth + (rect.endWidth - rect.startWidth) * p;
            rect.y = yOffset;

            if (rawProgress >= 1) {
                this.state.subcatAnimation.rect = null;
            }
        }

        let currentX = panelX + PADDING;
        const subcategoriesToDraw = ['All', ...cat.subcategories];

        subcategoriesToDraw.forEach((subcat) => {
            const buttonTextWidth = Renderer.getStringWidth(subcat) + 10;
            const buttonRect = {
                x: currentX,
                y: yOffset,
                width: buttonTextWidth,
                height: SUBCATEGORY_BUTTON_HEIGHT,
            };

            const isSelected =
                (this.state.selectedSubcategory === subcat || (!this.state.selectedSubcategory && subcat === 'All')) && !this.state.subcatAnimation.rect;

            if (isSelected) this.state.selectedSubcategoryButton = buttonRect;

            if (this.state.subcatAnimation.rect) {
                const rect = this.state.subcatAnimation.rect;
                drawRoundedRectangle({
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    radius: 5,
                    color: THEME.GUI_MANAGER_CATEGORY_SELECTED,
                });
            } else if (isSelected) {
                drawRoundedRectangle({
                    x: buttonRect.x,
                    y: buttonRect.y,
                    width: buttonRect.width,
                    height: buttonRect.height,
                    radius: 5,
                    color: THEME.GUI_MANAGER_CATEGORY_SELECTED,
                });
            }

            Renderer.drawString(
                subcat,
                currentX + 5,
                yOffset + (SUBCATEGORY_BUTTON_HEIGHT - 8) / 2,
                isSelected ? THEME.GUI_MANAGER_CATEGORY_TITLE : THEME.GUI_MANAGER_CATEGORY_DESCRIPTION,
                false
            );
            currentX += buttonTextWidth + SUBCATEGORY_BUTTON_SPACING;
        });

        return yOffset + SUBCATEGORY_BUTTON_HEIGHT + PADDING;
    }

    drawOptionsPanel(panel, mouseX, mouseY) {
        const selectedItem = this.state.selectedItem;
        if (!selectedItem) return;

        let optionPanelX = panel.x;
        if (this.state.transition.direction === 1) {
            optionPanelX += panel.width * (1 - this.state.transition.progress);
        } else if (this.state.transition.direction === -1) {
            optionPanelX += panel.width * this.state.transition.progress;
        }

        const optionX = optionPanelX + PADDING;
        const optionY = panel.y + PADDING;
        const scrollY = this.state.optionsScrollY;

        const backButtonText = 'Back';
        Renderer.drawString(backButtonText, optionX + 10, optionY + 10 - scrollY, THEME.GUI_MANAGER_BACK_TEXT);

        Renderer.drawString(selectedItem.title, optionX + 10, optionY + 30 - scrollY, THEME.GUI_MANAGER_CATEGORY_TITLE, false);
        Renderer.drawString(selectedItem.description, optionX + 20, optionY + 45 - scrollY, THEME.GUI_MANAGER_CATEGORY_DESCRIPTION, false);

        let drawnCompY = optionY + 70 - scrollY;
        selectedItem.components.forEach((component) => {
            if (typeof component.draw !== 'function') return;

            component.x = optionX + 10;
            component.y = drawnCompY;
            component.optionPanelWidth = panel.width;
            component.optionPanelHeight = panel.height;

            component.draw(mouseX, mouseY);

            let thisHeight = 45;
            if (component instanceof MultiToggle && component.animationProgress > 0) {
                thisHeight += component.getExpandedHeight() * component.animationProgress;
            }
            drawnCompY += thisHeight;
        });
    }

    drawLeftPanel(leftPanel, mouseX, mouseY) {
        if (this.state.categoryAnimation.rect) {
            const elapsed = Date.now() - this.state.categoryAnimation.startTime;
            const rawProgress = Math.min(1, elapsed / this.state.categoryAnimation.duration);
            const p = easeInOutQuad(rawProgress);

            const rect = this.state.categoryAnimation.rect;
            rect.x = rect.startX + (rect.endX - rect.startX) * p;
            rect.y = rect.startY + (rect.endY - rect.startY) * p;

            if (rawProgress >= 1) {
                this.state.categoryAnimation.rect = null;
            }
        }

        this.state.categories.forEach((cat, i) => {
            const rect = this.getCategoryRect(leftPanel, i);
            const moduleSize = 25;
            const iconX = rect.x + (rect.width - moduleSize) / 2;
            const iconY = rect.y + (rect.height - moduleSize) / 2;

            let iconToDraw = cat.name === 'Modules' ? Module_icon : cat.name === 'Settings' ? Setting_icon : Module_icon;

            const highlightRect = {
                x: iconX - 1,
                y: iconY - 1,
                width: moduleSize + 2,
                height: moduleSize + 2,
                radius: 5,
                color: THEME.GUI_MANAGER_CATEGORY_SELECTED,
            };

            const isSelected = cat.name === this.state.selected;

            if (!this.state.categoryAnimation.rect && isSelected) {
                drawRoundedRectangle(highlightRect);
            }

            iconToDraw.draw(iconX, iconY, moduleSize, moduleSize);

            if (i === 0 && global.discordPfp) {
                const pfpX = iconX - 1;
                const pfpY = iconY - 58;
                const iconSize = moduleSize - 2;
                Renderer.drawImage(global.discordPfp, pfpX, pfpY, iconSize, iconSize);
            }
        });

        if (this.state.categoryAnimation.rect) {
            const rect = this.state.categoryAnimation.rect;
            drawRoundedRectangle({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                radius: rect.radius,
                color: THEME.GUI_MANAGER_CATEGORY_SELECTED,
            });
        }
    }

    drawCategoryItems(cat, panel, panelX, yOffset, mouseX, mouseY, itemsToDisplay, manager) {
        const panelWidth = panel.width - PADDING * 2;
        const itemWidth = (panelWidth - ITEM_SPACING * 2) / 3;
        let itemIndexInRow = 0;

        itemsToDisplay.forEach((group) => {
            if (group.type === 'separator') {
                const separatorY = yOffset + SEPARATOR_HEIGHT / 2;
                const separatorX = panelX + PADDING;

                drawRoundedRectangle({
                    x: separatorX,
                    y: separatorY,
                    width: panelWidth,
                    height: 1,
                    radius: 5,
                    color: THEME.GUI_MANAGER_UNIVERSAL_GRAY,
                });

                const separatorTextWidth = Renderer.getStringWidth(group.title);
                const separatorTextX = separatorX + panelWidth / 2 - separatorTextWidth / 2;
                Renderer.drawString(group.title, separatorTextX, separatorY - 10, THEME.GUI_MANAGER_CATEGORY_DESCRIPTION, false);
                yOffset += SEPARATOR_HEIGHT;

                let subcategoryItemsInRow = 0;
                group.items.forEach((item) => {
                    const col = subcategoryItemsInRow % 3;
                    if (col === 0 && subcategoryItemsInRow > 0) {
                        yOffset += CATEGORY_BOX_PADDING + 40;
                    }

                    const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
                    this.drawItemBox(item, itemX, yOffset, itemWidth, mouseX, mouseY, manager, true);

                    subcategoryItemsInRow++;
                });

                const numRows = Math.ceil(group.items.length / 3);
                yOffset += numRows > 0 ? 40 + CATEGORY_BOX_PADDING : 0;
            } else {
                if (this.state.selectedSubcategory !== null) return;

                const col = itemIndexInRow % 3;
                if (col === 0 && itemIndexInRow > 0) {
                    yOffset += 40 + CATEGORY_BOX_PADDING;
                }

                const itemX = panelX + PADDING + col * (itemWidth + ITEM_SPACING);
                this.drawItemBox(group, itemX, yOffset, itemWidth, mouseX, mouseY, manager, false);

                itemIndexInRow++;
            }
        });
    }

    drawItemBox(item, itemX, itemY, itemWidth, mouseX, mouseY, manager, centerText) {
        const itemRect = {
            x: itemX,
            y: itemY,
            width: itemWidth,
            height: 40,
            radius: CORNER_RADIUS,
            color: THEME.GUI_MANAGER_CATEGORY_BOX,
            borderWidth: 0.5,
            borderColor: THEME.GUI_MANAGER_CATEGORY_BOX_BORDER,
        };

        const isHovered = isInside(mouseX, mouseY, itemRect);
        itemRect.color = isHovered ? THEME.GUI_MANAGER_UNIVERSAL_GRAY : THEME.GUI_MANAGER_CATEGORY_BOX;

        if (isHovered && item.tooltip && global.setTooltip) {
            global.setTooltip(item.tooltip);
        }

        drawRoundedRectangleWithBorder(itemRect);

        if (!manager.layoutValid) {
            manager.cachedLayouts.push({ rect: itemRect, item });
        }

        const textX = centerText ? itemX + itemWidth / 2 - Renderer.getStringWidth(item.title) / 2 : itemX + 5;
        Renderer.drawString(item.title, textX, itemY + 40 / 2 - 4, THEME.GUI_MANAGER_CATEGORY_TITLE, false);
    }

    getCategoryRect(leftPanel, index) {
        return {
            x: leftPanel.x + PADDING,
            y: leftPanel.y + PADDING + CATEGORY_OFFSET_Y + index * (CATEGORY_HEIGHT + CATEGORY_PADDING),
            width: leftPanel.width - PADDING * 2,
            height: CATEGORY_HEIGHT,
        };
    }
}
