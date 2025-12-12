import { Chat } from '../../utils/Chat';
import { Failsafe } from '../Failsafe';
import { Webhook } from '../../utils/Webhooks';
import FailsafeUtils from '../FailsafeUtils';
import { registerEventSB } from '../../utils/SkyblockEvents';
class VelocityFailsafe extends Failsafe {
    constructor() {
        super();
        this.registerVeloListeners();
        this.ignore = false;
        this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
    }

    registerVeloListeners() {
        register('packetReceived', (packet) => {
            if (this.ignore) return;
            this.settings = FailsafeUtils.getFailsafeSettings('Velocity');
            if (!this.settings.isEnabled) return;
            if (packet.getEntityId() !== Player.asPlayerMP()?.mcValue?.getId()) return;
            if (!global.macrostate.isMacroRunning()) return;
            if (Player.getHeldItem()?.getName()?.removeFormatting()?.includes('Grappling')) return;
            const playerPos = Player.asPlayerMP().mcValue.getPos();
            const blockBelow = World.getBlockAt(Math.floor(playerPos.getX()), Math.floor(playerPos.getY()) - 1, Math.floor(playerPos.getZ()));
            if (blockBelow.getType().getRegistryName().includes('slime_block')) return;
            const vx = packet.getVelocityX();
            const vy = packet.getVelocityY();
            const vz = packet.getVelocityZ();
            const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
            setTimeout(() => {
                if (this.ignore) return;
                this.onTrigger(speed);
            }, this.settings.FailsafeReactionTime - 50 || 600);
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.EntityVelocityUpdateS2CPacket);

        registerEventSB('death', () => {
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
        registerEventSB('serverchange', () => {
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
        registerEventSB('warp', () => {
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
        register('worldLoad', () => {
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
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

        Chat.failsafeMsg(`Velocity failsafe triggered! (${severity} severity)`);
        Chat.failsafeMsg(`Velocity: ${speed.toFixed(0)}`);
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
