import { Keybind } from '../../player/Keybinding';
import { PathExecutor } from '../PathExecutor';
import { Rotations } from './PathRotations';

class PathMovement {
    constructor() {
        this.forceJumpTicks = 0;
        this.backupTicks = 0;
        this.backupCallback = null;
        this.isActive = false;
        this.airborneTicks = 0;

        PathExecutor.onTick(() => {
            if (this.forceJumpTicks > 0) {
                Keybind.setKey('space', true);
                this.forceJumpTicks--;
                if (this.forceJumpTicks === 0) {
                    Keybind.setKey('space', false);
                }
            }

            if (this.backupTicks > 0) {
                Keybind.setKey('w', false);
                Keybind.setKey('s', true);
                Keybind.setKey('sprint', false);
                this.backupTicks--;

                if (this.backupTicks === 0) {
                    Keybind.setKey('s', false);

                    if (this.backupCallback) {
                        const cb = this.backupCallback;
                        this.backupCallback = null;
                        cb();
                    }
                }
            }

            this.updateMidairStrafe();
        });
    }

    beginMovement() {
        const player = Player.getPlayer();
        if (!player) return;

        this.isActive = true;
        this.airborneTicks = 0;

        if (this.backupTicks <= 0) {
            if (!player.isSprinting()) Keybind.setKey('sprint', true);
            Keybind.setKey('w', true);
        }
    }

    forceJump(ticks = 4) {
        this.forceJumpTicks = ticks;
    }

    backup(ticks, onComplete) {
        this.backupTicks = ticks;
        this.backupCallback = onComplete || null;
        this.airborneTicks = 0;
        this.clearStrafe();
    }

    isRecovering() {
        return this.forceJumpTicks > 0 || this.backupTicks > 0;
    }

    stopMovement() {
        this.isActive = false;
        this.forceJumpTicks = 0;
        this.backupTicks = 0;
        this.backupCallback = null;
        this.airborneTicks = 0;

        Keybind.stopMovement();
        Keybind.setKey('w', false);
        Keybind.setKey('s', false);
        Keybind.setKey('a', false);
        Keybind.setKey('d', false);
        Keybind.setKey('space', false);
    }

    updateMidairStrafe() {
        const player = Player.getPlayer();
        if (!player || !this.isActive) {
            this.airborneTicks = 0;
            return;
        }

        if (this.backupTicks > 0) {
            this.airborneTicks = 0;
            this.clearStrafe();
            return;
        }

        if (player.isOnGround()) {
            this.airborneTicks = 0;
            this.clearStrafe();
            return;
        }

        this.airborneTicks++;
        if (this.airborneTicks <= 3) {
            this.clearStrafe();
            return;
        }

        if (!Rotations.boxPositions || Rotations.currentPathPosition === null || Rotations.currentPathPosition === undefined) {
            this.clearStrafe();
            return;
        }

        const maxIndex = Rotations.boxPositions.length - 2;
        if (maxIndex < 0) {
            this.clearStrafe();
            return;
        }

        const idx = Math.max(0, Math.min(maxIndex, Math.floor(Rotations.currentPathPosition)));
        const p1 = Rotations.boxPositions[idx];
        const p2 = Rotations.boxPositions[idx + 1] || p1;
        if (!p1 || !p2) {
            this.clearStrafe();
            return;
        }

        const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        const t = Rotations.getClosestPointOnSegmentHorizontal(playerPos, p1, p2);
        const targetX = p1.x + (p2.x - p1.x) * t;
        const targetZ = p1.z + (p2.z - p1.z) * t;
        const dx = targetX - playerPos.x;
        const dz = targetZ - playerPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < 0.04) {
            this.clearStrafe();
            return;
        }

        const yawRad = (player.getYaw() * Math.PI) / 180;
        const forwardX = -Math.sin(yawRad);
        const forwardZ = Math.cos(yawRad);
        const mag = Math.sqrt(distSq);
        if (mag < 0.001) {
            this.clearStrafe();
            return;
        }

        const targetXNorm = dx / mag;
        const targetZNorm = dz / mag;
        const cross = forwardX * targetZNorm - forwardZ * targetXNorm;
        if (Math.abs(cross) < 0.1) {
            this.clearStrafe();
            return;
        }

        if (cross < 0) {
            Keybind.setKey('a', true);
            Keybind.setKey('d', false);
        } else {
            Keybind.setKey('a', false);
            Keybind.setKey('d', true);
        }
    }

    clearStrafe() {
        Keybind.setKey('a', false);
        Keybind.setKey('d', false);
    }
}

export const Movement = new PathMovement();
