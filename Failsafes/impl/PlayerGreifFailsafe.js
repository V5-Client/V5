import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
import { Chat } from '../../utils/Chat';
import { Webhook } from '../../utils/Webhooks';

class PlayerGreifFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('Player Greif');
        this.lastInsideTrigger = 0;
        this.lastNearbyTrigger = 0;
        this.lastLookingTrigger = 0;
        this.insideCooldownMs = 5000;
        this.nearbyCooldownMs = 3000;
        this.lookingCooldownMs = 3000;
        this.registerGreifListeners();
        this.whitelistedPlayers = ['']; // TODO: add gui textbox, i have no clue how it works so im not touching it
    }

    registerGreifListeners() {
        register('step', () => {
            if (!global.macrostate.isMacroRunning()) return;
            this.settings = FailsafeUtils.getFailsafeSettings('Player Greif');
            if (!this.settings.isEnabled) return;
            if (!World.isLoaded() || !Player.asPlayerMP()) return;

            const now = Date.now();

            if (now - this.lastInsideTrigger >= this.insideCooldownMs) {
                this.checkPlayerInside(now);
            }

            if (now - this.lastNearbyTrigger >= this.nearbyCooldownMs) {
                this.checkPlayerNearby(now);
            }
        });
    }

    checkPlayerInside(now) {
        const look = Player.lookingAt();
        if (!(look instanceof PlayerMP)) return;
        if (look.getUUID()?.version() === 2) return;
        if (this.whitelistedPlayers.includes(look.getName())) return;
        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();
        const lx = look.getX();
        const ly = look.getY();
        const lz = look.getZ();

        if (Math.trunc(lx) === Math.trunc(px) && Math.trunc(ly) === Math.trunc(py) && Math.trunc(lz) === Math.trunc(pz)) {
            Chat.messageFailsafe(`&c&lWARNING: ${look.getName()} is standing inside you! (very high severity)`);
            FailsafeUtils.incrementFailsafeIntensity(120);
            Webhook.sendEmbed(
                [
                    {
                        title: `**Player Inside Detected! [very high severity]**`,
                        description: `${look.getName()} is standing inside you!`,
                        color: 16711680,
                        footer: { text: `V5 Failsafes` },
                        timestamp: new Date().toISOString(),
                    },
                ],
                this.settings.pingOnCheck ?? true
            );
            this.lastInsideTrigger = now;
        }
    }

    checkPlayerNearby(now) {
        this.settings = FailsafeUtils.getFailsafeSettings('Player Greif');
        if (!this.settings.isEnabled) return;
        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();
        const allPlayers = World.getAllPlayers();

        allPlayers.forEach((player) => {
            if (player.getName() === Player.getName()) return;
            if (player.getUUID()?.version() === 2) return;
            if (this.whitelistedPlayers.includes(player.getName())) return;
            const lx = player.getX();
            const ly = player.getY();
            const lz = player.getZ();

            const dx = lx - px;
            const dy = ly - py;
            const dz = lz - pz;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const maxDistance = this.settings.playerProximityDistance || 3;
            if (distance <= maxDistance && distance > 1) {
                const pressure = 20;
                const severity = 'medium';
                Chat.messageFailsafe(`${player.getName()} is ${distance.toFixed(1)} blocks away from you! (${severity} severity)`);
                FailsafeUtils.incrementFailsafeIntensity(pressure);
                Webhook.sendEmbed(
                    [
                        {
                            title: `**Player Nearby! [${severity}]**`,
                            description: `${player.getName()} is ${distance.toFixed(1)} blocks away!`,
                            color: 16776960,
                            footer: { text: `V5 Failsafes` },
                            timestamp: new Date().toISOString(),
                        },
                    ],
                    this.settings.pingOnCheck ?? true
                );
                this.lastNearbyTrigger = now;
            }
        });
    }
}

export default new PlayerGreifFailsafe();
