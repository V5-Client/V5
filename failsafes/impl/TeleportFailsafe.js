import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { PlayerInteractItemC2S, PlayerPositionLookS2C, CommandExecutionC2S } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

let lastRightClickTime = 0;
let lastCommandTime = 0;

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('TP');
        this.registerTPListeners();
        this.registerRightClickListener();
    }

    registerRightClickListener() {
        register('packetSent', () => {
            lastRightClickTime = Date.now();
        }).setFilteredClass(PlayerInteractItemC2S);

        register('packetSent', (packet) => {
            const command = packet.command().toLowerCase();
            if (command.includes('warp')) {
                Chat.messageFailsafe(`DEBUG - warp command used, preventing!`, false);
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

            const change = packet.change();
            const pos = change.position();

            const newX = pos.x;
            const newY = pos.y;
            const newZ = pos.z;

            const distance = Math.hypot(newX - fromX, newY - fromY, newZ - fromZ);

            const data = {
                distance,
                yaw: change.yaw(),
                pitch: change.pitch(),
                currYaw: Player.getYaw(),
                currPitch: Player.getPitch(),
                lastRightClickTime,
                lastCommandTime,
                toX: newX,
                toY: newY,
                toZ: newZ,
                fromX,
                fromY,
                fromZ,
                lookVector: {
                    x: -Math.sin((Player.getYaw() * Math.PI) / 180) * Math.cos((Player.getPitch() * Math.PI) / 180),
                    y: -Math.sin((Player.getPitch() * Math.PI) / 180),
                    z: Math.cos((Player.getYaw() * Math.PI) / 180) * Math.cos((Player.getPitch() * Math.PI) / 180),
                },
            };

            if (this.isFalse('teleport', data)) return;
            if (distance < 0.1) return;

            if (newX === 0 && newY === 0 && newZ === 0) {
                this.handleNullPacket(newX, newY, newZ);
                return;
            }

            setTimeout(() => {
                if (this.isFalse('teleport', data)) return;
                this.onTrigger(fromX, fromY, fromZ, newX, newY, newZ, distance);
            }, this._getReactionDelay(this.settings));
        }).setFilteredClass(PlayerPositionLookS2C);
    }

    handleNullPacket(x, y, z) {
        Chat.messageFailsafe('&c&lNULL PACKET DETECTED, DO NOT REACT!', false);
        FailsafeUtils.sendFailsafeEmbed('TP', 'very high - null packet', `You just recieved a null packet to ${x}, ${y}, ${z}!`, 16711680);
    }

    onTrigger(fX, fY, fZ, nX, nY, nZ, dist) {
        const tiers = [
            { threshold: 1, pressure: 5, severity: 'low', color: 65280 },
            { threshold: 2, pressure: 10, severity: 'medium', color: 16776960 },
            { threshold: 3, pressure: 20, severity: 'high', color: 16744448 },
            { threshold: Infinity, pressure: 50, severity: 'very high', color: 16711680 },
        ];

        const { pressure, severity, color } = tiers.find((t) => dist < t.threshold);

        Chat.messageFailsafe(`&l&cTeleport Detected!`, false);
        Chat.messageFailsafe(`&c&lFrom: &r&7${fX.toFixed(2)}&f, &7${fY.toFixed(2)}&f, &7${fZ.toFixed(2)}&f`, false);
        Chat.messageFailsafe(`&c&lTo: &r&7${nX.toFixed(2)}&f, &7${nY.toFixed(2)}&f, &7${nZ.toFixed(2)}&f`, false);
        Chat.messageFailsafe(`&c&lTotal Blocks: &r&7${dist.toFixed(0)}`, true);
        FailsafeUtils.incrementFailsafeIntensity(pressure);

        FailsafeUtils.sendFailsafeEmbed(
            'TP',
            severity,
            `**From:** ${fX.toFixed(2)} | ${fY.toFixed(2)} | ${fZ.toFixed(2)}
             **To:** ${nX.toFixed(2)} | ${nY.toFixed(2)} | ${nZ.toFixed(2)}
             **Distance:** ${dist.toFixed(1)} blocks`,
            color
        );
    }
}

export default new TeleportFailsafe();
