import { Utils } from '../Utils';

class RotationsTo {
    constructor() {
        this.ROTATION_SPEED = 300;
        this.DAMPING_START_DISTANCE = 28.0;
        this.MIN_SPEED_MULTIPLIER = 0.05;

        this.target = null;
        this.targetVector = null;
        this.precision = 1.0;
        this.yawOnly = false;
        this.isRotating = false;

        this.lastTime = 0;
        this.actions = [];
        this.deltaTime = 0;

        this.lastAppliedYaw = 0;
        this.lastAppliedPitch = 0;
        this.gcdInitialized = false;

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

    getMouseSensitivity() {
        try {
            return Client.getMinecraft().options.mouseSensitivity.value;
        } catch (e) {
            console.error('Failed to get mouse sensitivity:', e);
            return 0.5;
        }
    }

    calculateGCD() {
        const sensitivity = this.getMouseSensitivity();
        const f = sensitivity * 0.6 + 0.2;
        return f * f * f * 1.2;
    }

    getGCDRotationDelta(from, to) {
        let delta = this.normalizeAngle(to) - this.normalizeAngle(from);
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return delta;
    }

    applyGCD(rotation, prevRotation, min = null, max = null) {
        const gcd = this.calculateGCD();

        const delta = this.getGCDRotationDelta(prevRotation, rotation);
        const roundedDelta = Math.round(delta / gcd) * gcd;
        let result = prevRotation + roundedDelta;

        if (max !== null && result > max) {
            result -= gcd;
        }
        if (min !== null && result < min) {
            result += gcd;
        }

        return result;
    }

    applyRotationWithGCD(yaw, pitch, yawOnly = false) {
        const player = Player.getPlayer();
        if (!player) return;

        if (!this.gcdInitialized) {
            this.lastAppliedYaw = player.getYaw();
            this.lastAppliedPitch = player.getPitch();
            this.gcdInitialized = true;
        }

        const gcdYaw = this.applyGCD(yaw, this.lastAppliedYaw);
        this.lastAppliedYaw = gcdYaw;
        player.setYaw(gcdYaw);

        if (!yawOnly) {
            const gcdPitch = this.applyGCD(pitch, this.lastAppliedPitch, -90, 90);
            this.lastAppliedPitch = gcdPitch;
            player.setPitch(gcdPitch);
        }
    }

    resetGCDTracking() {
        const player = Player.getPlayer();
        if (player) {
            this.lastAppliedYaw = player.getYaw();
            this.lastAppliedPitch = player.getPitch();
        }
        this.gcdInitialized = false;
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
        this.resetGCDTracking();
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
        this.resetGCDTracking();
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

        const newAngles = this.interpolate(finalTarget);

        this.applyRotationWithGCD(newAngles.yaw, newAngles.pitch, this.yawOnly);

        const currentYaw = Player.getYaw();
        const currentPitch = Player.getPitch();

        const deltaYaw = this.normalizeAngle(finalTarget.yaw - currentYaw);
        const deltaPitch = finalTarget.pitch - currentPitch;

        const distance = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        if (distance <= this.precision) {
            this.applyRotationWithGCD(finalTarget.yaw, finalTarget.pitch, this.yawOnly);
            this.stopRotation();
        }
    }

    removeCallback(name) {
        this.actions = this.actions.filter((action) => action.name !== name);
    }

    interpolate(targetRotation) {
        const currentYaw = Player.getYaw();
        const currentPitch = Player.getPitch();

        const targetYaw = targetRotation.yaw;
        const targetPitch = targetRotation.pitch;

        const deltaYaw = this.normalizeAngle(targetYaw - currentYaw);
        const deltaPitch = targetPitch - currentPitch;

        const distance = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        const dampingFactor = this.clamp(distance / this.DAMPING_START_DISTANCE, 0.0, 1.0);
        const speedMultiplier = this.lerp(this.MIN_SPEED_MULTIPLIER, 1.0, dampingFactor);
        const effectiveSpeed = this.ROTATION_SPEED * speedMultiplier;

        const maxAngleStep = effectiveSpeed * this.deltaTime;

        let moveYaw = 0;
        let movePitch = 0;

        if (distance > 0) {
            const moveAmount = Math.min(distance, maxAngleStep);
            const t = moveAmount / distance;

            moveYaw = deltaYaw * t;
            movePitch = deltaPitch * t;
        }

        let newYaw = currentYaw + moveYaw;
        let newPitch = currentPitch + movePitch;

        newYaw = this.normalizeAngle(newYaw);
        newPitch = this.clamp(newPitch, -90, 90);

        return { yaw: newYaw, pitch: newPitch };
    }
}

export const Rotations = new RotationsTo();
