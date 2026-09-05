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
            name: 'Dashboard',
            items: [],
            subcategories: [],
        },
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
        {
            name: 'Changelog',
            items: [],
            subcategories: [],
            hiddenInSidebar: true,
        },
    ],
    selected: 'Dashboard',
    selectedItem: null,
    currentPage: 'categories',
    transitionProgress: 0,
    transitionDirection: 0,
    transitionStart: 0,
    selectedSubcategory: null,
    selectedSubcategoryButton: null,
    subcatScrollCategory: null,
    subcatScrollX: 0,
    subcatScrollUpdatedAt: 0,
    subcatTransitionProgress: 1,
    subcatTransitionStart: 0,
    subcatAnimationDuration: 200,
    optionsScrollY: 0,
    previousSelected: null,
    transitionType: null,
    animationRect: null,
    optionsReturnCategory: null,

    catAnimationRect: null,
    catTransitionStart: 0,
    catAnimationDuration: 200,

    hoverStates: {},
    guiScrollSpeed: 25,
    dataRevision: 0,

    getVisibleCategories() {
        return Categories.categories.filter((category) => !category.hiddenInSidebar);
    },

    addCategoryItem(subcategoryName, title, description, tooltip = null, moduleType = null) {
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
            moduleType,
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
        Categories.dataRevision++;
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

    addComponent(categoryName, itemName, component, description) {
        const item = Categories.findItem(categoryName, itemName);
        if (!item) return null;

        if (description !== undefined) component.description = description;
        item.components.push(component);
        Categories.dataRevision++;
        return component;
    },

    addToggle(categoryName, itemName, toggleTitle, callback = null, description = null, defaultValue = false) {
        return Categories.addComponent(categoryName, itemName, new ToggleButton(toggleTitle, 0, 0, undefined, undefined, callback, defaultValue), description);
    },

    addSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) {
        return Categories.addComponent(
            categoryName,
            itemName,
            new Slider(sliderTitle, min, max, 0, 0, undefined, undefined, defaultValue, callback),
            description
        );
    },

    addRangeSlider(categoryName, itemName, sliderTitle, min, max, defaultValue, callback = null, description = null) {
        return Categories.addComponent(
            categoryName,
            itemName,
            new Slider(sliderTitle, min, max, 0, 0, undefined, undefined, defaultValue, callback, true),
            description
        );
    },

    addTextInput(categoryName, itemName, title, defaultValue, callback = null, description = null) {
        return Categories.addComponent(categoryName, itemName, new TextInput(title, 0, 0, undefined, undefined, defaultValue, callback), description);
    },

    addButton(categoryName, itemName, title, callback = null, description = null) {
        return Categories.addComponent(categoryName, itemName, new Button(title, 0, 0, undefined, callback), description);
    },

    addPopup(categoryName, itemName, title, callback = null, description = null) {
        return Categories.addComponent(categoryName, itemName, new Popup(title, 0, 0, undefined, undefined, callback), description);
    },

    addMultiToggle(categoryName, itemName, toggleTitle, options, singleSelect = false, callback = null, description = null, defaultValue = false) {
        return Categories.addComponent(categoryName, itemName, new MultiToggle(toggleTitle, 0, 0, options, singleSelect, callback, defaultValue), description);
    },

    addColorPicker(categoryName, itemName, pickerTitle, defaultColor, callback = null, description = null) {
        return Categories.addComponent(categoryName, itemName, new ColorPicker(pickerTitle, 0, 0, defaultColor, callback), description);
    },

    addSeparator(categoryName, itemName, title, fullWidth = false) {
        return Categories.addComponent(categoryName, itemName, new Separator(title, fullWidth));
    },

    attachSettingsComponent(component, sectionName = null, categoryName = 'Settings', description) {
        const settingsCat = Categories.categories.find((c) => c.name === categoryName);
        if (!settingsCat) return null;

        if (!settingsCat.directComponents) {
            settingsCat.directComponents = [];
        }

        if (sectionName && !settingsCat.subcategories.includes(sectionName)) {
            settingsCat.subcategories.push(sectionName);
        }
        component.sectionName = sectionName;
        if (description !== undefined) component.description = description;
        settingsCat.directComponents.push(component);
        Categories.dataRevision++;
        return component;
    },

    addSettingsToggle(title, callback = null, description = null, defaultValue = false, sectionName = null, categoryName = 'Settings') {
        return Categories.attachSettingsComponent(
            new ToggleButton(title, 0, 0, undefined, undefined, callback, defaultValue),
            sectionName,
            categoryName,
            description
        );
    },

    addSettingsSlider(title, min, max, defaultValue, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        return Categories.attachSettingsComponent(
            new Slider(title, min, max, 0, 0, undefined, undefined, defaultValue, callback),
            sectionName,
            categoryName,
            description
        );
    },

    addSettingsRangeSlider(title, min, max, defaultValue, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        return Categories.attachSettingsComponent(
            new Slider(title, min, max, 0, 0, undefined, undefined, defaultValue, callback, true),
            sectionName,
            categoryName,
            description
        );
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
        return Categories.attachSettingsComponent(
            new MultiToggle(title, 0, 0, options, singleSelect, callback, defaultValue),
            sectionName,
            categoryName,
            description
        );
    },

    addSettingsColorPicker(title, defaultColor, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        return Categories.attachSettingsComponent(new ColorPicker(title, 0, 0, defaultColor, callback), sectionName, categoryName, description);
    },

    addSettingsTextInput(title, defaultValue, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        return Categories.attachSettingsComponent(
            new TextInput(title, 0, 0, undefined, undefined, defaultValue, callback),
            sectionName,
            categoryName,
            description
        );
    },

    addSettingsButton(title, callback = null, description = null, sectionName = null, categoryName = 'Settings') {
        return Categories.attachSettingsComponent(new Button(title, 0, 0, undefined, callback), sectionName, categoryName, description);
    },
};

export const getVisibleDirectComponents = (categoryName) => {
    const category = Categories.categories.find((item) => item.name === categoryName);
    if (!category?.directComponents) return [];
    return Categories.selectedSubcategory === null
        ? category.directComponents
        : category.directComponents.filter((component) => component.sectionName === Categories.selectedSubcategory);
};
