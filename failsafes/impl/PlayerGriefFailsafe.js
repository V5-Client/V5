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

        if (!(look instanceof PlayerMP) || look.getUUID()?.version() === 2) return;
        if (this.whitelistedPlayers.includes(look.getName())) return;

        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();

        const lx = look.getX();
        const ly = look.getY();
        const lz = look.getZ();

        if (Math.trunc(lx) === Math.trunc(px) && Math.trunc(ly) === Math.trunc(py) && Math.trunc(lz) === Math.trunc(pz)) {
            Chat.messageFailsafe(`&c&l${look.getName()} is standing inside you!`);
            FailsafeUtils.incrementFailsafeIntensity(120);
            FailsafeUtils.sendFailsafeEmbed('Player Grief', 'very high', `${look.getName()} is standing inside you!`, 16711680);

            this.lastInsideTrigger = now;
        }
    }

    checkPlayerNearby(now) {
        this.settings = FailsafeUtils.getFailsafeSettings('Player Grief');
        if (!this.settings.isEnabled) return;

        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();

        World.getAllPlayers().forEach((player) => {
            if (player.getName() === Player.getName() || player.getUUID()?.version() === 2) return;
            if (this.whitelistedPlayers.includes(player.getName())) return;

            const lx = player.getX();
            const ly = player.getY();
            const lz = player.getZ();

            const dx = lx - px;
            const dy = ly - py;
            const dz = lz - pz;

            const distance = Math.hypot(dx, dy, dz);

            const maxDistance = this.settings.playerProximityDistance || 3;

            if (distance <= maxDistance && distance > 1) {
                Chat.messageFailsafe(`&c&l${player.getName()} is ${distance.toFixed(1)} blocks away from you!`);
                FailsafeUtils.incrementFailsafeIntensity(20);
                FailsafeUtils.sendFailsafeEmbed('Player Grief', 'medium', `${player.getName()} is ${distance.toFixed(1)} blocks away!`, 16776960);

                this.lastNearbyTrigger = now;
            }
        });
    }
}

export default new PlayerGriefFailsafe();
