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
            const speed = Math.hypot(vx, vy, vz);
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

        let color;
        if (severity === 'very high') color = 16711680;
        else if (severity === 'high') color = 16744448;
        else if (severity === 'medium') color = 16776960;
        else color = 65280;

        Chat.messageFailsafe(`Velocity failsafe triggered! (${severity} severity)`);
        Chat.messageFailsafe(`Velocity: ${speed.toFixed(0)}`);
        FailsafeUtils.incrementFailsafeIntensity(pressure);
        Webhook.sendEmbed(
            [
                {
                    title: `**Velocity Failsafe Triggered! [${severity}]**`,
                    description: `Velocity change detected: ${speed.toFixed(0)}`,
                    color,
                    footer: { text: `V5 Failsafes` },
                    timestamp: new Date().toISOString(),
                },
            ],
            this.settings.pingOnCheck ?? true
        );
    }
}

export default new VelocityFailsafe();
