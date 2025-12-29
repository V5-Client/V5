import './CategorySystem';
import { MultiToggle } from '../components/Dropdown';
import { drawSubcategoryButtons, drawOptionsPanel, drawCategoryItems, getCategoryRect } from './CategoryRenderer';
import { handleCategoryClick, handleCategoryScroll, updateCategoryTransitions } from './CategoryEvents';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder } from '../Utils';
import { PADDING } from '../Utils';

global.createCategoriesManager = (deps) => {
    let targetRightPanelScrollY = 0;
    let currentRightPanelScrollY = 0;

    let targetOptionsScrollY = 0;
    let currentOptionsScrollY = 0;

    let cachedItemLayouts = [];
    let isLayoutCacheValid = false;
    let cachedContentHeight = 0;
    let isContentHeightCacheValid = false;

    const SCROLL_SMOOTHING_FACTOR = 0.2;

    const setRightPanelScrollY = (value) => {
        currentRightPanelScrollY = value;
        targetRightPanelScrollY = value;
    };
    const setTargetRightPanelScrollY = (value) => {
        targetRightPanelScrollY = value;
    };

    const setOptionsScrollY = (value) => {
        currentOptionsScrollY = value;
        targetOptionsScrollY = value;
        global.Categories.optionsScrollY = value;
    };
    const setTargetOptionsScrollY = (value) => {
        targetOptionsScrollY = value;
    };

    const resetCategoryScroll = () => {
        setRightPanelScrollY(0);
        setOptionsScrollY(0);
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

                        if (groupIndex > 0) height += 12;
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

    const calculateOptionsContentHeight = () => {
        if (global.Categories.currentPage === 'options' && global.Categories.selectedItem) {
            let height = 78 + PADDING;
            const components = global.Categories.selectedItem.components;
            if (components) {
                components.forEach((component) => {
                    let compHeight = 54;
                    if (component instanceof MultiToggle) {
                        compHeight += component.getExpandedHeight() * (component.animationProgress || 0);
                    }
                    height += compHeight;
                });
            }
            height += PADDING;
            return height;
        }
        return 0;
    };

    const draw = (mouseX, mouseY) => {
        const cacheInvalidated = updateCategoryTransitions();
        if (cacheInvalidated) isLayoutCacheValid = false;

        const transitionActive = global.Categories.transitionDirection !== 0;
        const shouldDrawItems = global.Categories.currentPage === 'categories' || transitionActive;
        const shouldDrawOptions = global.Categories.currentPage === 'options' || transitionActive;

        calculateContentHeight();

        const maxScroll = Math.max(0, cachedContentHeight - deps.rectangles.RightPanel.height + PADDING);

        targetRightPanelScrollY = Math.max(0, Math.min(targetRightPanelScrollY, maxScroll));

        currentRightPanelScrollY += (targetRightPanelScrollY - currentRightPanelScrollY) * SCROLL_SMOOTHING_FACTOR;

        if (shouldDrawOptions) {
            const optionsContentHeight = calculateOptionsContentHeight();
            const maxOptionsScroll = Math.max(0, optionsContentHeight - deps.rectangles.RightPanel.height);
            targetOptionsScrollY = Math.max(0, Math.min(targetOptionsScrollY, maxOptionsScroll));
            currentOptionsScrollY += (targetOptionsScrollY - currentOptionsScrollY) * SCROLL_SMOOTHING_FACTOR;
            global.Categories.optionsScrollY = currentOptionsScrollY;
        }

        const rightPanelScrollY = currentRightPanelScrollY;
        const panel = deps.rectangles.RightPanel;

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
                resetCategoryScroll();
            },
            () => {
                isContentHeightCacheValid = false;
                resetCategoryScroll();
            },
            resetCategoryScroll
        );
    };

    const handleScroll = (mouseX, mouseY, dir) => {
        handleCategoryScroll(
            mouseX,
            mouseY,
            dir,
            deps.rectangles.RightPanel,
            cachedContentHeight,
            targetRightPanelScrollY,
            setTargetRightPanelScrollY,
            targetOptionsScrollY,
            setTargetOptionsScrollY,
            calculateOptionsContentHeight()
        );
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
        resetScroll: () => {
            resetCategoryScroll();
        },

        getRightPanelScrollY: () => currentRightPanelScrollY,
        setRightPanelScrollY: (value) => {
            setRightPanelScrollY(value);
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
