import { Button } from '../components/Button';
import { ColorPicker } from '../components/ColorPicker';
import { MultiToggle } from '../components/Dropdown';
import { Popup } from '../components/Popup';
import { Separator } from '../components/Separator';
import { Slider } from '../components/Slider';
import { TextInput } from '../components/TextInput';
import { ToggleButton } from '../components/Toggle';

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
        {
            name: 'Theme',
            items: [],
            subcategories: [],
            directComponents: [],
        },
        {
            name: 'Discord',
            items: [],
            subcategories: [],
            directComponents: [],
            hiddenInSidebar: true,
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
    guiScrollSpeed: 15,

    getVisibleCategories() {
        return Categories.categories.filter((category) => !category.hiddenInSidebar);
    },

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
                subcategory = new Separator(subcategoryName, true);
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
        if (!item) return null;

        const toggle = new ToggleButton(toggleTitle, 0, 0, undefined, undefined, callback, defaultValue);
        toggle.description = description;
        item.components.push(toggle);
        return toggle;
    },

    addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const slider = new Slider(sliderTitle, min, max, 0, 0, undefined, undefined, defaultValue, callback);
        slider.description = description;
        item.components.push(slider);
        return slider;
    },

    addRangeSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const slider = new Slider(sliderTitle, min, max, 0, 0, undefined, undefined, defaultValue, callback, true);
        slider.description = description;
        item.components.push(slider);
        return slider;
    },

    addTextInput(categoryName, itemName, title, defaultValue, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const input = new TextInput(title, 0, 0, undefined, undefined, defaultValue, callback);
        input.description = description;
        item.components.push(input);
        return input;
    },

    addButton(categoryName, itemName, title, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const button = new Button(title, 0, 0, undefined, callback);
        button.description = description;
        item.components.push(button);
        return button;
    },

    addPopup(categoryName, itemName, title, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const popup = new Popup(title, 0, 0, undefined, undefined, callback);
        popup.description = description;
        item.components.push(popup);
        return popup;
    },

    addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null, defaultValue = false) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const multiToggle = new MultiToggle(toggleTitle, 0, 0, options, singleSelect, callback, defaultValue);
        multiToggle.description = description;
        item.components.push(multiToggle);
        return multiToggle;
    },

    addColorPicker(categoryName, itemName, pickerTitle, defaultColor, callback = null, description = null) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const picker = new ColorPicker(pickerTitle, 0, 0, defaultColor, callback);
        picker.description = description;
        item.components.push(picker);
        return picker;
    },

    addSeparator(categoryName, itemName, title, fullWidth = false) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        const separator = new Separator(title, fullWidth);
        item.components.push(separator);
        return separator;
    },

    addSettingsComponent(component, sectionName = null, categoryName = 'Settings') {
        const settingsCat = Categories.categories.find((c) => c.name === categoryName);
        if (!settingsCat) return;

        if (!settingsCat.directComponents) {
            settingsCat.directComponents = [];
        }

        component.sectionName = sectionName;
        settingsCat.directComponents.push(component);
    },

    addSettingsToggle(title, callback = null, description = null, defaultValue = false, sectionName = null, categoryName = 'Settings') {
        const toggle = new ToggleButton(title, 0, 0, undefined, undefined, callback, defaultValue);
        toggle.description = description;
        Categories.addSettingsComponent(toggle, sectionName, categoryName);
        return toggle;
    },

    addSettingsSlider(title, min, max, defaultValue, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        const slider = new Slider(title, min, max, 0, 0, undefined, undefined, defaultValue, callback);
        slider.description = description;
        Categories.addSettingsComponent(slider, sectionName, categoryName);
        return slider;
    },

    addSettingsRangeSlider(title, min, max, defaultValue, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        const slider = new Slider(title, min, max, 0, 0, undefined, undefined, defaultValue, callback, true);
        slider.description = description;
        Categories.addSettingsComponent(slider, sectionName, categoryName);
        return slider;
    },

    addSettingsMultiToggle(
        title,
        options,
        singleSelect = false,
        callback = null,
        description = null,
        defaultValue = false,
        sectionName = null,
        categoryName = 'Settings'
    ) {
        const multiToggle = new MultiToggle(title, 0, 0, options, singleSelect, callback, defaultValue);
        multiToggle.description = description;
        Categories.addSettingsComponent(multiToggle, sectionName, categoryName);
        return multiToggle;
    },

    addSettingsColorPicker(title, defaultColor, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        const picker = new ColorPicker(title, 0, 0, defaultColor, callback);
        picker.description = description;
        Categories.addSettingsComponent(picker, sectionName, categoryName);
        return picker;
    },

    addSettingsTextInput(title, defaultValue, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        const input = new TextInput(title, 0, 0, undefined, undefined, defaultValue, callback);
        input.description = description;
        Categories.addSettingsComponent(input, sectionName, categoryName);
        return input;
    },

    addSettingsButton(title, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        const button = new Button(title, 0, 0, undefined, callback);
        button.description = description;
        Categories.addSettingsComponent(button, sectionName, categoryName);
        return button;
    },

    addSettingsPopup(title, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        const popup = new Popup(title, 0, 0, undefined, undefined, callback);
        popup.description = description;
        Categories.addSettingsComponent(popup, sectionName, categoryName);
        return popup;
    },

    addSettingsSeparator(title, categoryName = 'Settings') {
        const separator = new Separator(title);
        Categories.addSettingsComponent(separator, null, categoryName);
        return separator;
    },

    getSettingsComponents(categoryName = 'Settings') {
        const settingsCat = Categories.categories.find((c) => c.name === categoryName);
        return settingsCat?.directComponents || [];
    },
};
