import { getSetting } from '../../GUI/GuiSave';
const XrayPackage = Java.type('com.chattriggers.ctjs.v5.Xray');

const { addCategoryItem, addToggle, addSlider } = global.Categories;

addCategoryItem(
    'Visuals',
    'Xray',
    'See through walls - Sodium and Iris will break Xray',
    'This is a description for Xray.'
);
addSlider(
    'Modules',
    'Xray',
    'Transparency',
    0,
    100,
    50,
    null,
    'This is a description for Transparency.'
);

function percentToAlpha(percent) {
    const reversed = 100 - percent;
    return Math.round((reversed * 255) / 100);
}

class Xray {
    constructor() {
        this.enabled = false;
        this.firstTransparency = getSetting('Xray', 'Transparency');

        let transparencyLoop = register('step', () => {
            const transparency = getSetting('Xray', 'Transparency');

            if (this.enabled && transparency !== this.firstTransparency) {
                XrayPackage.setAlpha(percentToAlpha(transparency));
                // The world renderer reload has to be on the main thread
                Client.scheduleTask(0, () => {
                    Client.getMinecraft().worldRenderer.reload();
                });

                this.firstTransparency = transparency;
            }
        })
            .setFps(5)
            .unregister();

        this.toggle = (value) => {
            this.enabled = value;
            if (this.enabled) {
                this.enableXray();
                transparencyLoop.register();
            } else {
                this.disableXray();
                transparencyLoop.unregister();
            }
        };

        addToggle(
            'Modules',
            'Xray',
            'Enabled',
            this.toggle,
            'This is a description for Enabled.'
        );

        Client.scheduleTask(0, () =>
            this.toggle(getSetting('Xray', 'Enabled'))
        );
    }

    enableXray() {
        // Same thing, run on main thread
        Client.scheduleTask(0, () => {
            XrayPackage.setEnabled();
            const transparency = getSetting('Xray', 'Transparency');
            XrayPackage.setAlpha(percentToAlpha(transparency));
            this.firstTransparency = transparency;
        });
    }

    disableXray() {
        // Same thing, run on main thread
        Client.scheduleTask(0, () => {
            XrayPackage.setDisabled();
        });
    }
}

new Xray();
