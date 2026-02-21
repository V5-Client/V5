import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { PlayerInteractItemC2S, PlayerPositionLookS2C, CommandExecutionC2S } from '../../utils/Packets';
import { Webhook } from '../../utils/Webhooks';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

let lastRightClickTime = 0;
let lastCommandTime = 0;

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.newX = 0;
        this.newY = 0;
        this.newZ = 0;
        this.settings = FailsafeUtils.getFailsafeSettings('TP');
        this.registerTPListeners();
        this.registerRightClickListener();
    }

    registerRightClickListener() {
        register('packetSent', (packet) => {
            lastRightClickTime = Date.now();
        }).setFilteredClass(PlayerInteractItemC2S);

        register('packetSent', (packet) => {
            let command = packet.command().toLowerCase();

            if (command.startsWith('warp')) {
                lastCommandTime = Date.now();
            }
        }).setFilteredClass(CommandExecutionC2S);
    }

    registerTPListeners() {
        register('packetReceived', (packet) => {
            if (!MacroState.isMacroRunning()) return;
            this.settings = FailsafeUtils.getFailsafeSettings('TP');
            if (!this.settings.isEnabled) return;

            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();
            const currYaw = Player.getYaw();
            const currPitch = Player.getPitch();

            const change = packet.change();
            const pos = change.position();
            this.newX = pos.x;
            this.newY = pos.y;
            this.newZ = pos.z;
            const dx = Math.abs(this.newX - fromX);
            const dy = Math.abs(this.newY - fromY);
            const dz = Math.abs(this.newZ - fromZ);
            const distance = Math.hypot(dx, dy, dz);

            const data = {
                distance,
                yaw: change.yaw(),
                pitch: change.pitch(),
                currYaw,
                currPitch,
                lastRightClickTime,
                lastCommandTime,
                toX: this.newX,
                toY: this.newY,
                toZ: this.newZ,
                fromX,
                fromY,
                fromZ,
                lookVector: {
                    x: -Math.sin((currYaw * Math.PI) / 180) * Math.cos((currPitch * Math.PI) / 180),
                    y: -Math.sin((currPitch * Math.PI) / 180),
                    z: Math.cos((currYaw * Math.PI) / 180) * Math.cos((currPitch * Math.PI) / 180),
                },
            };

            if (this.isFalse('teleport', data)) return;

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
                if (this.isFalse('teleport', data)) return;
                this.onTrigger(fromX, fromY, fromZ, this.newX, this.newY, this.newZ, distance);
            }, this._getReactionDelay(this.settings));
        }).setFilteredClass(PlayerPositionLookS2C);
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

        let color;
        if (severity === 'very high') color = 16711680;
        else if (severity === 'high') color = 16744448;
        else if (severity === 'medium') color = 16776960;
        else color = 65280;

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

export default new TeleportFailsafe();
