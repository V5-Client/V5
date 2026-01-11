import { ToggleButton } from '../components/Toggle';
import { Slider } from '../components/Slider';
import { MultiToggle } from '../components/Dropdown';
import { ColorPicker } from '../components/ColorPicker';

export const Categories = {
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
            directComponents: [],
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
    optionsScrollY: 0,
    previousSelected: null,
    transitionType: null,
    animationRect: null,

    catAnimationRect: null,
    catTransitionStart: 0,
    catAnimationDuration: 200,

    hoverStates: {},

    addCategoryItem(subcategoryName, title, description, tooltip = null) {
        const category = Categories.categories.find((c) => c.name === 'Modules');
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
    },

    findItem(categoryName, itemName) {
        const category = Categories.categories.find((c) => c.name === categoryName);
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

    addToggle(categoryName, itemName, toggleTitle, callback = null, description = null, defaultValue = false) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return;

        const toggle = new ToggleButton(toggleTitle, 0, 0, undefined, undefined, callback, defaultValue);
        toggle.description = description;
        item.components.push(toggle);
    },

    addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return;

        const slider = new Slider(sliderTitle, min, max, 0, 0, undefined, undefined, defaultValue, callback);
        slider.description = description;
        item.components.push(slider);
    },

    addRangeSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return;

        const slider = new Slider(sliderTitle, min, max, 0, 0, undefined, undefined, defaultValue, callback, true);
        slider.description = description;
        item.components.push(slider);
    },

    addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null, defaultValue = false) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return;

        const multiToggle = new MultiToggle(toggleTitle, 0, 0, options, singleSelect, callback, defaultValue);
        multiToggle.description = description;
        item.components.push(multiToggle);
    },

    addColorPicker(categoryName, itemName, pickerTitle, defaultColor, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return;

        const picker = new ColorPicker(pickerTitle, 0, 0, defaultColor, callback);
        picker.description = description;
        item.components.push(picker);
    },

    addSettingsComponent(component, sectionName = null) {
        const settingsCat = Categories.categories.find((c) => c.name === 'Settings');
        if (!settingsCat) return;

        if (!settingsCat.directComponents) {
            settingsCat.directComponents = [];
        }

        component.sectionName = sectionName;
        settingsCat.directComponents.push(component);
    },

    addSettingsToggle(title, callback = null, description = null, defaultValue = false, sectionName = null) {
        const toggle = new ToggleButton(title, 0, 0, undefined, undefined, callback, defaultValue);
        toggle.description = description;
        Categories.addSettingsComponent(toggle, sectionName);
        return toggle;
    },

    addSettingsSlider(title, min, max, defaultValue, callback = null, description = null, sectionName = null) {
        const slider = new Slider(title, min, max, 0, 0, undefined, undefined, defaultValue, callback);
        slider.description = description;
        Categories.addSettingsComponent(slider, sectionName);
        return slider;
    },

    addSettingsRangeSlider(title, min, max, defaultValue, callback = null, description = null, sectionName = null) {
        const slider = new Slider(title, min, max, 0, 0, undefined, undefined, defaultValue, callback, true);
        slider.description = description;
        Categories.addSettingsComponent(slider, sectionName);
        return slider;
    },

    addSettingsMultiToggle(title, options, singleSelect = false, callback = null, description = null, defaultValue = false, sectionName = null) {
        const multiToggle = new MultiToggle(title, 0, 0, options, singleSelect, callback, defaultValue);
        multiToggle.description = description;
        Categories.addSettingsComponent(multiToggle, sectionName);
        return multiToggle;
    },

    addSettingsColorPicker(title, defaultColor, callback = null, description = null, sectionName = null) {
        const picker = new ColorPicker(title, 0, 0, defaultColor, callback);
        picker.description = description;
        Categories.addSettingsComponent(picker, sectionName);
        return picker;
    },

    getSettingsComponents() {
        const settingsCat = Categories.categories.find((c) => c.name === 'Settings');
        return settingsCat?.directComponents || [];
    },
};
