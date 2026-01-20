import { Categories } from './CategorySystem';
import { MultiToggle } from '../components/Dropdown';
import { ColorPicker } from '../components/ColorPicker';
import { drawSubcategoryButtons, drawOptionsPanel, drawCategoryItems, drawDirectComponents, getCategoryRect } from './CategoryRenderer';
import { handleCategoryClick, handleCategoryScroll, updateCategoryTransitions } from './CategoryEvents';
import { drawRoundedRectangle, drawRoundedRectangleWithBorder, PADDING, scissor, resetScissor } from '../Utils';
import { GuiRectangles } from '../core/GuiState';
import { SearchBar } from './CategorySearchBar';

export const createCategoriesManager = (deps) => {
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
        Categories.optionsScrollY = value;
    };
    const setTargetOptionsScrollY = (value) => {
        targetOptionsScrollY = value;
    };

    const resetCategoryScroll = () => {
        setRightPanelScrollY(0);
        setOptionsScrollY(0);
    };

    const calculateDirectComponentsHeight = (categoryName) => {
        const directCat = Categories.categories.find((c) => c.name === categoryName);
        if (!directCat || !directCat.directComponents) return 0;

        let height = PADDING;
        let currentSection = null;

        directCat.directComponents.forEach((component, index) => {
            if (component.sectionName && component.sectionName !== currentSection) {
                currentSection = component.sectionName;
                if (index > 0) height += 16;
                height += 26;
            }

            let componentHeight = 48 + 6;

            if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
                if (component.animationProgress !== undefined) {
                    componentHeight += component.getExpandedHeight() * component.animationProgress;
                }
            }

            height += componentHeight;
        });

        height += PADDING;
        return height;
    };

    const calculateContentHeight = () => {
        if (!isContentHeightCacheValid && Categories.selected) {
            let height = 0;
            const category = Categories.categories.find((c) => c.name === Categories.selected);

            if (category) {
                if (category.directComponents && category.directComponents.length > 0) {
                    height = calculateDirectComponentsHeight(Categories.selected);
                    cachedContentHeight = height;
                    isContentHeightCacheValid = true;
                    return;
                }

                if (category.subcategories.length > 0) {
                    height += 28 + PADDING;
                }

                const itemsToDisplay = Categories.selectedSubcategory
                    ? category.items.filter((group) => group.type === 'separator' && group.title === Categories.selectedSubcategory)
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
        if (Categories.currentPage === 'options' && Categories.selectedItem) {
            let height = 78 + PADDING;
            const components = Categories.selectedItem.components;
            if (components) {
                components.forEach((component) => {
                    let compHeight = 54;
                    if ((component instanceof MultiToggle || component instanceof ColorPicker) && typeof component.getExpandedHeight === 'function') {
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

        let activeComponentAnimation = false;

        const checkComponentsForAnim = (components) => {
            if (!components) return false;
            return components.some((c) => (c instanceof MultiToggle || c instanceof ColorPicker) && c.animStart !== 0);
        };

        if (Categories.currentPage === 'categories') {
            const directCat = Categories.categories.find((c) => c.name === Categories.selected);
            if (directCat?.directComponents && checkComponentsForAnim(directCat.directComponents)) {
                activeComponentAnimation = true;
            }
        } else if (Categories.currentPage === 'options' && Categories.selectedItem) {
            if (checkComponentsForAnim(Categories.selectedItem.components)) {
                activeComponentAnimation = true;
            }
        }

        if (activeComponentAnimation) {
            isContentHeightCacheValid = false;
            isLayoutCacheValid = false;
        }

        const transitionActive = Categories.transitionDirection !== 0;
        const shouldDrawItems = Categories.currentPage === 'categories' || transitionActive;
        const shouldDrawOptions = Categories.currentPage === 'options' || transitionActive;

        calculateContentHeight();

        const maxScroll = Math.max(0, cachedContentHeight - deps.rectangles.RightPanel.height + PADDING);

        targetRightPanelScrollY = Math.max(0, Math.min(targetRightPanelScrollY, maxScroll));

        const prevScrollY = currentRightPanelScrollY;
        currentRightPanelScrollY += (targetRightPanelScrollY - currentRightPanelScrollY) * SCROLL_SMOOTHING_FACTOR;

        if (Math.abs(currentRightPanelScrollY - prevScrollY) > 0.1) {
            isLayoutCacheValid = false;
        }

        if (shouldDrawOptions) {
            const optionsContentHeight = calculateOptionsContentHeight();
            const maxOptionsScroll = Math.max(0, optionsContentHeight - deps.rectangles.RightPanel.height);
            targetOptionsScrollY = Math.max(0, Math.min(targetOptionsScrollY, maxOptionsScroll));
            currentOptionsScrollY += (targetOptionsScrollY - currentOptionsScrollY) * SCROLL_SMOOTHING_FACTOR;
            Categories.optionsScrollY = currentOptionsScrollY;
        }

        const panel = deps.rectangles.RightPanel;
        const rightPanelScrollY = currentRightPanelScrollY;
        scissor(panel.x, panel.y, panel.width, panel.height);

        if (shouldDrawItems) {
            if (!isLayoutCacheValid) cachedItemLayouts = [];

            const isCategorySwap = transitionActive && Categories.transitionType === 'category-swap';

            const drawSingleCategory = (catName, currentPanelX, isNewCategory) => {
                const cat = Categories.categories.find((c) => c.name === catName);
                if (!cat) return;

                let yOffset = panel.y + PADDING - rightPanelScrollY;

                if (cat.directComponents && cat.directComponents.length > 0) {
                    drawDirectComponents(panel, currentPanelX, panel.y + PADDING, mouseX, mouseY, rightPanelScrollY, catName);
                    return;
                }

                if (cat.subcategories.length > 0) {
                    yOffset = drawSubcategoryButtons(cat, currentPanelX, yOffset, mouseX, mouseY);
                }

                const itemsToDisplay = Categories.selectedSubcategory
                    ? cat.items.filter((group) => group.type === 'separator' && group.title === Categories.selectedSubcategory)
                    : cat.items;

                drawCategoryItems(cat, panel, currentPanelX, yOffset, mouseX, mouseY, itemsToDisplay, cachedItemLayouts, isLayoutCacheValid || !isNewCategory);
            };

            if (isCategorySwap && Categories.previousSelected) {
                const progress = Categories.transitionProgress;
                const dir = Categories.transitionDirection;

                let incomingX = panel.x + (dir === 1 ? panel.width * (1 - progress) : -panel.width * (1 - progress));
                drawSingleCategory(Categories.selected, incomingX, true);

                let outgoingX = panel.x + (dir === 1 ? -panel.width * progress : panel.width * progress);
                drawSingleCategory(Categories.previousSelected, outgoingX, false);
            } else {
                let panelX = panel.x;
                if (transitionActive && Categories.transitionType === 'page') {
                    if (Categories.transitionDirection === 1) panelX -= panel.width * Categories.transitionProgress;
                    else if (Categories.transitionDirection === -1) panelX -= panel.width * (1 - Categories.transitionProgress);
                }

                drawSingleCategory(Categories.selected, panelX, true);

                if (!isLayoutCacheValid && !transitionActive) isLayoutCacheValid = true;
            }
        }

        if (shouldDrawOptions) drawOptionsPanel(panel, mouseX, mouseY);

        resetScissor();

        if (Categories.selected === 'Modules') SearchBar.draw(mouseX, mouseY, deps.rectangles.RightPanel, panel.y + 11, Categories.currentPage);
    };

    const handleClick = (mouseX, mouseY) => {
        const panel = deps.rectangles.RightPanel;
        SearchBar.handleClick(mouseX, mouseY, panel, panel.y + 11);

        handleCategoryClick(
            mouseX,
            mouseY,
            panel,
            currentRightPanelScrollY,
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

        if (Categories.currentPage === 'categories') {
            const directCat = Categories.categories.find((c) => c.name === Categories.selected);
            if (directCat?.directComponents) {
                directCat.directComponents.forEach((component) => {
                    if (typeof component.handleMouseDrag === 'function') {
                        component.optionPanelWidth = deps.rectangles.RightPanel.width;
                        component.handleMouseDrag(mouseX, mouseY);
                    }
                });
            }
        }

        if (Categories.currentPage === 'options' && Categories.selectedItem) {
            const components = Categories.selectedItem.components;
            if (!components) return;
            components.forEach((component) => {
                if (typeof component.handleMouseDrag !== 'function') return;
                component.optionPanelWidth = deps.rectangles.RightPanel.width;
                component.handleMouseDrag(mouseX, mouseY);
            });
        }
    };

    const handleMouseRelease = () => {
        if (Categories.currentPage === 'categories') {
            const directCat = Categories.categories.find((c) => c.name === Categories.selected);
            if (directCat?.directComponents) {
                directCat.directComponents.forEach((component) => {
                    if (typeof component.handleMouseRelease === 'function') {
                        component.handleMouseRelease();
                    }
                });
            }
        }

        if (Categories.currentPage === 'options' && Categories.selectedItem) {
            const components = Categories.selectedItem.components;
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

export const categoryManager = createCategoriesManager({
    rectangles: GuiRectangles,
    draw: {
        drawRoundedRectangle: drawRoundedRectangle,
        drawRoundedRectangleWithBorder: drawRoundedRectangleWithBorder,
    },
    utils: {},
    colors: {},
});
