import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { PlayerInteractItemC2S, PlayerPositionLookS2C, CommandExecutionC2S } from '../../utils/Packets';
import PathConfig from '../../utils/pathfinder/PathConfig';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

let lastRightClickTime = 0;
let lastCommandTime = 0;
let pendingWarpIgnore = false;
let pendingWarpIgnoreTimer = null;

const WARP_IGNORE_RADIUS = 3;
const WARP_IGNORE_RADIUS_SQ = WARP_IGNORE_RADIUS * WARP_IGNORE_RADIUS;
const WARP_IGNORE_TIMEOUT_MS = 3000;
const TELEPORT_TIERS = [
    { threshold: 1, pressure: 5, severity: 'low', color: 65280 },
    { threshold: 2, pressure: 10, severity: 'medium', color: 16776960 },
    { threshold: 3, pressure: 20, severity: 'high', color: 16744448 },
    { threshold: Infinity, pressure: 50, severity: 'very high', color: 16711680 },
];

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('TP');
        this.registerTPListeners();
        this.registerRightClickListener();
    }

    registerRightClickListener() {
        register('packetSent', () => {
            if (!MacroState.isMacroRunning()) return;
            lastRightClickTime = Date.now();
        }).setFilteredClass(PlayerInteractItemC2S);

        register('packetSent', (packet) => {
            if (!MacroState.isMacroRunning()) return;
            const command = packet.command().toLowerCase();
            if (command.includes('warp')) {
                lastCommandTime = Date.now();
                Chat.messageDebug(`warp command used, awaiting warp-point teleport ignore`, false);
                pendingWarpIgnore = true;
                if (pendingWarpIgnoreTimer) clearTimeout(pendingWarpIgnoreTimer);
                pendingWarpIgnoreTimer = setTimeout(() => {
                    pendingWarpIgnore = false;
                    pendingWarpIgnoreTimer = null;
                }, WARP_IGNORE_TIMEOUT_MS);
            }
        }).setFilteredClass(CommandExecutionC2S);
    }

    shouldIgnoreWarpTeleport(x, y, z) {
        if (!pendingWarpIgnore) return false;

        const isWarpPointTeleport = PathConfig.WARP_POINTS_DATA.some((warpPoint) => {
            const dx = x - warpPoint.x;
            const dy = y - warpPoint.y;
            const dz = z - warpPoint.z;
            return dx * dx + dy * dy + dz * dz <= WARP_IGNORE_RADIUS_SQ;
        });

        if (!isWarpPointTeleport) return false;

        pendingWarpIgnore = false;
        if (pendingWarpIgnoreTimer) {
            clearTimeout(pendingWarpIgnoreTimer);
            pendingWarpIgnoreTimer = null;
        }
        return true;
    }

    _isTeleportItemHeld() {
        const heldItem = Player.getHeldItem()?.getName()?.removeFormatting()?.toLowerCase();
        return Boolean(heldItem?.includes('aspect of the') && !heldItem?.includes('dragons'));
    }

    _hasSmallRotationDiff(data) {
        const { yaw, pitch, currYaw, currPitch } = data;
        if (yaw === undefined || pitch === undefined) return false;

        const yawDiff = Math.abs(yaw - currYaw);
        const pitchDiff = Math.abs(pitch - currPitch);
        return yawDiff < 30 && pitchDiff < 30;
    }

    _isAlongLookVector(data) {
        const { fromX, fromY, fromZ, toX, toY, toZ, lookVector } = data;
        if (!lookVector || fromX === undefined) return false;

        const dx = toX - fromX;
        const dy = toY - fromY;
        const dz = toZ - fromZ;
        const dist = Math.hypot(dx, dy, dz);
        if (dist <= 0.1) return false;

        const dot = (dx * lookVector.x + dy * lookVector.y + dz * lookVector.z) / dist;
        return dot > 0.85;
    }

    _shouldDisableTeleport(data) {
        if (this.disabled) return true;

        const now = Date.now();
        const recentClick = data.lastRightClickTime && now - data.lastRightClickTime < 1000;
        const usedItem = recentClick && this._isTeleportItemHeld();
        const recentCommand = data.lastCommandTime && now - data.lastCommandTime < 1000;

        if (!usedItem && !recentCommand) return false;

        if (recentCommand) {
            this._setDisabled(750);
            return true;
        }

        if (usedItem && (this._hasSmallRotationDiff(data) || this._isAlongLookVector(data))) {
            this._setDisabled(500);
            return true;
        }

        return false;
    }

    registerTPListeners() {
        register('packetReceived', (packet) => {
            if (!MacroState.isMacroRunning() || this.disabled) return;

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

            const dx = newX - fromX;
            const dy = newY - fromY;
            const dz = newZ - fromZ;
            const distanceSq = dx * dx + dy * dy + dz * dz;
            const distance = Math.sqrt(distanceSq);

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

            if (this._shouldDisableTeleport(data)) return;
            if (distanceSq < 0.01) return;
            if (this.shouldIgnoreWarpTeleport(newX, newY, newZ)) return;

            if (newX === 0 && newY === 0 && newZ === 0) {
                this.handleNullPacket(newX, newY, newZ);
                return;
            }

            setTimeout(() => {
                if (this.disabled || this._shouldDisableTeleport(data)) return;
                this.onTrigger(fromX, fromY, fromZ, newX, newY, newZ, distance);
            }, this._getReactionDelay(this.settings));
        }).setFilteredClass(PlayerPositionLookS2C);
    }

    handleNullPacket(x, y, z) {
        Chat.messageFailsafe('&c&lNULL PACKET DETECTED, DO NOT REACT!', false);
        FailsafeUtils.sendFailsafeEmbed('TP', 'very high - null packet', `You just recieved a null packet to ${x}, ${y}, ${z}!`, 16711680);
    }

    onTrigger(fX, fY, fZ, nX, nY, nZ, dist) {
        const { pressure, severity, color } = TELEPORT_TIERS.find((t) => dist < t.threshold);

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
