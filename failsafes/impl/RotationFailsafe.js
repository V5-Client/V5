import { Chat } from '../../utils/Chat';
import { MathUtils } from '../../utils/Math';
import { MacroState } from '../../utils/MacroState';
import { PlayerPositionLookS2C } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

class RotationFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('Rotation');
        this.registerRotationListeners();
    }

    registerRotationListeners() {
        register('packetReceived', (packet) => {
            if (!MacroState.isMacroRunning() || this.isFalse('rotation')) return;
            this.settings = FailsafeUtils.getFailsafeSettings('Rotation');
            if (!this.settings.isEnabled) return;

            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();
            const currYaw = Player.getYaw();
            const currPitch = Player.getPitch();

            const pos = packet.change().position();
            const newX = pos.x;
            const newY = pos.y;
            const newZ = pos.z;

            const change = packet.change();
            const newYaw = change.yaw();
            const newPitch = change.pitch();

            const dx = Math.abs(newX - fromX);
            const dy = Math.abs(newY - fromY);
            const dz = Math.abs(newZ - fromZ);
            const posDistance = Math.hypot(dx, dy, dz);

            const yawDiff = Math.abs(MathUtils.getAngleDifference(currYaw, newYaw));
            const pitchDiff = Math.abs(newPitch - currPitch);

            if (posDistance >= 0.001) return;

            setTimeout(() => {
                if (this.isFalse('rotation')) return;
                this.onTrigger(currYaw, currPitch, newYaw, newPitch, yawDiff, pitchDiff);
            }, this._getReactionDelay(this.settings));
        }).setFilteredClass(PlayerPositionLookS2C);
    }

    onTrigger(fromYaw, fromPitch, toYaw, toPitch, yawDiff, pitchDiff) {
        const totalRotation = yawDiff + pitchDiff;

        const tiers = [
            { limit: 5, pressure: 10, severity: 'low', color: 65280 },
            { limit: 20, pressure: 20, severity: 'medium', color: 16776960 },
            { limit: 40, pressure: 50, severity: 'high', color: 16744448 },
            { limit: Infinity, pressure: 100, severity: 'very high', color: 16711680 },
        ];

        const { pressure, severity, color } = tiers.find((t) => totalRotation < t.limit);

        Chat.messageFailsafe(`&c&lYou were rotated by the server!`, false);
        Chat.messageFailsafe(`&c&lFrom: &r&7Yaw ${fromYaw.toFixed(2)} &f| &7Pitch ${fromPitch.toFixed(2)}`, false);
        Chat.messageFailsafe(`&c&lTo: &r&7Yaw ${toYaw.toFixed(2)} &f| &7Pitch ${toPitch.toFixed(2)}`, false);
        Chat.messageFailsafe(`&c&lTotal Rotation: &r&7${totalRotation.toFixed(2)}°`, true);
        FailsafeUtils.incrementFailsafeIntensity(pressure);

        FailsafeUtils.sendFailsafeEmbed(
            'Rotation',
            severity,
            `**From:** Yaw ${fromYaw.toFixed(2)} | Pitch ${fromPitch.toFixed(2)}
            **To:** Yaw ${toYaw.toFixed(2)} | Pitch ${toPitch.toFixed(2)}
            **Total Rotation:** ${totalRotation.toFixed(2)}°`,
            color
        );
    }
}

export default new RotationFailsafe();
