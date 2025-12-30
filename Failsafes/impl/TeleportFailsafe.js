import { Chat } from '../../utils/Chat';
import { Failsafe } from '../Failsafe';
import { manager } from '../../utils/SkyblockEvents';
import FailsafeUtils from '../FailsafeUtils';
import { Webhook } from '../../utils/Webhooks';
import { PlayerPositionLookS2C } from '../../utils/Packets';

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.ignore = false;
        this.newX = 0;
        this.newY = 0;
        this.newZ = 0;
        this.settings = FailsafeUtils.getFailsafeSettings('TP');
        this.registerTPListeners();
    }

    registerTPListeners() {
        register('packetReceived', (packet) => {
            if (!global.macrostate.isMacroRunning()) return;
            this.settings = FailsafeUtils.getFailsafeSettings('TP');
            if (!this.settings.isEnabled) return;
            if (Player.getHeldItem()?.getName()?.removeFormatting()?.toLowerCase()?.includes('aspect of the')) return;

            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();

            const pos = packet.change().position();
            this.newX = pos.x;
            this.newY = pos.y;
            this.newZ = pos.z;
            const dx = Math.abs(this.newX - fromX);
            const dy = Math.abs(this.newY - fromY);
            const dz = Math.abs(this.newZ - fromZ);
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < 0.1) return;

            if (this.newX === 0 && this.newY === 0 && this.newZ === 0) {
                Chat.messageFailsafe('NULL PACKET DETECTED, DO NOT REACT!');
                Webhook.sendEmbed(
                    [
                        {
                            title: '**NULL PACKET DETECTED!**',
                            description: `Null packet detected: ${this.newX} ${this.newY} ${this.newZ}`,
                            color: 8388608,
                            footer: { text: `V5 Failsafes` },
                            timestamp: new Date().toISOString(),
                        },
                    ],
                    this.settings.pingOnCheck ?? true
                );
                return;
            }

            setTimeout(() => {
                if (this.ignore) return;
                this.onTrigger(fromX, fromY, fromZ, this.newX, this.newY, this.newZ, distance);
            }, this.settings.FailsafeReactionTime - 50 || 600);
        }).setFilteredClass(PlayerPositionLookS2C);

        register('worldLoad', () => {
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
        manager.subscribe('serverchange', () => {
            this.ignore = true;
            setTimeout(() => (this.ignore = false), 1000);
        });
        manager.subscribe('death', () => {
            this.ignore = true;
            setTimeout(() => {
                this.ignore = false;
            }, 1000);
        });

        manager.subscribe('warp', () => {
            this.ignore = true;
            setTimeout(() => {
                this.ignore = false;
            }, 1000);
        });
    }

    onTrigger(fromX, fromY, fromZ, toX, toY, toZ, distance) {
        let pressure;
        let severity;
        if (distance < 1) {
            pressure = 5;
            severity = 'low';
        } else if (distance < 2) {
            pressure = 10;
            severity = 'medium';
        } else if (distance < 3) {
            pressure = 20;
            severity = 'high';
        } else {
            pressure = 50;
            severity = 'very high';
        }

        Chat.messageFailsafe(`You have been teleported! (${severity} severity)`);
        Chat.messageFailsafe(
            `from ${fromX.toFixed(2)} ${fromY.toFixed(2)} ${fromZ.toFixed(2)} to ${toX.toFixed(2)} ${toY.toFixed(2)} ${toZ.toFixed(2)} (${distance.toFixed(
                1
            )} blocks)`
        );
        Webhook.sendEmbed(
            [
                {
                    title: `**Teleport Failsafe Triggered! [${severity}]**`,
                    description: `Teleported from (${fromX.toFixed(2)}, ${fromY.toFixed(2)}, ${fromZ.toFixed(2)}) to (${toX.toFixed(2)}, ${toY.toFixed(
                        2
                    )}, ${toZ.toFixed(2)})\nDistance: ${distance.toFixed(1)} blocks`,
                    color: severity === 'very high' ? 16711680 : severity === 'high' ? 16744448 : severity === 'medium' ? 16776960 : 65280,
                    footer: { text: `V5 Failsafes` },
                    timestamp: new Date().toISOString(),
                },
            ],
            this.settings.pingOnCheck ?? true
        );
        FailsafeUtils.incrementFailsafeIntensity(pressure);
    }
}

export default new TeleportFailsafe();
