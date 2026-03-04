import { Categories } from './categories/CategorySystem';
import { isGuiClickSoundEnabled, setGuiClickSoundEnabled } from './Utils';

const initProfileSettings = () => {
    let discordCat = Categories.categories.find((category) => category.name === 'Discord');
    if (!discordCat) {
        Categories.categories.push({
            name: 'Discord',
            items: [],
            subcategories: [],
            directComponents: [],
            hiddenInSidebar: true,
        });
        discordCat = Categories.categories.find((category) => category.name === 'Discord');
    } else if (!discordCat.directComponents) {
        discordCat.directComponents = [];
    }

    const hasScrollSpeed = discordCat.directComponents.some((component) => component.title === 'GUI Scroll Speed');
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
            'Discord'
        );
    }

    const hasClickSound = discordCat.directComponents.some((component) => component.title === 'GUI Click Sound');
    if (!hasClickSound) {
        Categories.addSettingsToggle(
            'GUI Click Sound',
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
