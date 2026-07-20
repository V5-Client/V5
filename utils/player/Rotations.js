import { ModuleBase } from '../ModuleBase';
import { RotationGCD } from './RotationGCD';
import { Utils } from '../Utils';
import { v5Command } from '../V5Commands';
import { Rotations as PathRotations } from '../pathfinder/PathWalker/PathRotations';
import { PathFlyer } from '../pathfinder/PathFlyer';
import { EtherwarpPathState } from '../Etherwarp';

class RotationConfig extends ModuleBase {
    constructor() {
        super({
            name: 'Rotations',
            subcategory: 'Core',
            description: 'Rotations settings for all modules - excludes Pathfinder',
            tooltip: 'Rotations settings for all modules - excludes Pathfinder',
            hideInModules: true,
        });

        this.ROTATION_SPEED = 400;
        this.rotationMode = 'Non-linear';
        this.DAMPING_DIST = 60;

        this.addDirectMultiToggle(
            'Rotation Mode',
            ['Linear', 'Non-linear (recommended)', 'Instant'],
            true,
            (value) => {
                this.rotationMode = value?.find((opt) => opt.enabled)?.name;
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

const DEFAULT_PRECISION = 0.1;
const ENTITY_PRECISION = 0.5;
const TARGET_SHIFT_RESET_DEGREES = 5;

class RotationController {
    constructor() {
        this.request = null;
        this.targetAngles = null;
        this.lastTime = 0;
        this.startTime = 0;
        this.initialDistance = 0;
        this.curveSeed = 0;
        this.callbacks = [];

        v5Command('rotations rotateTo', (yaw, pitch) => this.lookAtAngles(yaw, pitch), ['float', 'float']);

        v5Command('rotations rotateTo random', () => this.lookAtAngles(Math.random() * 360 - 180, Math.random() * 180 - 90));

        v5Command('rotations stop', () => this.stop());

        register('renderWorld', () => this.update());
    }

    get active() {
        return this.request !== null;
    }

    get currentVector() {
        return this.request?.type === 'vector' ? this.request.value : null;
    }

    lookAtAngles(yaw, pitch, options = {}) {
        if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return false;
        return this.start({ type: 'angles', value: { yaw, pitch: RotationGCD.clampPitch(pitch) } }, options);
    }

    lookAtVector(vector, options = {}) {
        const vec = Utils.convertToVector(vector);
        if (!vec) return false;
        return this.start({ type: 'vector', value: vec }, options);
    }

    // MAKE SURE YOU ONLY CALL THIS ONCE PER ENTITY. REPEATDLY CALLING trackEntity EVERY TICK CAUSES IT TO BREAK.
    trackEntity(entity, options = {}) {
        if (!this.isEntityUsable(entity)) return false;
        return this.start({ type: 'entity', value: entity }, options);
    }

    onComplete(callback, name = null) {
        if (typeof callback === 'function') {
            this.callbacks.push({ callback, name });
        }
    }

    stop() {
        this.clearRequest();
        this.callbacks = [];
        RotationGCD.syncFromPlayer();
    }

    getAimPoint(entity) {
        try {
            const mcEntity = entity?.toMC ? entity.toMC() : entity;
            if (!mcEntity) return null;

            const box = mcEntity.getBoundingBox?.();
            if (box) {
                const height = box.maxY - box.minY;
                const heightMultiplier = height >= 2.5 ? 0.5 : 0.85;

                return {
                    x: (box.minX + box.maxX) / 2,
                    y: box.minY + height * heightMultiplier,
                    z: (box.minZ + box.maxZ) / 2,
                };
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

    update() {
        if (!this.request) return;
        if (!this.refreshTarget()) return;

        if (PathRotations.rotationActive || PathFlyer.rotationActive || EtherwarpPathState.handler?.isPathing?.()) return;

        const player = Player.getPlayer();
        if (!player || !this.targetAngles) {
            this.stop();
            return;
        }

        const current = RotationGCD.getCurrentRotation(player);
        if (!current) {
            this.stop();
            return;
        }

        const targetYaw = RotationGCD.aimModulo360(current.yaw, this.targetAngles.yaw);
        const targetPitch = RotationGCD.clampPitch(this.targetAngles.pitch);
        const deltaYaw = targetYaw - current.yaw;
        const deltaPitch = targetPitch - current.pitch;
        const distance = Math.hypot(deltaYaw, deltaPitch);

        if (distance <= this.getPrecision()) {
            RotationGCD.applyToPlayer(targetYaw, targetPitch);
            this.onReachedTarget();
            return;
        }

        if (RotationModule.rotationMode === 'Instant') {
            RotationGCD.applyToPlayer(targetYaw, targetPitch);
            this.onReachedTarget();
            return;
        }

        const now = Date.now();
        if (this.lastTime === 0) {
            this.resetTiming(now, distance);
            return;
        }

        if (distance > this.initialDistance) {
            this.initialDistance = distance;
        }

        const deltaTime = Math.max(0, (now - this.lastTime) / 1000);
        this.lastTime = now;

        const ratio = this.getStepRatio(distance, deltaTime);
        const curve = this.getCurveOffset(this.getProgress(distance));
        const nextYaw = current.yaw + deltaYaw * ratio + curve.x * ratio;
        const nextPitch = RotationGCD.clampPitch(current.pitch + deltaPitch * ratio + curve.y * ratio);

        if (Number.isFinite(nextYaw) && Number.isFinite(nextPitch)) {
            RotationGCD.applyToPlayer(nextYaw, nextPitch);
        }
    }

    start(nextRequest, options = {}) {
        const nextTarget = this.resolveTarget(nextRequest);
        if (!nextTarget) return false;
        const speedMultiplier = Number.isFinite(options?.speedMultiplier) ? options.speedMultiplier : 1;
        const precision = Number.isFinite(options?.precision) && options.precision >= 0 ? options.precision : null;

        const sameSource = this.isSameSource(nextRequest);
        const shouldReset =
            !sameSource || !this.targetAngles || (nextRequest.type !== 'entity' && this.getTargetShift(nextTarget) > TARGET_SHIFT_RESET_DEGREES);

        if (!this.request || !sameSource) {
            RotationGCD.syncFromPlayer();
        }

        this.request = nextRequest;
        this.request.speedMultiplier = speedMultiplier;
        this.request.precision = precision;
        this.targetAngles = nextTarget;

        if (shouldReset) {
            this.resetTiming();
        }

        return true;
    }

    refreshTarget() {
        if (!this.request) return false;

        if (this.request.type === 'entity' && !this.isEntityUsable(this.request.value)) {
            this.stop();
            return false;
        }

        const target = this.resolveTarget(this.request);
        if (!target) {
            this.stop();
            return false;
        }

        this.targetAngles = target;
        return true;
    }

    resolveTarget(request) {
        if (!request) return null;
        if (request.type === 'angles') return request.value;
        if (request.type === 'vector') return this.getAnglesFromVector(request.value);
        if (request.type === 'entity') {
            const aimPoint = this.getAimPoint(request.value);
            return aimPoint ? this.getAnglesFromVector(aimPoint) : null;
        }
        return null;
    }

    isSameSource(nextRequest) {
        if (!this.request || this.request.type !== nextRequest.type) return false;
        if (nextRequest.type === 'entity') return this.request.value === nextRequest.value;
        return true;
    }

    isEntityUsable(entity) {
        if (!entity) return false;

        try {
            const mcEntity = entity.toMC ? entity.toMC() : entity;
            return !!mcEntity && !mcEntity.isDeadOrDying?.() && !mcEntity.isRemoved?.();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return false;
        }
    }

    getTargetShift(nextTarget) {
        const dYaw = Math.abs(RotationGCD.angleDifference(nextTarget.yaw, this.targetAngles.yaw));
        const dPitch = Math.abs(nextTarget.pitch - this.targetAngles.pitch);
        return Math.hypot(dYaw, dPitch);
    }

    getPrecision() {
        let precision = DEFAULT_PRECISION;
        if (Number.isFinite(this.request?.precision)) precision = this.request.precision;
        else if (this.request?.type === 'entity') precision = ENTITY_PRECISION;
        return Math.max(precision, RotationGCD.calculateGCD() / Math.SQRT2);
    }

    getStepRatio(distance, deltaTime) {
        if (distance <= 0) return 0;

        const timeAlive = this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0;
        const warmup = this.request?.type === 'angles' ? 1 : Math.min(timeAlive * 4, 1);
        const damping = Math.min(distance / RotationModule.DAMPING_DIST, 1);
        const speed = RotationModule.ROTATION_SPEED * (this.request?.speedMultiplier ?? 1) * Math.sqrt(damping);
        const step = (speed * warmup + 10) * deltaTime;

        return Math.min(distance, step) / distance;
    }

    getProgress(distance) {
        if (this.initialDistance <= 0) return 1;
        return Math.max(0, Math.min(1, 1 - distance / this.initialDistance));
    }

    getCurveOffset(progress) {
        if (RotationModule.rotationMode === 'Linear' || RotationModule.rotationMode === 'Instant') return { x: 0, y: 0 };

        const ease = Math.sin(progress * Math.PI);
        const fade = 1 - progress;
        const strength = this.initialDistance * 0.18 * ease * fade;

        return {
            x: Math.cos(this.curveSeed) * strength,
            y: Math.sin(this.curveSeed) * strength,
        };
    }

    onReachedTarget() {
        if (this.request?.type === 'entity') {
            this.lastTime = Date.now();
            return;
        }

        this.complete();
    }

    complete() {
        const callbacks = this.callbacks.splice(0);
        this.clearRequest();
        RotationGCD.syncFromPlayer();

        for (const action of callbacks) {
            try {
                action.callback();
            } catch (e) {
                console.error(`Rotation ${action.name || 'callback'} error:`);
                console.error('V5 Caught error' + e + e.stack);
            }
        }
    }

    clearRequest() {
        this.request = null;
        this.targetAngles = null;
        this.lastTime = 0;
        this.startTime = 0;
        this.initialDistance = 0;
    }

    resetTiming(now = 0, distance = 0) {
        this.lastTime = now;
        this.startTime = now;
        this.initialDistance = distance;
        this.curveSeed = Math.random() * Math.PI * 2;
    }

    getAnglesFromVector(vector) {
        const vec = Utils.convertToVector(vector);
        const player = Player.getPlayer();
        if (!vec || !player) return null;

        const dx = vec.x() - player.getX();
        const dy = vec.y() - player.getEyePosition().y();
        const dz = vec.z() - player.getZ();

        return {
            yaw: Math.atan2(-dx, dz) * (180 / Math.PI),
            pitch: RotationGCD.clampPitch(Math.atan2(-dy, Math.hypot(dx, dz)) * (180 / Math.PI)),
        };
    }
}

export const Rotations = new RotationController();
