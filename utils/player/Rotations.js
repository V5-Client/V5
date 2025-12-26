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

        this.ROTATION_SPEED = 300;
        this.LINEAR = false;
        this.DAMPING_DIST = 60.0;

        this.addToggle(
            'Linear Rotations',
            (v) => {
                this.LINEAR = v;
            },
            '• Non-linear rotations have offsets making them more human-like\n• Linear rotations are smoother and more precise',
            true
        );

        this.addSlider(
            'Rotation Speed',
            30,
            60,
            40,
            (v) => {
                this.ROTATION_SPEED = v * 10;
            },
            'speed of the rotations'
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

        register('command', (yaw, pitch) => {
            this.rotateToAngles(parseFloat(yaw), parseFloat(pitch));
        }).setName('rotateTo');

        register('command', () => {
            this.stopRotation();
        }).setName('stopRotation');

        register('renderWorld', () => this.updateRotation());
    }

    applyGCD(angle, current) {
        const sensitivity = Client.getMinecraft().options.mouseSensitivity.getValue();
        const f = sensitivity * 0.6 + 0.2;
        const gcd = f * f * f * 1.2;
        const delta = angle - current;
        const steps = Math.round(delta / gcd);
        return current + steps * gcd;
    }

    normalizeAngle(angle) {
        return (((angle % 360) + 540) % 360) - 180;
    }

    getCurveOffset(distance) {
        if (RotationModule.LINEAR || !this.initialDistance) return { x: 0, y: 0 };

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

        const now = Date.now();
        if (this.lastTime === 0) {
            this.lastTime = now;
            this.startTime = now;
            this.curveSeed = Math.random() * Math.PI * 2;

            let startTarget = this.targetVector ? this.getAnglesFromVector(this.targetVector) : this.target;
            if (startTarget) {
                let dy = this.normalizeAngle(startTarget.yaw - Player.getYaw());
                let dp = startTarget.pitch - Player.getPitch();
                this.initialDistance = Math.sqrt(dy * dy + dp * dp);
            }
            return;
        }

        let finalTarget = this.targetVector ? this.getAnglesFromVector(this.targetVector) : this.target;
        if (!finalTarget) return this.stopRotation();

        let realYaw = Player.getYaw();
        let realPitch = Player.getPitch();

        let deltaYaw = this.normalizeAngle(finalTarget.yaw - realYaw);
        let deltaPitch = finalTarget.pitch - realPitch;
        let distance = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        if (distance <= this.precision) {
            Player.getPlayer().setYaw(this.applyGCD(finalTarget.yaw, realYaw));
            Player.getPlayer().setPitch(this.applyGCD(finalTarget.pitch, realPitch));
            return this.stopRotation();
        }

        let deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

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
        let nextYaw = realYaw + deltaYaw * ratio;
        let nextPitch = realPitch + deltaPitch * ratio;

        if (!RotationModule.LINEAR) {
            const curve = this.getCurveOffset(distance);
            nextYaw += curve.x * ratio;
            nextPitch += curve.y * ratio;
        }

        Player.getPlayer().setYaw(this.applyGCD(nextYaw, realYaw));
        Player.getPlayer().setPitch(Math.max(-90, Math.min(90, this.applyGCD(nextPitch, realPitch))));
    }

    rotateToAngles(yaw, pitch) {
        if (this.target && Math.abs(this.target.yaw - yaw) < 0.01 && Math.abs(this.target.pitch - pitch) < 0.01) return;

        this.target = { yaw, pitch };
        this.targetVector = null;
        this.isRotating = true;
        this.lastTime = 0;
        this.startTime = Date.now();
        this.initialDistance = 0;
    }

    rotateToVector(Vector) {
        const angles = this.getAnglesFromVector(Vector);
        if (!angles) return;
        this.rotateToAngles(angles.yaw, angles.pitch);
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
