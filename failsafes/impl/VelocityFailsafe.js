import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { EntityVelocityUpdateS2C } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        this.registerVeloListeners();
        this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
    }

    registerVeloListeners() {
        register('packetReceived', (packet) => {
            if (!MacroState.isMacroRunning() || this.disabled || this._bypassTrigger()) return;
            this._handleVelocityOnDamageDisabled();
            if (this.disabled) return;
            if (packet?.getEntityId() !== Player.asPlayerMP()?.mcValue?.getId()) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
            if (!this.settings.isEnabled) return;

            const vx = packet?.getVelocity().x;
            const vy = packet?.getVelocity().y;
            const vz = packet?.getVelocity().z;
            const speed = Math.hypot(vx, vy, vz);

            const blockBelow = World.getBlockAt(Math.floor(Player.getX()), Math.floor(Player.getY()) - 1, Math.floor(Player.getZ()));
            const blockName = blockBelow.getType().getRegistryName();
            const data = { velocity: speed, blockBelow: blockName };

            if (this._shouldDisableVelocity(data)) return;
            setTimeout(() => {
                if (this.disabled || this._shouldDisableVelocity(data)) return;
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

    _shouldDisableVelocity(data) {
        if (this.disabled) return true;
        if (data.velocity === undefined) return false;

        const velocity = data.velocity;
        const blockBelow = data.blockBelow;
        const roundedVelocity = Math.round(velocity);

        if (blockBelow && !blockBelow.includes('air') && (roundedVelocity === 1 || roundedVelocity === 0)) {
            Chat.messageDebug('disabling fall velocity packet');
            this._setDisabled(1000);
        } else {
            Chat.messageDebug('not disabling fall velocity packet, data = ' + JSON.stringify(data));
        }

        return this.disabled;
    }

    _bypassTrigger() {
        const heldItem = Player.getHeldItem()?.getName()?.removeFormatting();
        if (heldItem?.includes('Grappling')) return true;

        const blockBelow = World.getBlockAt(Math.floor(Player.getX()), Math.floor(Player.getY()) - 1, Math.floor(Player.getZ()));
        if (blockBelow.getType().getRegistryName().includes('slime_block')) return true;

        return false;
    }

    onTrigger(speed) {
        const tiers = [
            { threshold: 0.5, pressure: 10, severity: 'low', color: 65280 },
            { threshold: 1, pressure: 20, severity: 'medium', color: 16776960 },
            { threshold: 2, pressure: 50, severity: 'high', color: 16744448 },
            { threshold: Infinity, pressure: 100, severity: 'very high', color: 16711680 },
        ];

        const { pressure, severity, color } = tiers.find((t) => speed < t.threshold) || tiers[tiers.length - 1];

        Chat.messageFailsafe(`&c&lVelocity failsafe triggered! Velocity: ${speed.toFixed(0)}`);
        FailsafeUtils.incrementFailsafeIntensity(pressure);
        FailsafeUtils.sendFailsafeEmbed('Velocity', severity, `Velocity change detected: ${speed.toFixed(0)}`, color);
    }
}

export default new VelocityFailsafe();
