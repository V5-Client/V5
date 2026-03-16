import { ModuleBase } from '../ModuleBase';
import { RotationGCD } from './RotationGCD';
import { Utils } from '../Utils';
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
        this.precision = 0.2;
        this.isRotating = false;
        this.lastTime = 0;
        this.actions = [];
        this.startTime = 0;
        this.initialDistance = 0;
        this.curveSeed = 0;
        this.motionProfile = 'linear';
        this.speedMultiplier = 1.0;

        v5Command('rotateTo', (yaw, pitch) => {
            this.rotateToAngles(Number.parseFloat(yaw), Number.parseFloat(pitch));
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

    applyRotationWithGCD(yaw, pitch) {
        RotationGCD.applyToPlayer(yaw, this.clampPitch(pitch));
    }

    normalizeAngle(angle) {
        return (((angle % 360) + 540) % 360) - 180;
    }

    clampPitch(pitch) {
        return Math.max(-90, Math.min(90, pitch));
    }

    sanitizeRotation(yaw, pitch, normalizeYaw = true) {
        return {
            yaw: normalizeYaw ? this.normalizeAngle(yaw) : yaw,
            pitch: this.clampPitch(pitch),
        };
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

        const player = Player.getPlayer();
        if (!player) return this.stopRotation();

        const currentRotation = RotationGCD.getCurrentRotation(player);
        let currentYaw = currentRotation?.yaw ?? player.getYaw();
        let currentPitch = currentRotation?.pitch ?? player.getPitch();

        const targetYaw = RotationGCD.aimModulo360(currentYaw, finalTarget.yaw);
        let deltaYaw = targetYaw - currentYaw;
        let deltaPitch = finalTarget.pitch - currentPitch;
        let distance = Math.hypot(deltaYaw, deltaPitch);

        const isExactVector = this.targetVector !== null;
        let effectivePrecision = this.precision;
        if (isExactVector) effectivePrecision = Math.max(0.05, RotationGCD.calculateGCD());
        else if (this.trackedEntity) effectivePrecision = 0.5;

        if (distance <= effectivePrecision) {
            if (isExactVector && player) {
                const safe = this.sanitizeRotation(targetYaw, finalTarget.pitch, false);
                player.setYaw(safe.yaw);
                player.setPitch(safe.pitch);
                RotationGCD.syncFromPlayer(safe.yaw, safe.pitch, player);
            } else {
                this.applyRotationWithGCD(targetYaw, finalTarget.pitch);
            }

            this.lastTime = Date.now();
            if (!this.trackedEntity) {
                this.stopRotation();
            }
            return;
        }

        if (RotationModule.rotationMode === 'Instant') {
            this.applyRotationWithGCD(targetYaw, finalTarget.pitch);
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
        let warmup;
        let distModifier = Math.min(distance / RotationModule.DAMPING_DIST, 1.0);

        if (this.targetVector || this.trackedEntity) {
            warmup = Math.min(timeAlive * 4, 1.0);
        } else {
            warmup = 1.0;
        }

        let speedMult = Math.pow(distModifier, 0.5);
        let baseSpeed = RotationModule.ROTATION_SPEED * this.speedMultiplier;
        let step = (baseSpeed * speedMult * warmup + 10) * deltaTime;

        let ratio = distance > 0 ? Math.min(distance, step) / distance : 0;

        let nextYaw = currentYaw + deltaYaw * ratio;
        let nextPitch = currentPitch + deltaPitch * ratio;

        if (RotationModule.rotationMode !== 'Linear') {
            const curve = this.getMathEquationOffset(progress);
            if (!Number.isNaN(curve.x) && !Number.isNaN(curve.y)) {
                nextYaw += curve.x * ratio;
                nextPitch += curve.y * ratio;
            }
        }

        nextPitch = Math.max(-90, Math.min(90, nextPitch));

        if (!Number.isNaN(nextYaw) && !Number.isNaN(nextPitch)) {
            this.applyRotationWithGCD(nextYaw, nextPitch);
        }
    }

    rotateToAngles(yaw, pitch, speedMultiplier = 1.0) {
        if (!this.isRotating) {
            RotationGCD.syncFromPlayer();
        }

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

        if (RotationModule.rotationMode === 'Instant') {
            this.applyRotationWithGCD(yaw, pitch);
            if (!this.trackedEntity && !this.targetVector) {
                return this.stopRotation();
            }
            return;
        }
    }

    rotateToVector(vector, shiftTarget = true, speedMultiplier = 1.0) {
        const vec = Utils.convertToVector(vector);

        const wasRotatingToVector = this.isRotating && this.targetVector && !this.trackedEntity;
        if (!wasRotatingToVector) {
            RotationGCD.syncFromPlayer();
        }

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
                const shift = Math.hypot(deltaYaw, deltaPitch);

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
        if (!alreadyTrackingThis) {
            RotationGCD.syncFromPlayer();
        }

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

            let entityUUID = null;
            if (entity.getUUID) entityUUID = entity.getUUID().toString();
            else if (entity.toMC) entityUUID = entity.toMC().getUuid().toString();

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
        RotationGCD.syncFromPlayer();
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
        let pitch = Math.atan2(-dy, Math.hypot(dx, dz)) * (180 / Math.PI);
        return { yaw, pitch };
    }
}

export const Rotations = new RotationsTo();
