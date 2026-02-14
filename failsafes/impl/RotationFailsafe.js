import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { PlayerPositionLookS2C } from '../../utils/Packets';
import { Webhook } from '../../utils/Webhooks';
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

            const yawDiff = Math.abs(newYaw - currYaw);
            const pitchDiff = Math.abs(newPitch - currPitch);

            if (posDistance >= 0.001) return;

            setTimeout(
                () => {
                    if (this.isFalse('rotation')) return;
                    this.onTrigger(currYaw, currPitch, newYaw, newPitch, yawDiff, pitchDiff);
                },
                this.settings.FailsafeReactionTime - 50 || 600
            );
        }).setFilteredClass(PlayerPositionLookS2C);
    }

    onTrigger(fromYaw, fromPitch, toYaw, toPitch, yawDiff, pitchDiff) {
        const totalRotation = yawDiff + pitchDiff;

        let pressure;
        let severity;
        if (totalRotation < 5) {
            pressure = 10;
            severity = 'low';
        } else if (totalRotation < 20) {
            pressure = 20;
            severity = 'medium';
        } else if (totalRotation < 40) {
            pressure = 50;
            severity = 'high';
        } else {
            pressure = 100;
            severity = 'very high';
        }

        let color;
        if (severity === 'very high') color = 16711680;
        else if (severity === 'high') color = 16744448;
        else if (severity === 'medium') color = 16776960;
        else color = 65280;

        Chat.messageFailsafe(`You were rotated by the server! (${severity} severity)`);
        Chat.messageFailsafe(
            `yaw ${fromYaw.toFixed(2)} -> ${toYaw.toFixed(2)}, pitch ${fromPitch.toFixed(2)} -> ${toPitch.toFixed(2)} (${totalRotation.toFixed(1)}° total)`
        );
        Webhook.sendEmbed(
            [
                {
                    title: `**Rotation Failsafe Triggered! [${severity}]**`,
                    description: `Rotation changed: yaw ${fromYaw.toFixed(2)} -> ${toYaw.toFixed(2)}, pitch ${fromPitch.toFixed(2)} -> ${toPitch.toFixed(
                        2
                    )}\nTotal rotation: ${totalRotation.toFixed(1)}°`,
                    color,
                    footer: { text: `V5 Failsafes` },
                    timestamp: new Date().toISOString(),
                },
            ],
            this.settings.pingOnCheck ?? true
        );
        FailsafeUtils.incrementFailsafeIntensity(pressure);
    }
}

export default new RotationFailsafe();
