import { Chat } from '../../utils/Chat';
import { ClientboundSetEntityMotionPacket } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
import { TIER_SEVERITIES } from '../SensitivityPresets';

const VELOCITY_PRESSURES = [10, 20, 50, 100];

class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        register('packetReceived', (packet) => {
            if (!this.isActive() || this.disabled) return;
            if (Player.getPlayer()?.hurtTime > 0) this._setDisabled(1000);
            if (this.disabled) return;
            const playerMP = Player.asPlayerMP();
            if (!playerMP || packet?.id?.() !== playerMP?.mcValue?.getId()) return;

            const x = Math.floor(Player.getX());
            const y = Math.floor(Player.getY()) - 1;
            const z = Math.floor(Player.getZ());
            const blockBelow = World.getBlockAt(x, y, z);
            const blockName = blockBelow?.getType()?.getRegistryName() || '';
            const heldItem = Player.getHeldItem()?.getName()?.removeFormatting()?.toLowerCase();
            if (heldItem?.includes('grappling') || blockName.includes('slime_block')) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
            if (!this.settings.isEnabled) return;

            const movement = packet?.movement?.();
            const vx = movement?.x;
            const vy = movement?.y;
            const vz = movement?.z;
            const speed = Math.hypot(vx, vy, vz);

            const roundedSpeed = Math.round(speed);
            if (blockName && !blockName.includes('air') && (roundedSpeed === 1 || roundedSpeed === 0)) {
                Chat.messageDebug('disabling fall velocity packet');
                this._setDisabled(1000);
                return;
            }

            this._scheduleTrigger(() => this.onTrigger(speed), this.settings);
        }).setFilteredClass(ClientboundSetEntityMotionPacket);
    }

    onTrigger(speed) {
        const tiers = FailsafeUtils.getSensitivityPreset().velocity.tiers;
        const tierIndex = tiers.findIndex((threshold) => speed < threshold);
        const pressure = VELOCITY_PRESSURES[tierIndex];
        const severity = TIER_SEVERITIES[tierIndex];

        this._reportFailsafe({
            type: 'Velocity',
            severity,
            pressure,
            description: `Velocity change detected: ${speed.toFixed(2)}`,
            chat: `&c&lVelocity failsafe triggered! Velocity: ${speed.toFixed(2)}`,
        });
    }
}

new VelocityFailsafe();
