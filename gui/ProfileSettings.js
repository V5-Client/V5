import { Categories } from './categories/CategorySystem';
import { GuiState } from './core/GuiState';
import { isGuiClickSoundEnabled, setGuiClickSoundEnabled } from './Utils';

const initProfileSettings = () => {
    let guiScaleSetting;
    let themeCat = Categories.categories.find((category) => category.name === 'Theme');
    if (!themeCat) {
        themeCat = {
            name: 'Theme',
            items: [],
            subcategories: [],
            directComponents: [],
        };
        Categories.categories.push(themeCat);
    } else if (!themeCat.directComponents) {
        themeCat.directComponents = [];
    }

    const hasScrollSpeed = themeCat.directComponents.some((component) => component.title === 'GUI Scroll Speed');
    if (!hasScrollSpeed) {
        Categories.addSettingsSlider(
            'GUI Scroll Speed',
            5,
            45,
            Categories.guiScrollSpeed,
            (value) => {
                Categories.guiScrollSpeed = Math.max(1, Number(value) || 15);
            },
            'Adjusts how fast the GUI panels scroll.',
            'GUI',
            'Theme'
        );
    }

    const hasGuiScale = themeCat.directComponents.some((component) => component.title === 'GUI Scale');
    if (!hasGuiScale) {
        guiScaleSetting = Categories.addSettingsSlider(
            'GUI Scale',
            0.5,
            2,
            GuiState.guiScale,
            (value) => {
                if (guiScaleSetting.dragging) GuiState.pendingGuiScale = value;
                else GuiState.setGuiScale(value);
            },
            'Adjusts the size of the V5 GUI.',
            'GUI',
            'Theme'
        );
    }

    const hasClickSound = themeCat.directComponents.some((component) => component.title === 'GUI Click Sound');
    if (!hasClickSound) {
        Categories.addSettingsToggle(
            'GUI Click Sound',
            (value) => {
                setGuiClickSoundEnabled(!!value);
            },
            'Plays a click sound when interacting with GUI.',
            isGuiClickSoundEnabled(),
            'GUI',
            'Theme'
        );
    }
};

initProfileSettings();
