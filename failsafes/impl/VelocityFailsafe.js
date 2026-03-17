import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { EntityVelocityUpdateS2C } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

const VELOCITY_TIERS = [
    { threshold: 0.5, pressure: 10, severity: 'low', color: 65280 },
    { threshold: 1, pressure: 20, severity: 'medium', color: 16776960 },
    { threshold: 2, pressure: 50, severity: 'high', color: 16744448 },
    { threshold: Infinity, pressure: 100, severity: 'very high', color: 16711680 },
];

class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        this.registerVeloListeners();
        this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
    }

    registerVeloListeners() {
        register('packetReceived', (packet) => {
            if (!MacroState.isMacroRunning() || this.disabled) return;
            this._handleVelocityOnDamageDisabled();
            if (this.disabled) return;
            const playerMP = Player.asPlayerMP();
            if (!playerMP || packet?.getEntityId() !== playerMP?.mcValue?.getId()) return;

            const x = Math.floor(Player.getX());
            const y = Math.floor(Player.getY()) - 1;
            const z = Math.floor(Player.getZ());
            const blockBelow = World.getBlockAt(x, y, z);
            const blockName = blockBelow?.getType()?.getRegistryName() || '';
            if (this._bypassTrigger(blockName)) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
            if (!this.settings.isEnabled) return;

            const vx = packet?.getVelocity().x;
            const vy = packet?.getVelocity().y;
            const vz = packet?.getVelocity().z;
            const speed = Math.hypot(vx, vy, vz);

            if (this._shouldDisableVelocity(speed, blockName)) return;
            const scheduledAt = Date.now();
            setTimeout(() => {
                if (this.disabled || !MacroState.isMacroRunning() || scheduledAt < this._disabledUntil || this._shouldDisableVelocity(speed, blockName)) return;
                this.onTrigger(speed);
            }, this._getReactionDelay(this.settings));
        }).setFilteredClass(EntityVelocityUpdateS2C);
    }

    _handleVelocityOnDamageDisabled() {
        const player = Player.getPlayer();
        if (!player) return;

        if (player.hurtTime > 0) {
            this._setDisabled(1000);
        }
    }

    _shouldDisableVelocity(velocity, blockBelow) {
        if (this.disabled) return true;
        if (velocity === undefined) return false;
        const roundedVelocity = Math.round(velocity);

        if (blockBelow && !blockBelow.includes('air') && (roundedVelocity === 1 || roundedVelocity === 0)) {
            Chat.messageDebug('disabling fall velocity packet');
            this._setDisabled(1000);
        }

        return this.disabled;
    }

    _bypassTrigger(blockBelowName) {
        const heldItem = Player.getHeldItem()?.getName()?.removeFormatting();
        if (heldItem?.includes('Grappling')) return true;

        if (blockBelowName.includes('slime_block')) return true;

        return false;
    }

    onTrigger(speed) {
        const { pressure, severity, color } = VELOCITY_TIERS.find((t) => speed < t.threshold) || VELOCITY_TIERS[VELOCITY_TIERS.length - 1];

        Chat.messageFailsafe(`&c&lVelocity failsafe triggered! Velocity: ${speed.toFixed(0)}`);
        FailsafeUtils.incrementFailsafeIntensity(pressure);
        FailsafeUtils.sendFailsafeEmbed('Velocity', severity, `Velocity change detected: ${speed.toFixed(0)}`, color);
    }
}

export default new VelocityFailsafe();
