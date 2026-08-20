import { Categories } from './categories/CategorySystem';
import { GuiState } from './core/GuiState';
import { isGuiClickSoundEnabled, setGuiClickSoundEnabled } from './Utils';
import { getAvailableLocales, getLanguageOverride, setLanguageOverride, t } from '../utils/I18n';

const initProfileSettings = () => {
    let guiScaleSetting;
    const settingsCat = Categories.categories.find((category) => category.name === 'Settings');
    let discordCat = Categories.categories.find((category) => category.name === 'Discord');
    if (!discordCat) {
        discordCat = {
            name: 'Discord',
            items: [],
            subcategories: [],
            directComponents: [],
            hiddenInSidebar: true,
        };
        Categories.categories.push(discordCat);
    } else if (!discordCat.directComponents) {
        discordCat.directComponents = [];
    }

    const languageOptions = getAvailableLocales().map((locale) => ({ name: locale, displayName: t(`language.${locale}`), displayKey: `language.${locale}` }));
    if (settingsCat && !settingsCat.directComponents.some((component) => component.title === 'Language')) {
        Categories.addSettingsMultiToggle(
            'settings.language',
            languageOptions,
            true,
            (options) => {
                const selected = options.find((option) => option.enabled);
                setLanguageOverride(selected?.name || 'en_us');
            },
            'settings.language.description',
            getLanguageOverride(),
            'General',
            'Settings'
        );
    }

    const hasScrollSpeed = discordCat.directComponents.some((component) => component.title === 'GUI Scroll Speed');
    if (!hasScrollSpeed) {
        Categories.addSettingsSlider(
            'labels.gui_scroll_speed',
            5,
            45,
            Categories.guiScrollSpeed,
            (value) => {
                Categories.guiScrollSpeed = Math.max(1, Number(value) || 15);
            },
            'Adjusts how fast the GUI panels scroll.',
            'GUI',
            'Discord'
        );
    }

    const hasGuiScale = discordCat.directComponents.some((component) => component.title === 'GUI Scale');
    if (!hasGuiScale) {
        guiScaleSetting = Categories.addSettingsSlider(
            'labels.gui_scale',
            0.5,
            2,
            GuiState.guiScale,
            (value) => {
                if (guiScaleSetting.dragging) GuiState.pendingGuiScale = value;
                else GuiState.setGuiScale(value);
            },
            'Adjusts the size of the V5 GUI.',
            'GUI',
            'Discord'
        );
    }

    const hasClickSound = discordCat.directComponents.some((component) => component.title === 'GUI Click Sound');
    if (!hasClickSound) {
        Categories.addSettingsToggle(
            'labels.gui_click_sound',
            (value) => {
                setGuiClickSoundEnabled(!!value);
            },
            'Plays a click sound when interacting with GUI.',
            isGuiClickSoundEnabled(),
            'GUI',
            'Discord'
        );
    }
};

initProfileSettings();
