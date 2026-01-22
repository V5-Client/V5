import { Utils } from '../Utils';
import { ModuleBase } from '../ModuleBase';
import { v5Command } from '../V5Commands';

class RotationConfig extends ModuleBase {
    constructor() {
        super({
            name: 'Rotations',
            subcategory: 'Core',
            description: 'Rotations settings for all modules - excludes Pathfinder',
            tooltip: 'Rotations settings for all modules - excludes Pathfinder',
            showEnabledToggle: false,
            hideInModules: true,
        });

        this.ROTATION_SPEED = 400;
        this.rotationMode = 'Non-linear';
        this.DAMPING_DIST = 60.0;

        this.addDirectMultiToggle(
            'Rotation Mode',
            ['Linear', 'Non-linear (recommended)', 'Instant'],
            true,
            (value) => {
                if (value.length > 0 && typeof value[0] === 'string') {
                    this.rotationMode = value[0];
                } else {
                    this.rotationMode = value.find((opt) => opt.enabled)?.name || null;
                }
            },
            '• Non-linear rotations have offsets making them more human-like\n• Linear rotations are smoother and more precise\n• Instant rotations snap to the target immediately.',
            'Non-linear (recommended)',
            'Rotations'
        );

        this.addDirectSlider(
            'Rotation Speed',
            30,
            60,
            40,
            (v) => {
                this.ROTATION_SPEED = v * 10;
            },
            'Degrees per second',
            'Rotations'
        );
    }
}

const RotationModule = new RotationConfig();
export default RotationModule;

class RotationsTo {
    constructor() {
        this.target = null;
        this.targetVector = null;
        this.trackedEntity = null;
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
        this.speedMultiplier = 1.0;

        v5Command('rotateTo', (yaw, pitch) => {
            this.rotateToAngles(parseFloat(yaw), parseFloat(pitch));
        });

        v5Command('stopRotation', () => {
            this.stopRotation();
        });

        register('renderWorld', () => this.updateRotation());
    }

    selectProfile(distance) {
        if (RotationModule.rotationMode === 'Linear') return 'linear';
        if (distance < 15) return 'precise-log';
        if (distance < 45) return 'hermite-arc';
        if (distance < 90) return 'bezier-drift';
        return 'sinusoidal-wobble';
    }

    getMathEquationOffset(progress) {
        if (RotationModule.rotationMode === 'Linear' || RotationModule.rotationMode === 'Instant') return { x: 0, y: 0 };

        let curveFactor = 0;
        const safeProgress = Math.max(0, Math.min(1, progress));

        switch (this.motionProfile) {
            case 'precise-log':
                curveFactor = Math.sin(Math.sqrt(safeProgress) * Math.PI) * 0.8;
                break;
            case 'hermite-arc':
                curveFactor = Math.pow(safeProgress, 0.8) * Math.pow(1 - safeProgress, 1.2) * 3.5;
                break;
            case 'bezier-drift':
                curveFactor = Math.pow(safeProgress, 2) * (1 - safeProgress) * 6;
                break;
            case 'sinusoidal-wobble':
                curveFactor = Math.sin(safeProgress * safeProgress * Math.PI) * 1.2;
                break;
        }

        let strength = this.initialDistance * 0.25 * curveFactor * (1 - safeProgress);

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

    getEntityAimPoint(entity) {
        try {
            let mcEntity = entity.toMC ? entity.toMC() : entity;
            let box = mcEntity.getBoundingBox();

            if (box) {
                const height = box.maxY - box.minY;
                const centerX = (box.minX + box.maxX) / 2;
                const centerZ = (box.minZ + box.maxZ) / 2;

                const heightMultiplier = height >= 2.5 ? 0.5 : 0.85;
                const aimY = box.minY + height * heightMultiplier;

                return { x: centerX, y: aimY, z: centerZ };
            }

            if (typeof mcEntity.getX === 'function') {
                return {
                    x: mcEntity.getX(),
                    y: mcEntity.getY() + 1.5,
                    z: mcEntity.getZ(),
                };
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }

        return null;
    }

    updateTargetFromSource() {
        let newTarget = null;

        if (this.trackedEntity) {
            try {
                const mcEntity = this.trackedEntity.toMC ? this.trackedEntity.toMC() : this.trackedEntity;
                if (mcEntity.isDead()) {
                    this.stopRotation();
                    return false;
                }

                const aimPoint = this.getEntityAimPoint(this.trackedEntity);
                if (aimPoint) {
                    newTarget = this.getAnglesFromVector(aimPoint);
                }
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
                this.stopRotation();
                return false;
            }
        } else if (this.targetVector) {
            newTarget = this.getAnglesFromVector(this.targetVector.vector);
        }

        if (newTarget) {
            this.target = newTarget;
        }

        return true;
    }

    updateRotation() {
        if (!this.isRotating) return;

        if (!this.updateTargetFromSource()) return;

        let finalTarget = this.target;
        if (!finalTarget) return this.stopRotation();

        let currentYaw = Player.getYaw();
        let currentPitch = Player.getPitch();

        let deltaYaw = this.normalizeAngle(finalTarget.yaw - currentYaw);
        let deltaPitch = finalTarget.pitch - currentPitch;
        let distance = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

        const isExactVector = this.targetVector !== null;
        const effectivePrecision = isExactVector ? 0.05 : this.trackedEntity ? 0.5 : this.precision;

        if (distance <= effectivePrecision) {
            const player = Player.getPlayer();
            if (isExactVector && player) {
                player.setYaw(finalTarget.yaw);
                player.setPitch(finalTarget.pitch);
            } else {
                this.applyRotationWithGCD(finalTarget.yaw, finalTarget.pitch);
            }

            this.lastTime = Date.now();
            if (!this.trackedEntity) {
                this.stopRotation();
            }
            return;
        }

        if (RotationModule.rotationMode === 'Instant') {
            this.applyRotationWithGCD(finalTarget.yaw, finalTarget.pitch);
            if (!this.trackedEntity && !this.targetVector) {
                return this.stopRotation();
            }
            return;
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

        if (distance > this.initialDistance) {
            this.initialDistance = distance;
        }

        let deltaTime = (now - this.lastTime) / 1000.0;
        this.lastTime = now;

        let progress = Math.min(1.0, Math.max(0, 1 - distance / this.initialDistance));
        let timeAlive = (now - this.startTime) / 1000.0;
        let warmup = Math.min(timeAlive * 4, 1.0);
        let distModifier = Math.min(distance / RotationModule.DAMPING_DIST, 1.0);

        let speedMult = Math.pow(distModifier, 0.5);
        let baseSpeed = RotationModule.ROTATION_SPEED * this.speedMultiplier;
        let step = (baseSpeed * speedMult * warmup + 10) * deltaTime;

        let ratio = distance > 0 ? Math.min(distance, step) / distance : 0;

        let nextYaw = currentYaw + deltaYaw * ratio;
        let nextPitch = currentPitch + deltaPitch * ratio;

        if (RotationModule.rotationMode !== 'Linear') {
            const curve = this.getMathEquationOffset(progress);
            if (!isNaN(curve.x) && !isNaN(curve.y)) {
                nextYaw += curve.x * ratio;
                nextPitch += curve.y * ratio;
            }
        }

        nextYaw = this.normalizeAngle(nextYaw);
        nextPitch = Math.max(-90, Math.min(90, nextPitch));

        if (!isNaN(nextYaw) && !isNaN(nextPitch)) {
            const player = Player.getPlayer();
            if (isExactVector && player) {
                player.setYaw(nextYaw);
                player.setPitch(nextPitch);
                this.lastAppliedYaw = nextYaw;
                this.lastAppliedPitch = nextPitch;
            } else {
                this.applyRotationWithGCD(nextYaw, nextPitch);
            }
        }
    }

    rotateToAngles(yaw, pitch, speedMultiplier = 1.0) {
        if (this.isRotating && this.target) {
            const dYaw = Math.abs(this.normalizeAngle(yaw - this.target.yaw));
            const dPitch = Math.abs(pitch - this.target.pitch);
            if (dYaw < 0.1 && dPitch < 0.1) {
                this.target = { yaw, pitch };
                this.speedMultiplier = speedMultiplier;
                return;
            }
        }

        this.target = { yaw, pitch };
        this.targetVector = null;
        this.trackedEntity = null;
        this.speedMultiplier = speedMultiplier;
        this.isRotating = true;

        this.lastTime = 0;
        this.initialDistance = 0;
    }

    rotateToVector(vector, shiftTarget = true, speedMultiplier = 1.0) {
        const vec = Utils.convertToVector(vector);

        const wasRotatingToVector = this.isRotating && this.targetVector && !this.trackedEntity;

        this.targetVector = { vector: vec, shiftTarget };
        this.trackedEntity = null;
        this.speedMultiplier = speedMultiplier;
        this.isRotating = true;

        const initialTarget = this.getAnglesFromVector(vec);
        if (initialTarget) {
            let shouldResetTiming = !wasRotatingToVector;

            if (wasRotatingToVector && this.target) {
                const deltaYaw = Math.abs(this.normalizeAngle(initialTarget.yaw - this.target.yaw));
                const deltaPitch = Math.abs(initialTarget.pitch - this.target.pitch);
                const shift = Math.sqrt(deltaYaw * deltaYaw + deltaPitch * deltaPitch);

                if (shift > 5) {
                    shouldResetTiming = true;
                }
            }

            this.target = initialTarget;

            if (shouldResetTiming) {
                this.lastTime = 0;
                this.initialDistance = 0;
            }
        }
    }

    rotateToEntity(entity, speedMultiplier = 1.0) {
        if (!entity) return;

        try {
            const mcEntity = entity.toMC ? entity.toMC() : entity;
            if (mcEntity.isDead()) return;
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return;
        }

        const alreadyTrackingThis = this.isRotating && this.trackedEntity && this.isTrackingEntity(entity);

        this.trackedEntity = entity;
        this.targetVector = null;
        this.speedMultiplier = speedMultiplier;
        this.isRotating = true;

        const aimPoint = this.getEntityAimPoint(entity);
        if (aimPoint) {
            this.target = this.getAnglesFromVector(aimPoint);
        }

        if (!alreadyTrackingThis) {
            this.lastTime = 0;
            this.initialDistance = 0;
        }
    }

    isTrackingEntity(entity) {
        if (!this.trackedEntity || !entity) return false;

        try {
            const currentUUID = this.trackedEntity.getUUID
                ? this.trackedEntity.getUUID().toString()
                : this.trackedEntity.toMC
                  ? this.trackedEntity.toMC().getUuid().toString()
                  : null;

            const entityUUID = entity.getUUID ? entity.getUUID().toString() : entity.toMC ? entity.toMC().getUuid().toString() : null;

            if (currentUUID && entityUUID) {
                return currentUUID === entityUUID;
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }

        return this.trackedEntity === entity;
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
        this.trackedEntity = null;
        this.lastTime = 0;
        this.initialDistance = 0;
        this.resetGCDTracking();
        while (this.actions.length > 0) {
            try {
                this.actions.shift().func();
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
        }
    }

    getAnglesFromVector(vector) {
        let vec = Utils.convertToVector(vector);
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
