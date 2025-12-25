import { Utils } from '../Utils';

class RotationsTo {
    constructor() {
        this.ROTATION_SPEED = 300;
        this.DAMPING_START_DISTANCE = 45.0;
        this.MIN_SPEED_MULTIPLIER = 0.15;

        this.target = null;
        this.targetVector = null;
        this.precision = 0.5;
        this.yawOnly = false;
        this.isRotating = false;

        this.lastTime = 0;
        this.actions = [];
        this.deltaTime = 0;

        this.randomOffset = { yaw: 0, pitch: 0 };

        register('command', (yaw, pitch) => {
            this.rotateToAngles(parseFloat(yaw), parseFloat(pitch));
        }).setName('rotateTo');

        register('command', () => {
            this.stopRotation();
        }).setName('stopRotation');

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

    smoothStep(t) {
        return t * t * (3 - 2 * t);
    }

    rotateToAngles(yaw, pitch, precision = 0.5, yawOnly = false) {
        if (isNaN(yaw) || isNaN(pitch)) return;
        this.targetVector = null;
        this.target = { yaw, pitch };
        this.precision = precision;
        this.yawOnly = yawOnly;
        this.isRotating = true;
        this.lastTime = 0;

        this.randomOffset = {
            yaw: (Math.random() - 0.5) * 0.5,
            pitch: (Math.random() - 0.5) * 0.5,
        };
    }

    getAnglesFromVector(Vector) {
        let vec = Utils.convertToVector(Vector);
        let player = Player.getPlayer();
        if (!player) return null;

        let eyeHeight = player.getEyePos().y - player.y;
        let dx = vec.x - player.x;
        let dy = vec.y - (player.y + eyeHeight);
        let dz = vec.z - player.z;

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

    onEndRotation(callBack, name = null) {
        if (typeof callBack === 'function') {
            this.actions.push({ func: callBack, name });
        }
    }

    stopRotation() {
        if (!this.isRotating) return;
        this.isRotating = false;
        this.target = null;
        this.targetVector = null;
        this.lastTime = 0;

        while (this.actions.length > 0) {
            const action = this.actions.shift();
            try {
                action.func();
            } catch (error) {
                console.error(`Error executing rotation callback: ${error}`);
            }
        }
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
                this.stopRotation();
                return;
            }
        } else if (this.target) {
            finalTarget = this.target;
        } else {
            this.stopRotation();
            return;
        }

        const currentYaw = Player.getYaw();
        const currentPitch = Player.getPitch();
        const deltaYaw = this.normalizeAngle(finalTarget.yaw - currentYaw);
        const deltaPitch = finalTarget.pitch - currentPitch;
        const distance = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        if (distance <= this.precision) {
            Player.getPlayer().setYaw(finalTarget.yaw);
            if (!this.yawOnly) Player.getPlayer().setPitch(this.clamp(finalTarget.pitch, -90, 90));
            this.stopRotation();
            return;
        }

        const newAngles = this.interpolate(finalTarget, distance);
        Player.getPlayer().setYaw(newAngles.yaw);
        if (!this.yawOnly) Player.getPlayer().setPitch(newAngles.pitch);
    }

    interpolate(targetRotation, distance) {
        const currentYaw = Player.getYaw();
        const currentPitch = Player.getPitch();

        let t_dist = this.clamp(distance / this.DAMPING_START_DISTANCE, 0.0, 1.0);
        let smoothDamping = this.smoothStep(t_dist);

        const speedMultiplier = (1.0 - this.MIN_SPEED_MULTIPLIER) * smoothDamping + this.MIN_SPEED_MULTIPLIER;
        const effectiveSpeed = this.ROTATION_SPEED * speedMultiplier;
        const maxAngleStep = effectiveSpeed * this.deltaTime;

        const targetYaw = targetRotation.yaw + this.randomOffset.yaw * smoothDamping;
        const targetPitch = targetRotation.pitch + this.randomOffset.pitch * smoothDamping;

        const deltaYaw = this.normalizeAngle(targetYaw - currentYaw);
        const deltaPitch = targetPitch - currentPitch;
        const currentStepDist = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        let moveYaw = 0;
        let movePitch = 0;

        if (currentStepDist > 0) {
            const moveAmount = Math.min(currentStepDist, maxAngleStep);
            const t = moveAmount / currentStepDist;
            moveYaw = deltaYaw * t;
            movePitch = deltaPitch * t;
        }

        let newYaw = this.normalizeAngle(currentYaw + moveYaw);
        let newPitch = this.clamp(currentPitch + movePitch, -90, 90);

        return { yaw: newYaw, pitch: newPitch };
    }
}

export const Rotations = new RotationsTo();
