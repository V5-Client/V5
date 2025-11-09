import './CategorySystem';
import { drawSubcategoryButtons, drawOptionsPanel, drawLeftPanel, drawCategoryItems, getCategoryRect } from './CategoryRenderer';
import { handleCategoryClick, handleCategoryScroll, updateCategoryTransitions } from './CategoryEvents';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder } from '../Utils';
import { PADDING } from '../Utils';

global.createCategoriesManager = (deps) => {
    let rightPanelScrollY = 0;
    let cachedItemLayouts = [];
    let isLayoutCacheValid = false;
    let cachedContentHeight = 0;
    let isContentHeightCacheValid = false;

    const setRightPanelScrollY = (value) => {
        rightPanelScrollY = value;
    };

    const calculateContentHeight = () => {
        if (!isContentHeightCacheValid && global.Categories.selected) {
            let height = 0;
            const category = global.Categories.categories.find((c) => c.name === global.Categories.selected);

            if (category) {
                if (category.subcategories.length > 0) {
                    height += 28 + PADDING;
                }

                const itemsToDisplay = global.Categories.selectedSubcategory
                    ? category.items.filter((group) => group.type === 'separator' && group.title === global.Categories.selectedSubcategory)
                    : category.items;

                let nonGroupedItemCount = 0;

                const calculateNonGroupedHeight = () => {
                    if (nonGroupedItemCount > 0) {
                        const numRows = Math.ceil(nonGroupedItemCount / 3);
                        height += numRows * (48 + 6);
                        nonGroupedItemCount = 0;
                    }
                };

                itemsToDisplay.forEach((group, groupIndex) => {
                    if (group.type === 'separator') {
                        calculateNonGroupedHeight();

                        if (groupIndex > 0) {
                            height += 12;
                        }

                        height += 22;

                        const itemsInSubcategory = group.items.length;
                        if (itemsInSubcategory > 0) {
                            const numRows = Math.ceil(itemsInSubcategory / 3);
                            height += numRows * (48 + 6);
                        }
                    } else {
                        nonGroupedItemCount++;
                    }
                });

                calculateNonGroupedHeight();

                height += PADDING;
            }

            cachedContentHeight = height;
            isContentHeightCacheValid = true;
        }
    };

    const draw = (mouseX, mouseY) => {
        const cacheInvalidated = updateCategoryTransitions();
        if (cacheInvalidated) isLayoutCacheValid = false;

        calculateContentHeight();

        const panel = deps.rectangles.RightPanel;

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

        const transitionActive = global.Categories.transitionDirection !== 0;
        const shouldDrawItems = global.Categories.currentPage === 'categories' || transitionActive;
        const shouldDrawOptions = global.Categories.currentPage === 'options' || transitionActive;

        if (shouldDrawItems) {
            if (!isLayoutCacheValid) cachedItemLayouts = [];

            const cat = global.Categories.categories.find((c) => c.name === global.Categories.selected);
            if (cat) {
                let panelX = panel.x;
                if (global.Categories.transitionDirection === 1) panelX -= panel.width * global.Categories.transitionProgress;
                else if (global.Categories.transitionDirection === -1) panelX -= panel.width * (1 - global.Categories.transitionProgress);

                let yOffset = panel.y + PADDING - rightPanelScrollY;
                if (cat.subcategories.length > 0) {
                    yOffset = drawSubcategoryButtons(panelX, yOffset, mouseX, mouseY);
                }

                const itemsToDisplay = global.Categories.selectedSubcategory
                    ? cat.items.filter((group) => group.type === 'separator' && group.title === global.Categories.selectedSubcategory)
                    : cat.items;

                drawCategoryItems(cat, panel, panelX, yOffset, mouseX, mouseY, itemsToDisplay, cachedItemLayouts, isLayoutCacheValid);

                if (!isLayoutCacheValid) isLayoutCacheValid = true;
            }
        }

        if (shouldDrawOptions) drawOptionsPanel(panel, mouseX, mouseY);

        GL11.glDisable(GL11.GL_SCISSOR_TEST);

        drawLeftPanel(mouseX, mouseY);
    };

    const handleClick = (mouseX, mouseY) => {
        handleCategoryClick(
            mouseX,
            mouseY,
            deps.rectangles.RightPanel,
            cachedItemLayouts,
            getCategoryRect,
            () => {
                isLayoutCacheValid = false;
                rightPanelScrollY = 0;
            },
            () => {
                isContentHeightCacheValid = false;
                rightPanelScrollY = 0;
            }
        );
    };

    const handleScroll = (mouseX, mouseY, dir) => {
        handleCategoryScroll(mouseX, mouseY, dir, deps.rectangles.RightPanel, cachedContentHeight, rightPanelScrollY, setRightPanelScrollY);
        isLayoutCacheValid = false;
    };

    const handleMouseDrag = (mouseX, mouseY) => {
        if (isLayoutCacheValid) isLayoutCacheValid = false;

        if (global.Categories.currentPage === 'options' && global.Categories.selectedItem) {
            const components = global.Categories.selectedItem.components;
            if (!components) return;
            components.forEach((component) => {
                if (typeof component.handleMouseDrag !== 'function') return;
                component.handleMouseDrag(mouseX, mouseY);
            });
        }
    };

    const handleMouseRelease = () => {
        if (global.Categories.currentPage === 'options' && global.Categories.selectedItem) {
            const components = global.Categories.selectedItem.components;
            if (!components) return;
            components.forEach((component) => {
                if (typeof component.handleMouseRelease !== 'function') return;
                component.handleMouseRelease();
            });
        }
    };

    return {
        draw,
        handleClick,
        handleScroll,
        handleMouseDrag,
        handleMouseRelease,
        invalidateLayoutCache: () => {
            isLayoutCacheValid = false;
        },
        invalidateContentHeightCache: () => {
            isContentHeightCacheValid = false;
        },
    };
};

global.categoryManager = global.createCategoriesManager({
    rectangles: global.GuiRectangles,
    draw: {
        drawRoundedRectangle: drawRoundedRectangle,
        drawRoundedRectangleWithBorder: drawRoundedRectangleWithBorder,
    },
    utils: {},
    colors: {},
});
