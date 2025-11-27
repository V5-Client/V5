import { Chat } from '../../Utility/Chat';
import { ModuleBase } from '../../Utility/ModuleBase';
import { Time } from '../../Utility/Timing';
import { Utils } from '../../Utility/Utils';

class LobbyHopper extends ModuleBase {
    constructor() {
        super({
            name: 'Lobby Hopper',
            subcategory: 'Other',
            description: 'Switches between CH lobbies',
            tooltip: 'Switches between CH lobbies',
            showEnabledToggle: false,
        });

        this.maxDay = 0;
        this.said = false;
        this.cooldown = new Time();
        this.bindToggleKey();

        this.addSlider('Max Lobby Day', 0, 18, 5, (v) => {
            this.maxDay = v;
        });

        this.on('step', () => {
            let isInCh = Utils.area() === 'Crystal Hollows';

            if (this.said && !this.cooldown.hasReached(3000)) return;

            if (!isInCh) {
                this.message('Not in Crystal Hollows, Warping.');
                ChatLib.command('warp ch');

                this.reset();
            } else {
                if (this.getLobbyDay() > this.maxDay) {
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

    message(msg) {
        Chat.message('&dLobby Hopper: &f' + msg);
    }

    getLobbyDay() {
        return Math.floor(World.getTime() / 24000);
    }

    onEnable() {
        this.message('&aStarted');
    }

    onDisable() {
        this.message('&cStopped');
    }
}

new LobbyHopper();
