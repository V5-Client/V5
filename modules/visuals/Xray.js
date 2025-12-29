import { getSetting } from '../../gui/GuiSave';
import { ModuleBase } from '../../utils/ModuleBase';
const XrayPackage = Java.type('com.v5.qol.Xray');

class Xray extends ModuleBase {
    constructor() {
        super({
            name: 'Xray',
            subcategory: 'Visuals',
            description: 'See through walls - Sodium and Iris will break Xray',
            tooltip: 'See through walls client-side.',
        });

        this.bindToggleKey();

        this.firstTransparency = getSetting('Xray', 'Transparency');

        this.addSlider('Transparency', 0, 100, 50, null, 'Transparency of Xray.');

        this.on('step', () => {
            const transparency = getSetting('Xray', 'Transparency');
            if (transparency !== this.firstTransparency) {
                XrayPackage.setAlpha(this.percentToAlpha(transparency));
                Client.scheduleTask(0, () => {
                    Client.getMinecraft().worldRenderer.reload();
                });
                this.firstTransparency = transparency;
            }
        }).setFps(5);
    }

    percentToAlpha(percent) {
        const reversed = 100 - percent;
        return Math.round((reversed * 255) / 100);
    }

    onEnable() {
        Client.scheduleTask(0, () => {
            XrayPackage.setEnabled();
            const transparency = getSetting('Xray', 'Transparency');
            XrayPackage.setAlpha(this.percentToAlpha(transparency));
            this.firstTransparency = transparency;
        });
    }

    onDisable() {
        Client.scheduleTask(0, () => {
            XrayPackage.setDisabled();
        });
    }
}

new Xray();
