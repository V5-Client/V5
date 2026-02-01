import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';

let PredictiveSmoothAOTE;
let currentTeleportPing;
let lastPing;

class ZeroPingEtherwarp extends ModuleBase {
    constructor() {
        super({
            name: 'Zero Ping Etherwarp',
            subcategory: 'Other',
            description: 'Requires Skyblocker Predictive Smooth AOTE enabled. Skyblocker Maximum Added Lag must be higher than your ping else it stutters.',
            tooltip: 'requires Skyblocker predictive smooth AOTE enabled',
        });

        this.reflectionFailed = false;

        try {
            PredictiveSmoothAOTE = Java.type('de.hysky.skyblocker.skyblock.teleport.PredictiveSmoothAOTE');
            currentTeleportPing = PredictiveSmoothAOTE.class.getDeclaredField('currentTeleportPing');
            currentTeleportPing.setAccessible(true);
            lastPing = PredictiveSmoothAOTE.class.getDeclaredField('lastPing');
            lastPing.setAccessible(true);
        } catch (e) {
            this.reflectionFailed = true;
        }

        this.on('tick', () => this.onTick());
    }

    onTick() {
        if (this.reflectionFailed) {
            Chat.message('&c[ZeroPingEtherwarp] Failed to access Skyblocker. Please install Skyblocker or disable ZeroPingEtherwarp.');
            return;
        }
        currentTeleportPing.setLong(null, 1);
        lastPing.setLong(null, 1);
    }
}

new ZeroPingEtherwarp();
