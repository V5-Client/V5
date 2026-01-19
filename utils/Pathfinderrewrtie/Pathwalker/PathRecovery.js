import { Vec3d, BP } from '../../Constants';
import { Utils } from '../../Utils';
import { Keybind } from '../../player/Keybinding';
import { Chat } from '../../Chat';
import { Rotations } from './PathRotations';

class PathRecovery {
    constructor() {
        this.MOVING_THRESH = 0.12;
        this.COLLIDED_THRESH = 0.05;
        this.RETRY_INTERVALS = [3, 14, 25];
        this.MAX_ATTEMPTS = 3;
        this.LOCKOUT_TICKS = 25;
        this.SEVERE_STUCK_TICKS = 40;

        this.lastPos = null;
        this.stuckTicks = 0;
        this.attemptCount = 0;
        this.recoveryLockTicks = 0;
        this.referenceBoxIndex = -1;

        this.isActive = false;
        this.currentPhase = null;
        this.phaseTicks = 0;
        this.jumpDurationTicks = 0;
        this.activeEscapeYaw = null;
        this.backupDuration = 0;
        this.forwardDelay = 0;

        this.boxPositions = [];
        this.currentBoxIndex = -1;
    }

    setBoxIndex(boxIndex) {
        this.currentBoxIndex = boxIndex;
    }

    trackProgress() {
        if (!this.boxPositions?.length) {
            this.boxPositions = Rotations.boxPositions;
            this.currentBoxIndex = Rotations.currentBoxIndex;
        }

        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();

        if (this.isActive) {
            this.processRecoverySequence();
            return 'RECOVERING';
        }

        if (this.jumpDurationTicks > 0) this.executeJumpTick();

        if (this.recoveryLockTicks > 0) {
            if (--this.recoveryLockTicks === 0) {
                this.verifyRecoverySuccess();
            }
            return null;
        }

        const distMoved = this.lastPos ? this.getDistanceHorizontal(pX, pZ, this.lastPos.x, this.lastPos.z) : 1.0;
        const threshold = Utils.playerIsCollided() ? this.COLLIDED_THRESH : this.MOVING_THRESH;

        if (distMoved > threshold) {
            this.resetTracking(pX, pY, pZ);
            return null;
        }

        this.stuckTicks++;
        this.lastPos = new Vec3d(pX, pY, pZ);

        if (this.stuckTicks >= this.SEVERE_STUCK_TICKS) {
            Chat.messagePathfinder(`§4[Stuck] Severe - Requesting Recalculate`);
            this.stop();
            return 'RECALCULATE';
        }

        return this.triggerAttempt();
    }

    triggerAttempt() {
        const nextThreshold = this.RETRY_INTERVALS[this.attemptCount];
        if (this.stuckTicks < nextThreshold || this.attemptCount >= this.MAX_ATTEMPTS) return null;

        this.attemptCount++;
        this.recoveryLockTicks = this.LOCKOUT_TICKS;
        this.referenceBoxIndex = this.currentBoxIndex;

        const escapeYaw = this.calculateEscapeYaw();
        if (escapeYaw !== null) {
            this.activeEscapeYaw = escapeYaw;
            Chat.messagePathfinder(`§e[Recovery] Trapped! Escaping at ${escapeYaw.toFixed(0)}°`);
            this.startSequence('JUMP', 0, 4);
            return this.currentBoxIndex;
        }

        let rewindIndex = this.currentBoxIndex;
        switch (this.attemptCount) {
            case 1:
                Chat.messagePathfinder(`Recovery 1/3: Jump Only`);
                this.startSequence('JUMP', 0, 3);
                //rewindIndex = Math.max(0, this.currentBoxIndex - 1);
                break;
            case 2:
                Chat.messagePathfinder(`Recovery 2/3: Backup + Jump`);
                this.startSequence('BACKUP', 12, 4);
                // rewindIndex = Math.max(0, this.currentBoxIndex - 2);
                break;
            case 3:
                Chat.messagePathfinder(`Recovery 3/3: Full Rewind`);
                this.startSequence('BACKUP', 20, 5);
                // rewindIndex = Math.max(0, this.currentBoxIndex - 5);
                break;
        }

        Rotations.currentBoxIndex = rewindIndex;
        this.currentBoxIndex = rewindIndex;
        return rewindIndex;
    }

    processRecoverySequence() {
        this.phaseTicks++;

        if (this.currentPhase === 'BACKUP' && this.phaseTicks >= this.backupDuration) {
            this.startSequence('JUMP', 0, this.forwardDelay);
        } else if (this.currentPhase === 'JUMP' && this.phaseTicks >= 4 + this.forwardDelay) {
            this.currentPhase = 'FORWARD';
            this.phaseTicks = 0;
        } else if (this.currentPhase === 'FORWARD' && this.phaseTicks >= 5) {
            this.isActive = false;
        }
    }

    startSequence(phase, backupTicks, forwardDelay) {
        this.isActive = true;
        this.currentPhase = phase;
        this.phaseTicks = 0;
        this.backupDuration = backupTicks;
        this.forwardDelay = forwardDelay;
        if (phase === 'JUMP') this.jumpDurationTicks = 4;
    }

    executeJumpTick() {
        this.jumpDurationTicks--;
        Keybind.setKey('space', true);
    }

    verifyRecoverySuccess() {
        if (!this.lastPos) return;
        const pX = Player.getX(),
            pZ = Player.getZ();
        const distFromStuck = this.getDistanceHorizontal(pX, pZ, this.lastPos.x, this.lastPos.z);

        if (distFromStuck > 1.5) {
            Chat.messagePathfinder(`§a[Recovery] Success!`);
            this.attemptCount = 0;
            this.stuckTicks = 0;
        } else {
            Chat.messagePathfinder(`§c[Recovery] Failed.`);
        }
    }

    calculateEscapeYaw() {
        const directions = [
            { dx: 1, dz: 0, yaw: -90 },
            { dx: -1, dz: 0, yaw: 90 },
            { dx: 0, dz: 1, yaw: 0 },
            { dx: 0, dz: -1, yaw: 180 },
        ];
        let blockedCount = 0;
        let validExitYaw = null;
        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();

        directions.forEach((dir) => {
            if (this.isBlockSolid(pX + dir.dx, pY, pZ + dir.dz) || this.isBlockSolid(pX + dir.dx, pY + 1, pZ + dir.dz)) {
                blockedCount++;
            } else {
                validExitYaw = dir.yaw;
            }
        });
        return blockedCount >= 3 && validExitYaw !== null && this.isBlockSolid(pX, pY + 2, pZ) ? validExitYaw : null;
    }

    isBlockSolid(x, y, z) {
        const pos = new BP(Math.floor(x), Math.floor(y), Math.floor(z));
        const world = World.getWorld();
        if (!world) return false;
        return !world.getBlockState(pos).getCollisionShape(world, pos).isEmpty();
    }

    resetTracking(x, y, z) {
        this.lastPos = new Vec3d(x, y, z);
        this.stuckTicks = 0;
        this.attemptCount = 0;
        this.activeEscapeYaw = null;
    }

    stop() {
        this.isActive = false;
        this.currentPhase = null;
        this.stuckTicks = 0;
        this.attemptCount = 0;
        this.recoveryLockTicks = 0;
        this.jumpDurationTicks = 0;
        this.activeEscapeYaw = null;
        this.lastPos = null;
    }

    getActiveControls() {
        return {
            isForward: this.isActive && (this.currentPhase === 'JUMP' || this.currentPhase === 'FORWARD'),
            isBackward: this.isActive && this.currentPhase === 'BACKUP',
            isJumping: this.jumpDurationTicks > 0,
            overrideYaw: this.activeEscapeYaw,
        };
    }

    getDistanceHorizontal(x1, z1, x2, z2) {
        const dx = x1 - x2;
        const dz = z1 - z2;
        return Math.sqrt(dx * dx + dz * dz);
    }
}

export const Recovery = new PathRecovery();
