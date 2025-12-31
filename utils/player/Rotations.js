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
            'Skips the transition and snaps to the target immediately.',
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
            'Degrees per second'
        );
    }
}

const RotationModule = new RotationConfig();
export default RotationModule;

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
        this.motionProfile = 'linear';

        register('command', (yaw, pitch) => {
            this.rotateToAngles(parseFloat(yaw), parseFloat(pitch));
        }).setName('rotateTo');

        register('command', () => {
            this.stopRotation();
        }).setName('stopRotation');

        register('renderWorld', () => this.updateRotation());
    }

    selectProfile(distance) {
        if (RotationModule.LINEAR) return 'linear';
        if (distance < 15) return 'precise-log';
        if (distance < 45) return 'hermite-arc';
        if (distance < 90) return 'bezier-drift';
        return 'sinusoidal-wobble';
    }

    getMathEquationOffset(progress) {
        if (RotationModule.LINEAR || RotationModule.INSTANT) return { x: 0, y: 0 };

        let curveFactor = 0;
        switch (this.motionProfile) {
            case 'precise-log':
                curveFactor = Math.sin(Math.sqrt(progress) * Math.PI) * 0.8;
                break;
            case 'hermite-arc':
                curveFactor = Math.pow(progress, 0.8) * Math.pow(1 - progress, 1.2) * 3.5;
                break;
            case 'bezier-drift':
                curveFactor = Math.pow(progress, 2) * (1 - progress) * 6;
                break;
            case 'sinusoidal-wobble':
                curveFactor = Math.sin(progress * progress * Math.PI) * 1.2;
                break;
        }

        let strength = this.initialDistance * 0.25 * curveFactor * (1 - progress);

        return {
            x: Math.cos(this.curveSeed) * strength,
            y: Math.sin(this.curveSeed) * strength,
        };
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
        if (max !== null && result > max) result -= gcd;
        if (min !== null && result < min) result += gcd;
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

    updateRotation() {
        if (!this.isRotating) return;

        if (this.targetVector) {
            const currentTarget = this.getAnglesFromVector(this.targetVector);
            if (currentTarget) this.target = currentTarget;
        }

        let finalTarget = this.target;
        if (!finalTarget) return this.stopRotation();

        let currentYaw = Player.getYaw();
        let currentPitch = Player.getPitch();

        let deltaYaw = this.normalizeAngle(finalTarget.yaw - currentYaw);
        let deltaPitch = finalTarget.pitch - currentPitch;
        let distance = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        if (distance <= this.precision) {
            this.applyRotationWithGCD(finalTarget.yaw, finalTarget.pitch);
            this.lastTime = 0;
            this.initialDistance = 0;
            if (!this.targetVector) return this.stopRotation();
            return;
        }

        if (RotationModule.INSTANT) {
            this.applyRotationWithGCD(finalTarget.yaw, finalTarget.pitch);
            return this.stopRotation();
        }

        const now = Date.now();
        if (this.lastTime === 0) {
            this.lastTime = now;
            this.startTime = now;
            this.curveSeed = Math.random() * Math.PI * 2;
            this.initialDistance = distance;
            this.motionProfile = this.selectProfile(this.initialDistance);
            return;
        }

        if (distance > this.initialDistance) this.initialDistance = distance;

        let deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        let progress = Math.min(1.0, Math.max(0, 1 - distance / this.initialDistance));
        let timeAlive = (now - this.startTime) / 1000.0;
        let warmup = Math.min(timeAlive * 4, 1.0);
        let distModifier = Math.min(distance / RotationModule.DAMPING_DIST, 1.0);

        let speedMult = Math.pow(distModifier, 0.5);
        let step = (RotationModule.ROTATION_SPEED * speedMult * warmup + 10) * deltaTime;

        let ratio = Math.min(distance, step) / distance;

        let nextYaw = currentYaw + deltaYaw * ratio;
        let nextPitch = currentPitch + deltaPitch * ratio;

        if (!RotationModule.LINEAR) {
            const curve = this.getMathEquationOffset(progress);
            nextYaw += curve.x * ratio;
            nextPitch += curve.y * ratio;
        }

        nextYaw = this.normalizeAngle(nextYaw);
        nextPitch = Math.max(-90, Math.min(90, nextPitch));

        this.applyRotationWithGCD(nextYaw, nextPitch);
    }

    rotateToAngles(yaw, pitch) {
        this.target = { yaw, pitch };
        this.targetVector = null;
        this.isRotating = true;
    }

    rotateToVector(Vector) {
        this.targetVector = Vector;
        this.isRotating = true;
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
        this.resetGCDTracking();
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
