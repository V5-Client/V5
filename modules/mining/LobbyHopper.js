import { ModuleBase } from '../../utils/ModuleBase';
import { Timer } from '../../utils/TimeUtils';
import { area, getDay } from '../../utils/Utils';

class LobbyHopper extends ModuleBase {
    constructor() {
        super({
            name: 'modules.lobby_hopper.name',
            subcategory: 'Mining',
            description: 'modules.lobby_hopper.description',
            tooltip: 'modules.lobby_hopper.tooltip',
            theme: '#e0dd04',
        });

        this.maxDay = 0;
        this.said = false;
        this.cooldown = new Timer();
        this.bindToggleKey();

        this.addSlider('labels.max_lobby_day', 0, 18, 5, (v) => {
            this.maxDay = v;
        });

        this.on('step', () => {
            if (!this.enabled) return;
            let isInCh = area() === 'Crystal Hollows';

            if (this.said && !this.cooldown.hasPassed(3000)) return;

            if (!isInCh) {
                this.message('messages.lobbyHopper.warpingToCrystalHollows');
                ChatLib.command('warp ch');

                this.reset();
            } else {
                if (getDay() > this.maxDay) {
                    this.message('messages.lobbyHopper.dayTooHigh');
                    ChatLib.command('is');

                    this.reset();
                } else {
                    this.message('messages.lobbyHopper.lobbyFound');
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
        this.message('messages.common.enabled');
    }

    onDisable() {
        this.message('messages.common.disabled');
    }
}

new LobbyHopper();
