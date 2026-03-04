import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

class PlayerGriefFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('Player Grief');
        this.lastInsideTrigger = 0;
        this.lastNearbyTrigger = 0;
        this.lastLookingTrigger = 0;
        this.insideCooldownMs = 5000;
        this.nearbyCooldownMs = 3000;
        this.lookingCooldownMs = 3000;
        this.registerGriefListeners();
        this.whitelistedPlayers = ['']; // TODO: add gui textbox, i have no clue how it works so im not touching it
        this.whitelistedPlayerSet = new Set(this.whitelistedPlayers);
    }

    registerGriefListeners() {
        register('step', () => {
            if (!MacroState.isMacroRunning() || !World.isLoaded() || !Player.asPlayerMP()) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Player Grief');
            if (!this.settings.isEnabled) return;

            const now = Date.now();
            if (now - this.lastInsideTrigger >= this.insideCooldownMs) this.checkPlayerInside(now);
            if (now - this.lastNearbyTrigger >= this.nearbyCooldownMs) this.checkPlayerNearby(now);
        }).setDelay(1);
    }

    checkPlayerInside(now) {
        const look = Player.lookingAt();
        const lookedName = look?.getName?.();

        if (!(look instanceof PlayerMP) || look.getUUID()?.version() === 2) return;
        if (this.whitelistedPlayerSet.has(lookedName)) return;

        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();

        const lx = look.getX();
        const ly = look.getY();
        const lz = look.getZ();

        if (Math.trunc(lx) === Math.trunc(px) && Math.trunc(ly) === Math.trunc(py) && Math.trunc(lz) === Math.trunc(pz)) {
            Chat.messageFailsafe(`&c&l${lookedName} is standing inside you!`);
            FailsafeUtils.incrementFailsafeIntensity(120);
            FailsafeUtils.sendFailsafeEmbed('Player Grief', 'very high', `${lookedName} is standing inside you!`, 16711680);

            this.lastInsideTrigger = now;
        }
    }

    checkPlayerNearby(now) {
        const maxDistance = this.settings.playerProximityDistance || 3;
        const maxDistanceSq = maxDistance * maxDistance;
        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();
        const selfName = Player.getName();

        World.getAllPlayers().forEach((player) => {
            const playerName = player.getName();
            if (playerName === selfName || player.getUUID()?.version() === 2) return;
            if (this.whitelistedPlayerSet.has(playerName)) return;

            const lx = player.getX();
            const ly = player.getY();
            const lz = player.getZ();

            const dx = lx - px;
            const dy = ly - py;
            const dz = lz - pz;
            const distanceSq = dx * dx + dy * dy + dz * dz;

            if (distanceSq <= maxDistanceSq && distanceSq > 1) {
                const distance = Math.sqrt(distanceSq);
                Chat.messageFailsafe(`&c&l${playerName} is ${distance.toFixed(1)} blocks away from you!`);
                FailsafeUtils.incrementFailsafeIntensity(20);
                FailsafeUtils.sendFailsafeEmbed('Player Grief', 'medium', `${playerName} is ${distance.toFixed(1)} blocks away!`, 16776960);

                this.lastNearbyTrigger = now;
            }
        });
    }
}

export default new PlayerGriefFailsafe();
