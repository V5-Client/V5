import { ToggleButton } from '../components/Toggle';
import { Slider } from '../components/Slider';
import { MultiToggle } from '../components/Dropdown';

global.Categories = {
    categories: [
        {
            name: 'Modules',
            items: [],
            subcategories: [],
        },
        {
            name: 'Settings',
            items: [],
            subcategories: [],
        },
    ],
    selected: 'Modules',
    selectedItem: null,
    currentPage: 'categories',
    transitionProgress: 0,
    transitionDirection: 0,
    transitionStart: 0,
    selectedSubcategory: null,
    selectedSubcategoryButton: null,
    subcatTransitionProgress: 1,
    subcatTransitionStart: 0,
    subcatAnimationDuration: 200,
    animationRect: null,
    optionsScrollY: 0,

    catAnimationRect: null,
    catTransitionStart: 0,
    catAnimationDuration: 200,

    addCategoryItem(subcategoryName, title, description, tooltip = null) {
        const category = global.Categories.categories.find(
            (c) => c.name === 'Modules'
        );
        if (!category) return;

        const newItem = {
            title,
            description,
            tooltip,
            expanded: false,
            animation: 40,
            components: [],
            type: 'item',
            subcategoryName: subcategoryName,
        };

        if (subcategoryName) {
            let subcategory = category.items.find(
                (item) =>
                    item.type === 'separator' && item.title === subcategoryName
            );

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
    },

    findItem(categoryName, itemName) {
        const category = global.Categories.categories.find(
            (c) => c.name === categoryName
        );
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
    },

    addToggle(
        categoryName,
        itemName,
        toggleTitle,
        callback = null,
        description = null
    ) {
        const item = global.Categories.findItem(categoryName, itemName);
        if (!item) return;

        const toggle = new ToggleButton(
            toggleTitle,
            0,
            0,
            undefined,
            undefined,
            callback
        );
        toggle.description = description;
        item.components.push(toggle);
    },

    addSlider(
        categoryName,
        itemName,
        sliderTitle,
        min,
        max,
        defaultValue,
        callback = null,
        description = null
    ) {
        const item = global.Categories.findItem(categoryName, itemName);
        if (!item) return;

        const slider = new Slider(
            sliderTitle,
            min,
            max,
            0,
            0,
            undefined,
            undefined,
            defaultValue,
            callback
        );
        slider.description = description;
        item.components.push(slider);
    },

    addMultiToggle(
        categoryName,
        itemName,
        toggleTitle,
        options,
        singleSelect = false,
        callback = null,
        description = null
    ) {
        const item = global.Categories.findItem(categoryName, itemName);
        if (!item) return;

        const multiToggle = new MultiToggle(
            toggleTitle,
            0,
            0,
            options,
            singleSelect,
            callback
        );
        multiToggle.description = description;
        item.components.push(multiToggle);
    },
};
