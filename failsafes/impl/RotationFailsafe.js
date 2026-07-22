import { Chat } from '../../utils/Chat';
import { MathUtils } from '../../utils/Math';
import { ClientboundPlayerPositionPacket } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
import TeleportFailsafe from './TeleportFailsafe';

const ROTATION_TIERS = [
    { limit: 20, pressure: 20, severity: 'medium' },
    { limit: 40, pressure: 50, severity: 'high' },
    { limit: Infinity, pressure: 100, severity: 'very high' },
];

class RotationFailsafe extends Failsafe {
    constructor() {
        super();
        this.totalRotation = 0;
        this.packetWindowStartedAt = 0;
        this.flags = 0;
        this.lastFlagAt = 0;
        this.triggered = false;
        register('packetReceived', (packet) => {
            if (!this.isActive() || this.disabled) return;
            this.settings = FailsafeUtils.getFailsafeSettings('Rotation');
            if (!this.settings.isEnabled) return;

            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();
            const currYaw = Player.getYaw();
            const currPitch = Player.getPitch();

            const pos = packet.change().position();
            const newX = Number(pos.x());
            const newY = Number(pos.y());
            const newZ = Number(pos.z());

            const change = packet.change();
            const newYaw = Number(change.yRot());
            const newPitch = Number(change.xRot());

            const posDistance = Math.hypot(newX - fromX, newY - fromY, newZ - fromZ);

            const yawDiff = Math.abs(MathUtils.getAngleDifference(currYaw, newYaw));
            const pitchDiff = Math.abs(newPitch - currPitch);

            if (yawDiff === 0 && pitchDiff === 0) {
                Chat.messageDebug('null rotation packet ignored (yawDiff=0, pitchDiff=0)', false);
                return;
            }

            if (newX === 0 && newY === 0 && newZ === 0) {
                this._reportFailsafe({
                    type: 'Rotation',
                    severity: 'very high',
                    pressure: 100,
                    description: 'Null position-look packet received while checking rotation.',
                    chat: '&c&lNULL ROTATION PACKET DETECTED, DO NOT REACT!',
                });
                return;
            }

            if (TeleportFailsafe.itemTeleportInProgress()) return;
            if (posDistance >= 0.001) return;

            const preset = FailsafeUtils.getSensitivityPreset().rotation;
            const now = Date.now();
            const rotation = yawDiff + pitchDiff;
            if (!this.packetWindowStartedAt || now - this.packetWindowStartedAt > 2000) {
                this.packetWindowStartedAt = now;
                this.totalRotation = rotation;
            } else {
                this.totalRotation += rotation;
            }

            if (now - this.lastFlagAt > 2500) this.flags = 0;

            const smallRotation = yawDiff >= preset.smallYawThreshold || pitchDiff >= preset.smallPitchThreshold;
            if (smallRotation) {
                this.flags++;
                this.lastFlagAt = now;
            }

            if (this.triggered) return;
            if (this.totalRotation >= preset.totalDegThreshold || this.flags >= preset.smallFlagThreshold) {
                this.triggered = true;
                this._scheduleTrigger(
                    () => {
                        this.onTrigger(currYaw, currPitch, newYaw, newPitch, this.totalRotation);
                        this.reset();
                    },
                    this.settings,
                    () => !this.disabled && !TeleportFailsafe.itemTeleportInProgress()
                );
            }
        }).setFilteredClass(ClientboundPlayerPositionPacket);
    }

    onTrigger(fromYaw, fromPitch, toYaw, toPitch, totalRotation) {
        const { pressure, severity } = ROTATION_TIERS.find((tier) => totalRotation < tier.limit);

        this._reportFailsafe({
            type: 'Rotation',
            severity,
            pressure,
            description: `**From:** Yaw ${fromYaw.toFixed(2)} | Pitch ${fromPitch.toFixed(2)}
            **To:** Yaw ${toYaw.toFixed(2)} | Pitch ${toPitch.toFixed(2)}
            **Total Rotation:** ${totalRotation.toFixed(2)}°`,
            chat: [
                `&c&lYou were rotated by the server!`,
                `&c&lFrom: &r&7Yaw ${fromYaw.toFixed(2)} &f| &7Pitch ${fromPitch.toFixed(2)}`,
                `&c&lTo: &r&7Yaw ${toYaw.toFixed(2)} &f| &7Pitch ${toPitch.toFixed(2)}`,
                `&c&lTotal Rotation: &r&7${totalRotation.toFixed(2)}°`,
            ],
        });
    }

    reset() {
        super.reset();
        this.totalRotation = 0;
        this.packetWindowStartedAt = 0;
        this.flags = 0;
        this.lastFlagAt = 0;
        this.triggered = false;
    }
}

new RotationFailsafe();
