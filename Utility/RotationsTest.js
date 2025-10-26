import { Vec3d } from './Constants';
import { Rotations } from './Rotations';
import { Utils } from './Utils';

class Rotation2 {
    constructor() {
        this.ROTATION_SPEED = 300;
        this.DAMPING_START_DISTANCE = 25.0;
        this.MIN_SPEED_MULTIPLIER = 0.05;

        this.target = null;
        this.targetVector = null;
        this.precision = 1.0;
        this.yawOnly = false;
        this.isRotating = false;

        this.lastTime = 0;
        this.deltaTime = 0;

        register('command', (yaw, pitch) => {
            this.rotateToAngles(parseFloat(yaw), parseFloat(pitch));
        }).setName('rotateTo');

        register('renderWorld', () => {
            this.updateRotation();
        });
    }

    normalizeAngle(angle) {
        return (((angle % 360) + 540) % 360) - 180;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    rotateToAngles(yaw, pitch, precision = 1.0, yawOnly = false) {
        if (isNaN(yaw) || isNaN(pitch)) {
            return;
        }
        this.targetVector = null;
        this.target = { yaw, pitch };
        this.precision = precision;
        this.yawOnly = yawOnly;
        this.isRotating = true;
        this.lastTime = 0;
    }

    getAnglesFromVector(Vector) {
        let vec = Utils.convertToVector(Vector);
        let player = Player.getPlayer();

        if (!player) return null;

        let playerPos = player.getPos();
        let eyeHeight = player.getEyePos().y - playerPos.y;

        let dx = vec.x - playerPos.x;
        let dy = vec.y - (playerPos.y + eyeHeight);
        let dz = vec.z - playerPos.z;

        let targetYaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        let dist = Math.sqrt(dx * dx + dz * dz);
        let targetPitch = Math.atan2(-dy, dist) * (180 / Math.PI);

        return { yaw: targetYaw, pitch: targetPitch };
    }

    rotateToVector(Vector, precision = 0.5, yawOnly = false) {
        this.targetVector = Vector;
        this.target = null;
        this.isRotating = true;
        this.precision = precision;
        this.yawOnly = yawOnly;
        this.lastTime = 0;
    }

    updateRotation() {
        const now = Date.now();
        if (this.lastTime === 0) {
            this.lastTime = now;
            return;
        }
        this.deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        if (!this.isRotating) return;

        let finalTarget = null;
        if (this.targetVector) {
            finalTarget = this.getAnglesFromVector(this.targetVector);
            if (!finalTarget) {
                this.isRotating = false;
                this.targetVector = null;
                return;
            }
        } else if (this.target) {
            finalTarget = this.target;
        } else {
            this.isRotating = false;
            return;
        }

        const newAngles = this.interpolate(finalTarget);

        Player.getPlayer().setYaw(newAngles.yaw);
        if (!this.yawOnly) Player.getPlayer().setPitch(newAngles.pitch);

        const currentYaw = Player.getYaw();
        const currentPitch = Player.getPitch();

        const deltaYaw = this.normalizeAngle(finalTarget.yaw - currentYaw);
        const deltaPitch = finalTarget.pitch - currentPitch;

        const distance = Math.sqrt(
            deltaYaw * deltaYaw + deltaPitch * deltaPitch
        );

        if (distance <= this.precision) {
            Player.getPlayer().setYaw(finalTarget.yaw);
            if (!this.yawOnly) {
                Player.getPlayer().setPitch(finalTarget.pitch);
            }
            this.isRotating = false;
            this.targetVector = null;
            this.target = null;
            this.lastTime = 0;
        }
    }

    interpolate(targetRotation) {
        const currentYaw = Player.getYaw();
        const currentPitch = Player.getPitch();

        const targetYaw = targetRotation.yaw;
        const targetPitch = targetRotation.pitch;

        const deltaYaw = this.normalizeAngle(targetYaw - currentYaw);
        const deltaPitch = targetPitch - currentPitch;

        const currentPitchRad = currentPitch * (Math.PI / 180);
        const cosPitch = Math.cos(currentPitchRad);
        const EPSILON = 0.001;

        const deltaYawScaled = deltaYaw * cosPitch;

        const distance = Math.sqrt(
            deltaYawScaled * deltaYawScaled + deltaPitch * deltaPitch
        );

        const dampingFactor = this.clamp(
            distance / this.DAMPING_START_DISTANCE,
            0.0,
            1.0
        );
        const speedMultiplier = this.lerp(
            this.MIN_SPEED_MULTIPLIER,
            1.0,
            dampingFactor
        );
        const effectiveSpeed = this.ROTATION_SPEED * speedMultiplier;

        const maxAngleStep = effectiveSpeed * this.deltaTime;
        let moveYaw = 0;
        let movePitch = 0;

        if (distance > 0) {
            const moveAmount = Math.min(distance, maxAngleStep);

            const directionYawScaled = deltaYawScaled / distance;
            const directionPitch = deltaPitch / distance;

            movePitch = directionPitch * moveAmount;

            if (Math.abs(cosPitch) > EPSILON) {
                moveYaw = (directionYawScaled * moveAmount) / cosPitch;
            } else {
                moveYaw = 0;
            }
        }

        let newYaw = currentYaw + moveYaw;
        let newPitch = currentPitch + movePitch;

        newYaw = this.normalizeAngle(newYaw);
        newPitch = this.clamp(newPitch, -90, 90);

        return { yaw: newYaw, pitch: newPitch };
    }
}

export const RotationRedo = new Rotation2();
