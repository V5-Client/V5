import { SUBCATEGORY_BUTTON_HEIGHT, ITEM_SPACING, SEPARATOR_HEIGHT, PADDING } from '../utils/constants';
import { CategoryState } from '../state/CategoryState';
import { CategoryRenderer } from '../renderers/CategoryRenderer';
import { CategoryEventHandler } from '../events/CategoryEvents';
import { ToggleButton } from '../components/Toggle';
import { Slider } from '../components/Slider';
import { MultiToggle } from '../components/Dropdown';

export class CategoryManager {
    constructor() {
        this.state = new CategoryState();
        this.renderer = new CategoryRenderer(this.state);
        this.eventHandler = new CategoryEventHandler(this.state);

        this.scrollY = 0;
        this.cachedLayouts = [];
        this.cachedContentHeight = 0;
        this.layoutValid = false;
        this.heightValid = false;
    }

    // Public API
    addItem(subcategoryName, title, description, tooltip = null) {
        const category = this.state.getCategory('Modules');
        if (!category) return;

        const newItem = {
            title,
            description,
            tooltip,
            expanded: false,
            components: [],
            type: 'item',
            subcategoryName,
        };

        if (subcategoryName) {
            let subcategory = category.items.find((item) => item.type === 'separator' && item.title === subcategoryName);

            if (!subcategory) {
                subcategory = {
                    title: subcategoryName,
                    type: 'separator',
                    items: [],
                };
                category.items.push(subcategory);
                category.subcategories.push(subcategoryName);
            }
            subcategory.items.push(newItem);
        } else {
            category.items.push(newItem);
        }
    }

    findItem(categoryName, itemName) {
        const category = this.state.getCategory(categoryName);
        if (!category) return null;

        for (const group of category.items) {
            if (group.type === 'separator') {
                const item = group.items.find((i) => i.title === itemName);
                if (item) return item;
            } else if (group.title === itemName) {
                return group;
            }
        }
        return null;
    }

    addToggle(categoryName, itemName, toggleTitle, callback = null, description = null) {
        const item = this.findItem(categoryName, itemName);
        if (!item) return;

        const toggle = new ToggleButton(toggleTitle, 0, 0, undefined, undefined, callback);
        toggle.description = description;
        item.components.push(toggle);
    }

    addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) {
        const item = this.findItem(categoryName, itemName);
        if (!item) return;

        const slider = new Slider(sliderTitle, min, max, 0, 0, undefined, undefined, defaultValue, callback);
        slider.description = description;
        item.components.push(slider);
    }

    addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null) {
        const item = this.findItem(categoryName, itemName);
        if (!item) return;

        const multiToggle = new MultiToggle(toggleTitle, 0, 0, options, singleSelect, callback);
        multiToggle.description = description;
        item.components.push(multiToggle);
    }

    // Event handling
    handleClick(mouseX, mouseY, rectangles) {
        return this.eventHandler.handleClick(mouseX, mouseY, rectangles, this);
    }

    handleScroll(mouseX, mouseY, dir, rectangles) {
        return this.eventHandler.handleScroll(mouseX, mouseY, dir, rectangles, this);
    }

    handleMouseDrag(mouseX, mouseY) {
        return this.eventHandler.handleMouseDrag(mouseX, mouseY, this.state);
    }

    handleMouseRelease() {
        return this.eventHandler.handleMouseRelease(this.state);
    }

    calculateContentHeight() {
        if (!this.heightValid && this.state.selected) {
            let height = 0;
            const category = this.state.getSelectedCategory();

            if (category) {
                if (category.subcategories.length > 0) {
                    height += SUBCATEGORY_BUTTON_HEIGHT + PADDING * 2;
                }

                const itemsToDisplay = this.state.selectedSubcategory
                    ? category.items.filter((group) => group.type === 'separator' && group.title === this.state.selectedSubcategory)
                    : category.items;

                let nonGroupedItemCount = 0;

                const calculateNonGroupedHeight = () => {
                    if (nonGroupedItemCount > 0) {
                        const numRows = Math.ceil(nonGroupedItemCount / 3);
                        const heightForRows = numRows * (40 + ITEM_SPACING);
                        height += heightForRows - ITEM_SPACING;
                        nonGroupedItemCount = 0;
                    }
                };

                itemsToDisplay.forEach((group) => {
                    if (group.type === 'separator') {
                        calculateNonGroupedHeight();
                        height += SEPARATOR_HEIGHT;
                        const itemsInSubcategory = group.items.length;
                        if (itemsInSubcategory > 0) {
                            const numRows = Math.ceil(itemsInSubcategory / 3);
                            height += numRows * (40 + ITEM_SPACING);
                        }
                    } else {
                        nonGroupedItemCount++;
                    }
                });

                calculateNonGroupedHeight();
            }

            this.cachedContentHeight = height;
            this.heightValid = true;
        }
    }

    // Rendering
    draw(mouseX, mouseY, rectangles) {
        const cacheInvalidated = this.eventHandler.updateTransitions();
        if (cacheInvalidated) {
            this.layoutValid = false;
        }

        this.calculateContentHeight();

        this.renderer.draw(mouseX, mouseY, rectangles, this);
    }

    // Cache management
    invalidateLayout() {
        this.layoutValid = false;
        this.scrollY = 0;
    }

    invalidateHeight() {
        this.heightValid = false;
        this.scrollY = 0;
    }
}
