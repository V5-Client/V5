//@VIP
import { getSetting } from '../../gui/GuiSave';
import { XrayPackage } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { ScheduleTask } from '../../utils/ScheduleTask';

class Xray extends ModuleBase {
    constructor() {
        super({
            name: 'Xray',
            subcategory: 'Visuals',
            description: 'See through walls - Sodium and Iris will break Xray',
            tooltip: 'See through walls client-side.',
            theme: '#94a2bb',
            showEnabledToggle: false,
        });

        this.bindToggleKey();

        this.firstTransparency = getSetting('Xray', 'Transparency');

        this.addSlider('Transparency', 0, 100, 50, null, 'Transparency of Xray.');

        this.on('step', () => {
            const transparency = getSetting('Xray', 'Transparency');
            if (transparency !== this.firstTransparency) {
                XrayPackage.setAlpha(this.percentToAlpha(transparency));
                ScheduleTask(0, () => {
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
        this.message('&aEnabled');

        ScheduleTask(0, () => {
            XrayPackage.setEnabled();
            const transparency = getSetting('Xray', 'Transparency');
            XrayPackage.setAlpha(this.percentToAlpha(transparency));
            this.firstTransparency = transparency;
        });
    }

    onDisable() {
        this.message('&cDisabled');

        ScheduleTask(0, () => {
            XrayPackage.setDisabled();
        });
    }
}

new Xray();
