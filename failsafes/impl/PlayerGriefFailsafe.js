import { MathUtils } from '../../utils/Math';
import PathConfig from '../../utils/pathfinder/PathConfig';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

class PlayerGriefFailsafe extends Failsafe {
    constructor() {
        super();
        this.lastInsideTrigger = 0;
        this.lastNearbyTrigger = 0;
        this.lastLookingTrigger = 0;
        this.lookFlags = new Map();
        register('step', () => {
            if (!this.isActive() || !World.isLoaded() || !Player.asPlayerMP()) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Player Grief');
            if (!this.settings.isEnabled) return;
            if (this.isNearWarpPoint()) return;

            const now = Date.now();
            const checkInside = now - this.lastInsideTrigger >= 5000;
            const checkNearby = now - this.lastNearbyTrigger >= 3000;
            const checkLooking = now - this.lastLookingTrigger >= 3000;
            if (checkInside || checkNearby || checkLooking) this.checkPlayers(now, checkInside, checkNearby, checkLooking);
        }).setDelay(1);
    }

    isNearWarpPoint() {
        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();
        return PathConfig.WARP_POINTS_DATA.some((warp) => Math.hypot(warp.x - px, warp.y - py, warp.z - pz) <= 5);
    }

    checkPlayers(now, checkInside, checkNearby, checkLooking) {
        const px = Player.getX();
        const py = Player.getY();
        const pz = Player.getZ();
        const maxDistance = this.settings.playerProximityDistance || 3;
        const maxDistanceSq = maxDistance * maxDistance;
        const whitelist = this._getWhitelist();
        const self = Player.asPlayerMP();
        const preset = checkLooking && FailsafeUtils.getSensitivityPreset().player;

        World.getAllPlayers().forEach((player) => {
            const playerName = player.getName();
            if (this._shouldIgnorePlayer(player, playerName, whitelist)) return;

            const lx = player.getX();
            const ly = player.getY();
            const lz = player.getZ();
            const dx = lx - px;
            const dy = ly - py;
            const dz = lz - pz;
            const distanceSq = dx * dx + dy * dy + dz * dz;

            if (checkInside && Math.trunc(lx) === Math.trunc(px) && Math.trunc(ly) === Math.trunc(py) && Math.trunc(lz) === Math.trunc(pz)) {
                this._reportFailsafe({
                    type: 'Player Grief',
                    severity: 'very high',
                    pressure: 120,
                    description: `${playerName} is standing inside you!`,
                    chat: `&c&l${playerName} is standing inside you!`,
                });
                this.lastInsideTrigger = now;
            }

            if (checkNearby && distanceSq <= maxDistanceSq && distanceSq > 1) {
                const distance = Math.sqrt(distanceSq);
                this._reportFailsafe({
                    type: 'Player Grief',
                    severity: 'medium',
                    pressure: 20,
                    description: `${playerName} is ${distance.toFixed(1)} blocks away!`,
                    chat: `&c&l${playerName} is ${distance.toFixed(1)} blocks away from you!`,
                });

                this.lastNearbyTrigger = now;
            }

            if (!checkLooking) return;
            if (this._isLookingAtPlayer(player, self, preset)) {
                const flags = (this.lookFlags.get(playerName) || 0) + 1;
                this.lookFlags.set(playerName, flags);
                if (flags < preset.lookFlags) return;
                this._reportFailsafe({
                    type: 'Player Grief',
                    severity: 'high',
                    pressure: 50,
                    description: `${playerName} appears to be watching you.`,
                    chat: `&c&l${playerName} appears to be looking at you!`,
                });
                this.lookFlags.set(playerName, 0);
                this.lastLookingTrigger = now;
            } else if (this.lookFlags.has(playerName)) {
                const flags = this.lookFlags.get(playerName) - 1;
                if (flags <= 0) this.lookFlags.delete(playerName);
                else this.lookFlags.set(playerName, flags);
            }
        });
    }

    _isLookingAtPlayer(player, self, preset) {
        const distance = player.distanceTo(self);
        if (distance > preset.lookDistance) return false;
        if (self.canSeeEntity && !self.canSeeEntity(player)) return false;

        const dynamicAngle = distance < 4 ? 360 : 180 * Math.exp(-preset.dynamicScaling * distance) + 4;
        const dx = Player.getX() - player.getX();
        const dy = Player.getY() - player.getY();
        const dz = Player.getZ() - player.getZ();
        const expectedYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        const expectedPitch = Math.atan2(-dy, Math.hypot(dx, dz)) * (180 / Math.PI);
        const yawDiff = Math.abs(MathUtils.getAngleDifference(player.getYaw(), expectedYaw));
        const pitchDiff = Math.abs(expectedPitch - player.getPitch());

        return yawDiff <= dynamicAngle && pitchDiff <= dynamicAngle;
    }

    _shouldIgnorePlayer(player, playerName, whitelist) {
        return !playerName || playerName === Player.getName() || player.getUUID?.()?.version?.() === 2 || whitelist.has(playerName.toLowerCase());
    }

    _getWhitelist() {
        const raw = this.settings.playerGriefWhitelist || '';
        return new Set(
            String(raw)
                .split(',')
                .map((name) => name.trim().toLowerCase())
                .filter(Boolean)
        );
    }
}

new PlayerGriefFailsafe();
