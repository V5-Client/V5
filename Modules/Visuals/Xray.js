import { getSetting } from '../../GUI/GuiSave';
import { ModuleBase } from '../../Utility/ModuleBase';
const XrayPackage = Java.type('com.chattriggers.ctjs.v5.Xray');

function percentToAlpha(percent) {
    const reversed = 100 - percent;
    return Math.round((reversed * 255) / 100);
}

class Xray extends ModuleBase {
    constructor() {
        super({
            name: 'Xray',
            subcategory: 'Visuals',
            description: 'See through walls - Sodium and Iris will break Xray',
            tooltip: 'See through walls client-side.',
        });

        this.firstTransparency = getSetting('Xray', 'Transparency');

        // Transparency slider
        this.addSlider('Transparency', 0, 100, 50, null, 'Transparency of Xray.');

        this.on('step', () => {
            const transparency = getSetting('Xray', 'Transparency');
            if (transparency !== this.firstTransparency) {
                XrayPackage.setAlpha(percentToAlpha(transparency));
                // Reload on main thread
                Client.scheduleTask(0, () => {
                    Client.getMinecraft().worldRenderer.reload();
                });
                this.firstTransparency = transparency;
            }
        }).setFps(5);
    }

    onEnable() {
        // Same thing, run on main thread
        Client.scheduleTask(0, () => {
            XrayPackage.setEnabled();
            const transparency = getSetting('Xray', 'Transparency');
            XrayPackage.setAlpha(percentToAlpha(transparency));
            this.firstTransparency = transparency;
        });
    }

    onDisable() {
        // Same thing, run on main thread
        Client.scheduleTask(0, () => {
            XrayPackage.setDisabled();
        });
    }
}

new Xray();
