import { Chat } from '../../utils/Chat';
import { Failsafe } from '../Failsafe';
import { Webhook } from '../../utils/Webhooks';
import FailsafeUtils from '../FailsafeUtils';
import { manager } from '../../utils/SkyblockEvents';
import { EntityVelocityUpdateS2C } from '../../utils/Packets';
import { MacroState } from '../../utils/MacroState';
class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        this.registerVeloListeners();
        this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
    }

    registerVeloListeners() {
        register('packetReceived', (packet) => {
            if (this.isFalse('velocity')) return;
            this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
            if (!this.settings.isEnabled) return;
            if (packet.getEntityId() !== Player.asPlayerMP()?.mcValue?.getId()) return;
            if (!MacroState.isMacroRunning()) return;
            if (Player.getHeldItem()?.getName()?.removeFormatting()?.includes('Grappling')) return;
            const blockBelow = World.getBlockAt(Math.floor(Player.getX()), Math.floor(Player.getY()) - 1, Math.floor(Player.getZ()));
            if (blockBelow.getType().getRegistryName().includes('slime_block')) return;
            const vx = packet.getVelocity().x;
            const vy = packet.getVelocity().y;
            const vz = packet.getVelocity().z;
            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            const blockName = blockBelow.getType().getRegistryName();
            const data = { velocity: speed, blockBelow: blockName };

            if (this.isFalse('velocity', data)) return;
            setTimeout(
                () => {
                    if (this.isFalse('velocity', data)) return;
                    this.onTrigger(speed);
                },
                this.settings.FailsafeReactionTime - 50 || 600
            );
        }).setFilteredClass(EntityVelocityUpdateS2C);
    }

    onTrigger(speed) {
        let pressure;
        let severity;
        if (speed < 0.5) {
            pressure = 10;
            severity = 'low';
        } else if (speed < 1) {
            pressure = 20;
            severity = 'medium';
        } else if (speed < 2) {
            pressure = 50;
            severity = 'high';
        } else {
            pressure = 100;
            severity = 'very high';
        }

        Chat.messageFailsafe(`Velocity failsafe triggered! (${severity} severity)`);
        Chat.messageFailsafe(`Velocity: ${speed.toFixed(0)}`);
        FailsafeUtils.incrementFailsafeIntensity(pressure);
        Webhook.sendEmbed(
            [
                {
                    title: `**Velocity Failsafe Triggered! [${severity}]**`,
                    description: `Velocity change detected: ${speed.toFixed(0)}`,
                    color: severity === 'very high' ? 16711680 : severity === 'high' ? 16744448 : severity === 'medium' ? 16776960 : 65280,
                    footer: { text: `V5 Failsafes` },
                    timestamp: new Date().toISOString(),
                },
            ],
            this.settings.pingOnCheck ?? true
        );
    }
}

export default new VelocityFailsafe();
