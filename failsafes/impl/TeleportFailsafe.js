import { Chat } from '../../utils/Chat';
import { ServerboundUseItemPacket, ClientboundPlayerPositionPacket, ServerboundChatCommandPacket } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
import { TIER_SEVERITIES } from '../SensitivityPresets';

const WARP_IGNORE_TIMEOUT_MS = 5000;
const LAGBACK_DISTANCE = 0.2;
const POSITION_HISTORY_LIMIT = 120;
const SAFE_COMMANDS = ['/skyblock', '/is', '/l', '/lobby', '/hub', '/garden', '/savethejerrys'];
const TELEPORT_PRESSURES = [5, 10, 20, 50];

class TeleportFailsafe extends Failsafe {
    constructor() {
        super();
        this.positions = [];
        this.warpIgnoreUntil = 0;
        this.itemTeleportUntil = 0;
        this.registerTPListeners();
        this.registerRightClickListener();
        this.registerPositionHistory();
    }

    registerRightClickListener() {
        register('packetSent', () => {
            if (!this.isActive()) return;
            if (this._isTeleportItemHeld()) this.itemTeleportUntil = Date.now() + 1000;
        }).setFilteredClass(ServerboundUseItemPacket);

        register('packetSent', (packet) => {
            if (!this.isActive()) return;
            const rawCommand = String(packet.command?.() || '').toLowerCase();
            const command = rawCommand.startsWith('/') ? rawCommand : `/${rawCommand}`;
            if (command.startsWith('/warp ') || SAFE_COMMANDS.includes(command)) {
                Chat.messageDebug(`warp command used, awaiting warp-point teleport ignore`, false);
                this.warpIgnoreUntil = Date.now() + WARP_IGNORE_TIMEOUT_MS;
            }
        }).setFilteredClass(ServerboundChatCommandPacket);
    }

    registerPositionHistory() {
        register('tick', () => {
            if (!World.isLoaded() || !Player.getPlayer()) return;
            this.positions.push({ x: Player.getX(), y: Player.getY(), z: Player.getZ() });
            if (this.positions.length > POSITION_HISTORY_LIMIT) this.positions.shift();
        });
    }

    _isTeleportItemHeld() {
        const heldItem = Player.getHeldItem()?.getName()?.removeFormatting()?.toLowerCase();
        return !!(heldItem?.includes('aspect of the') && !heldItem?.includes('dragons'));
    }

    itemTeleportInProgress() {
        return Date.now() < this.itemTeleportUntil;
    }

    _isLagback(x, y, z) {
        return this.positions.some((pos) => Math.hypot(pos.x - x, pos.y - y, pos.z - z) <= LAGBACK_DISTANCE);
    }

    registerTPListeners() {
        register('packetReceived', (packet) => {
            if (!this.isActive() || this.disabled) return;

            this.settings = FailsafeUtils.getFailsafeSettings('TP');
            if (!this.settings.isEnabled) return;

            const fromX = Player.getX();
            const fromY = Player.getY();
            const fromZ = Player.getZ();

            const change = packet.change();
            const pos = change.position();

            const newX = Number(pos.x());
            const newY = Number(pos.y());
            const newZ = Number(pos.z());

            const dx = newX - fromX;
            const dy = newY - fromY;
            const dz = newZ - fromZ;
            const distanceSq = dx * dx + dy * dy + dz * dz;
            const distance = Math.sqrt(distanceSq);

            if (distanceSq < 0.01) return;
            if (Date.now() < this.warpIgnoreUntil) return;
            if (this._isLagback(newX, newY, newZ)) {
                Chat.messageDebug('lagback teleport ignored by position history', false);
                this._setDisabled(500);
                return;
            }

            if (newX === 0 && newY === 0 && newZ === 0) {
                this._reportFailsafe({
                    type: 'TP',
                    severity: 'very high',
                    pressure: 100,
                    description: 'You just received a null packet to 0, 0, 0!',
                    chat: '&c&lNULL PACKET DETECTED, DO NOT REACT!',
                });
                return;
            }

            this._scheduleTrigger(
                () => {
                    this.onTrigger(fromX, fromY, fromZ, newX, newY, newZ, distance);
                },
                this.settings,
                () => Date.now() >= this.warpIgnoreUntil && !this._isLagback(newX, newY, newZ)
            );
        }).setFilteredClass(ClientboundPlayerPositionPacket);
    }

    onTrigger(fX, fY, fZ, nX, nY, nZ, dist) {
        const tiers = FailsafeUtils.getSensitivityPreset().teleport.tiers;
        const tierIndex = tiers.findIndex((threshold) => dist < threshold);
        const pressure = TELEPORT_PRESSURES[tierIndex];
        const severity = TIER_SEVERITIES[tierIndex];

        this._reportFailsafe({
            type: 'TP',
            severity,
            pressure,
            description: `**From:** ${fX.toFixed(2)} | ${fY.toFixed(2)} | ${fZ.toFixed(2)}
             **To:** ${nX.toFixed(2)} | ${nY.toFixed(2)} | ${nZ.toFixed(2)}
             **Distance:** ${dist.toFixed(1)} blocks`,
            chat: [
                `&l&cTeleport Detected!`,
                `&c&lFrom: &r&7${fX.toFixed(2)}&f, &7${fY.toFixed(2)}&f, &7${fZ.toFixed(2)}&f`,
                `&c&lTo: &r&7${nX.toFixed(2)}&f, &7${nY.toFixed(2)}&f, &7${nZ.toFixed(2)}&f`,
                `&c&lTotal Blocks: &r&7${dist.toFixed(0)}`,
            ],
        });
    }
}

export default new TeleportFailsafe();
