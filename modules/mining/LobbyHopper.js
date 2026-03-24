import { ModuleBase } from '../../utils/ModuleBase';
import { Timer } from '../../utils/TimeUtils';
import { Utils } from '../../utils/Utils';

class LobbyHopper extends ModuleBase {
    constructor() {
        super({
            name: 'Lobby Hopper',
            subcategory: 'Mining',
            description: 'Switches between CH lobbies',
            tooltip: 'Switches between CH lobbies',
            theme: '#e0dd04',
            showEnabledToggle: true,
        });

        this.maxDay = 0;
        this.said = false;
        this.cooldown = new Timer();
        this.bindToggleKey();

        this.addSlider('Max Lobby Day', 0, 18, 5, (v) => {
            this.maxDay = v;
        });

        this.on('step', () => {
            if (!this.enabled) return;
            let isInCh = Utils.area() === 'Crystal Hollows';

            if (this.said && !this.cooldown.hasPassed(3000)) return;

            if (!isInCh) {
                this.message('Not in Crystal Hollows, Warping.');
                ChatLib.command('warp ch');

                this.reset();
            } else {
                if (Utils.getDay() > this.maxDay) {
                    this.message('Crystal Hollows day is too high! Warping to new lobby.');
                    ChatLib.command('is');

                    this.reset();
                } else {
                    this.message('&aFound a lobby!');
                    this.toggle(false);
                }
            }
        }).setDelay(1);
    }

    reset() {
        this.said = true;
        this.cooldown.reset();
    }

    onEnable() {
        this.message('&aEnabled');
    }

    onDisable() {
        this.message('&cDisabled');
    }
}

new LobbyHopper();
