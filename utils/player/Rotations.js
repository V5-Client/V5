import { Utils } from '../Utils';
import { ModuleBase } from '../ModuleBase';

class RotationConfig extends ModuleBase {
    constructor() {
        super({
            name: 'Rotations',
            subcategory: 'Core',
            description: 'Rotations settings for all modules - excludes Pathfinder',
            tooltip: 'Rotations settings for all modules - excludes Pathfinder',
            showEnabledToggle: false,
        });

        this.ROTATION_SPEED = 400;
        this.LINEAR = true;
        this.INSTANT = false;
        this.DAMPING_DIST = 60.0;

        this.addToggle(
            'Linear Rotations',
            (v) => {
                this.LINEAR = v;
            },
            '• Non-linear rotations have offsets making them more human-like\n• Linear rotations are smoother and more precise',
            true
        );

        this.addToggle(
            'Instant Rotations',
            (v) => {
                this.INSTANT = v;
            },
            'Skips the transition and snaps to the target immediately. Use with caution!',
            false
        );

        this.addSlider(
            'Rotation Speed',
            30,
            60,
            40,
            (v) => {
                this.ROTATION_SPEED = v * 10;
            },
            'Degrees per second for the camera movement'
        );
    }
}

export default RotationModule = new RotationConfig();

class RotationsTo {
    constructor() {
        this.target = null;
        this.targetVector = null;
        this.precision = 0.1;
        this.isRotating = false;
        this.lastTime = 0;
        this.actions = [];
        this.startTime = 0;
        this.initialDistance = 0;
        this.curveSeed = 0;

        this.lastAppliedYaw = 0;
        this.lastAppliedPitch = 0;
        this.gcdInitialized = false;

        register('command', (yaw, pitch) => {
            this.rotateToAngles(parseFloat(yaw), parseFloat(pitch));
        }).setName('rotateTo');

        register('command', () => {
            this.stopRotation();
        }).setName('stopRotation');

        register('renderWorld', () => this.updateRotation());
    }

    getGCDRotationDelta(from, to) {
        let delta = this.normalizeAngle(to) - this.normalizeAngle(from);
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return delta;
    }

    applyGCD(rotation, prevRotation, min = null, max = null) {
        const sensitivity = Client.getMinecraft().options.mouseSensitivity.getValue();
        const f = sensitivity * 0.6 + 0.2;
        const gcd = f * f * f * 1.2;
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

    applyRotationWithGCD(yaw, pitch) {
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

        const gcdPitch = this.applyGCD(pitch, this.lastAppliedPitch, -90, 90);
        this.lastAppliedPitch = gcdPitch;
        player.setPitch(gcdPitch);
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

    getCurveOffset(distance) {
        if (RotationModule.LINEAR || RotationModule.INSTANT || !this.initialDistance) return { x: 0, y: 0 };

        let progress = 1 - distance / this.initialDistance;
        let curveEffect = Math.sin(progress * Math.PI);
        let strength = this.initialDistance * 0.12 * curveEffect;

        return {
            x: Math.cos(this.curveSeed) * strength,
            y: Math.sin(this.curveSeed) * strength,
        };
    }

    updateRotation() {
        if (!this.isRotating) return;

        let finalTarget = this.targetVector ? this.getAnglesFromVector(this.targetVector) : this.target;
        if (!finalTarget) return this.stopRotation();

        let currentYaw = Player.getYaw();
        let currentPitch = Player.getPitch();

        if (RotationModule.INSTANT) {
            this.applyRotationWithGCD(finalTarget.yaw, finalTarget.pitch);
            return this.stopRotation();
        }

        const now = Date.now();
        if (this.lastTime === 0) {
            this.lastTime = now;
            this.startTime = now;
            this.curveSeed = Math.random() * Math.PI * 2;
            let dy = this.normalizeAngle(finalTarget.yaw - currentYaw);
            let dp = finalTarget.pitch - currentPitch;
            this.initialDistance = Math.sqrt(dy * dy + dp * dp);
            return;
        }

        let deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        let deltaYaw = this.normalizeAngle(finalTarget.yaw - currentYaw);
        let deltaPitch = finalTarget.pitch - currentPitch;
        let distance = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        if (distance <= this.precision) {
            this.applyRotationWithGCD(finalTarget.yaw, finalTarget.pitch);
            return this.stopRotation();
        }

        let timeAlive = (now - this.startTime) / 1000.0;
        let warmup = Math.min(timeAlive * 4, 1.0);
        let distModifier = Math.min(distance / RotationModule.DAMPING_DIST, 1.0);

        let step;
        if (RotationModule.LINEAR) {
            let linearSmooth = Math.pow(distModifier, 0.5);
            step = (RotationModule.ROTATION_SPEED * linearSmooth * warmup + 10) * deltaTime;
        } else {
            let t = Math.min(distance / RotationModule.DAMPING_DIST, 1.0);
            let smooth = Math.pow(t, 0.4);
            step = (RotationModule.ROTATION_SPEED * smooth * warmup + 10) * deltaTime;
        }

        let ratio = Math.min(distance, step) / distance;
        let nextYaw = currentYaw + deltaYaw * ratio;
        let nextPitch = currentPitch + deltaPitch * ratio;

        if (!RotationModule.LINEAR) {
            const curve = this.getCurveOffset(distance);
            nextYaw += curve.x * ratio;
            nextPitch += curve.y * ratio;
        }

        nextYaw = this.normalizeAngle(nextYaw);
        nextPitch = Math.max(-90, Math.min(90, nextPitch));

        this.applyRotationWithGCD(nextYaw, nextPitch);
    }

    rotateToAngles(yaw, pitch) {
        if (this.target && Math.abs(this.target.yaw - yaw) < 0.01 && Math.abs(this.target.pitch - pitch) < 0.01) return;

        this.target = { yaw, pitch };
        this.targetVector = null;
        this.isRotating = true;
        this.lastTime = 0;
        this.startTime = Date.now();
        this.initialDistance = 0;
        this.resetGCDTracking();
    }

    rotateToVector(Vector) {
        const angles = this.getAnglesFromVector(Vector);
        if (!angles) return;
        this.rotateToAngles(angles.yaw, angles.pitch);
    }

    onEndRotation(callBack, name = null) {
        if (typeof callBack === 'function') {
            this.actions.push({ func: callBack, name });
        }
    }

    stopRotation() {
        this.isRotating = false;
        this.target = null;
        this.targetVector = null;
        this.lastTime = 0;
        this.initialDistance = 0;
        while (this.actions.length > 0) {
            try {
                this.actions.shift().func();
            } catch (e) {}
        }
    }

    getAnglesFromVector(Vector) {
        let vec = Utils.convertToVector(Vector);
        let p = Player.getPlayer();
        if (!p) return null;
        let dx = vec.x - p.getX();
        let dy = vec.y - p.getEyePos().y;
        let dz = vec.z - p.getZ();
        let yaw = Math.atan2(-dx, dz) * (180 / Math.PI);
        let pitch = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI);
        return { yaw, pitch };
    }
}

export const Rotations = new RotationsTo();
