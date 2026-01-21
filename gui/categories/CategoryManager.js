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
    let lastQuery = '';

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

    const getFilteredItems = (cat, query) => {
        const search = query.trim().toLowerCase();

        if (!search) {
            return cat.items.filter((group) => {
                if (group.type === 'separator') {
                    return Categories.selectedSubcategory === null || group.title === Categories.selectedSubcategory;
                }
                return true;
            });
        }

        const categoryMatches = cat.name.toLowerCase().includes(search);

        return cat.items.reduce((acc, group) => {
            if (group.type === 'separator') {
                const subcategoryMatches = group.title.toLowerCase().includes(search);

                const matchingItems = group.items.filter((item) => {
                    const titleMatch = item.title.toLowerCase().includes(search);
                    const descMatch = item.description && item.description.toLowerCase().includes(search);

                    const componentMatch = item.components && item.components.some((comp) => comp.title && comp.title.toLowerCase().includes(search));
                    return categoryMatches || subcategoryMatches || titleMatch || descMatch || componentMatch;
                });

                if (matchingItems.length > 0) {
                    const groupCopy = Object.assign(Object.create(Object.getPrototypeOf(group)), group);
                    groupCopy.items = matchingItems;
                    acc.push(groupCopy);
                }
            } else {
                const titleMatch = group.title.toLowerCase().includes(search);
                const componentMatch = group.components && group.components.some((comp) => comp.title && comp.title.toLowerCase().includes(search));

                if (categoryMatches || titleMatch || componentMatch) {
                    acc.push(group);
                }
            }
            return acc;
        }, []);
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
                const query = SearchBar.query.trim().toLowerCase();
                if (category.subcategories.length > 0 && query.length === 0) {
                    height += 28 + PADDING;
                }
                const itemsToDisplay = getFilteredItems(category, query);
                let nonGroupedItemCount = 0;
                const processNonGrouped = () => {
                    if (nonGroupedItemCount > 0) {
                        height += Math.ceil(nonGroupedItemCount / 3) * 54;
                        nonGroupedItemCount = 0;
                    }
                };
                itemsToDisplay.forEach((group, index) => {
                    if (group.type === 'separator') {
                        processNonGrouped();
                        if (index > 0) height += 12;
                        height += 22;
                        if (group.items.length > 0) {
                            height += Math.ceil(group.items.length / 3) * 54;
                        }
                    } else {
                        nonGroupedItemCount++;
                    }
                });
                processNonGrouped();
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
        const query = SearchBar.query.trim().toLowerCase();
        if (query !== lastQuery) {
            isContentHeightCacheValid = false;
            isLayoutCacheValid = false;
            lastQuery = query;
        }

        const cacheInvalidated = updateCategoryTransitions();
        if (cacheInvalidated) isLayoutCacheValid = false;

        let activeComponentAnimation = false;

        const checkComponentsForAnim = (components) => {
            if (!components) return false;
            return components.some((c) => (c instanceof MultiToggle || c instanceof ColorPicker) && c.animStart !== 0);
        };

        if (Categories.currentPage === 'categories') {
            const directCat = Categories.categories.find((c) => c.name === Categories.selected);
            if (directCat?.directComponents && checkComponentsForAnim(directCat.directComponents)) activeComponentAnimation = true;
        } else if (Categories.currentPage === 'options' && Categories.selectedItem) {
            if (checkComponentsForAnim(Categories.selectedItem.components)) activeComponentAnimation = true;
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

        if (Math.abs(currentRightPanelScrollY - prevScrollY) > 0.1) isLayoutCacheValid = false;

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
                let yOffset = panel.y + PADDING - currentRightPanelScrollY;
                if (cat.directComponents && cat.directComponents.length > 0) {
                    drawDirectComponents(panel, currentPanelX, panel.y + PADDING, mouseX, mouseY, currentRightPanelScrollY, catName);
                    return;
                }
                if (cat.subcategories.length > 0) yOffset = drawSubcategoryButtons(cat, currentPanelX, yOffset, mouseX, mouseY);
                const itemsToDisplay = getFilteredItems(cat, query);
                drawCategoryItems(cat, panel, currentPanelX, yOffset, mouseX, mouseY, itemsToDisplay, cachedItemLayouts, isLayoutCacheValid || !isNewCategory);
            };

            if (isCategorySwap && Categories.previousSelected) {
                const progress = Categories.transitionProgress;
                const dir = Categories.transitionDirection;

                let incomingX = panel.x + (dir === 1 ? panel.width * (1 - progress) : -panel.width * (1 - progress));
                drawSingleCategory(Categories.selected, incomingX, true);
                if (Categories.selected === 'Modules') SearchBar.draw(mouseX, mouseY, { ...panel, x: incomingX }, panel.y + 11 - currentRightPanelScrollY);
                let outgoingX = panel.x + (dir === 1 ? -panel.width * progress : panel.width * progress);
                drawSingleCategory(Categories.previousSelected, outgoingX, false);
                if (Categories.previousSelected === 'Modules')
                    SearchBar.draw(mouseX, mouseY, { ...panel, x: outgoingX }, panel.y + 11 - currentRightPanelScrollY);
            } else {
                let panelX = panel.x;
                if (transitionActive && Categories.transitionType === 'page') {
                    if (Categories.transitionDirection === 1) panelX -= panel.width * Categories.transitionProgress;
                    else if (Categories.transitionDirection === -1) panelX -= panel.width * (1 - Categories.transitionProgress);
                }

                drawSingleCategory(Categories.selected, panelX, true);
                if (Categories.selected === 'Modules') SearchBar.draw(mouseX, mouseY, { ...panel, x: panelX }, panel.y + 11 - currentRightPanelScrollY);
                if (!isLayoutCacheValid && !transitionActive) isLayoutCacheValid = true;
            }
        }

        if (shouldDrawOptions) drawOptionsPanel(panel, mouseX, mouseY);
        resetScissor();
    };

    const handleClick = (mouseX, mouseY) => {
        const panel = deps.rectangles.RightPanel;
        if (SearchBar.handleClick(mouseX, mouseY, panel, panel.y + 11)) {
            isLayoutCacheValid = false;
            isContentHeightCacheValid = false;
            resetCategoryScroll();
            return;
        }
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
        isLayoutCacheValid = false;
        const activeCat = Categories.categories.find((c) => c.name === Categories.selected);
        const components = Categories.currentPage === 'categories' ? activeCat?.directComponents : Categories.selectedItem?.components;
        components?.forEach((c) => {
            if (typeof c.handleMouseDrag === 'function') {
                c.optionPanelWidth = deps.rectangles.RightPanel.width;
                c.handleMouseDrag(mouseX, mouseY);
            }
        });
    };

    const handleMouseRelease = () => {
        const activeCat = Categories.categories.find((c) => c.name === Categories.selected);
        const components = Categories.currentPage === 'categories' ? activeCat?.directComponents : Categories.selectedItem?.components;
        components?.forEach((c) => {
            if (typeof c.handleMouseRelease === 'function') c.handleMouseRelease();
        });
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
        resetScroll: resetCategoryScroll,
        getRightPanelScrollY: () => currentRightPanelScrollY,
        setRightPanelScrollY: (v) => setRightPanelScrollY(v),
    };
};

export const categoryManager = createCategoriesManager({
    rectangles: GuiRectangles,
    draw: { drawRoundedRectangle, drawRoundedRectangleWithBorder },
    utils: {},
    colors: {},
});
