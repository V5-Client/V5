import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { EntityVelocityUpdateS2C } from '../../utils/Packets';
import { Webhook } from '../../utils/Webhooks';
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
            if (!MacroState.isMacroRunning() || this.isFalse('velocity') || this._bypassTrigger()) return;
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

            if (this.isFalse('velocity', data)) return;
            setTimeout(() => {
                if (this.isFalse('velocity', data)) return;
                this.onTrigger(speed);
            }, this._getReactionDelay(this.settings));
        }).setFilteredClass(EntityVelocityUpdateS2C);
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
