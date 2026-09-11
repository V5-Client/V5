import { BP, Vec3d } from './Constants';
import { MiningUtils } from './MiningUtils';
import { Raytrace, visibilityChecker } from './Raytrace';
import { Utils } from './Utils';
import { Guis } from './player/Inventory';
import { RotationGCD } from './player/RotationGCD';
import { ServerInfo } from './player/ServerInfo';

class MiningRotationController {
    constructor() {
        this.active = false;
        this.targetYaw = 0;
        this.targetPitch = 0;
        this.initialYawDistance = 0;
        this.initialPitchDistance = 0;
        this.speed = 0.12;
        this.gcd = 0;
        this.lastUpdateAt = 0;
        this.yawRemainder = 0;
        this.pitchRemainder = 0;
        this.yawVelocity = 0;
        this.pitchVelocity = 0;
        this.yawArc = 0;
        this.pitchArc = 0;
        this.arcDirection = 1;
        this.trackingVector = null;
        this.callbacks = [];
        register('renderWorld', () => this.update());
    }

    get isRotating() {
        return this.active;
    }

    lookAtAngles(yaw, pitch, speed = 0.48) {
        const player = Player.getPlayer();
        if (!player || !Number.isFinite(yaw) || !Number.isFinite(pitch)) return false;
        const eyes = player.getEyePosition();
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pitch * Math.PI) / 180;
        const distance = 10;
        return this.lookAtVector(
            {
                x: eyes.x() - Math.sin(yawRad) * Math.cos(pitchRad) * distance,
                y: eyes.y() - Math.sin(pitchRad) * distance,
                z: eyes.z() + Math.cos(yawRad) * Math.cos(pitchRad) * distance,
            },
            speed
        );
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

    trackEntity(entity, speed) {
        const point = this.getAimPoint(entity);
        return point ? this.trackVector(point, speed) : false;
    }

    onComplete(callback) {
        if (typeof callback === 'function') this.callbacks.push(callback);
    }

    lookAtVector(vector, speed = 0.48) {
        const player = Player.getPlayer();
        const angles = player && this.getTargetAngles(player, vector);
        if (!angles || !Number.isFinite(angles.yaw) || !Number.isFinite(angles.pitch) || !Number.isFinite(speed)) return false;
        const currentYaw = player.getYRot();
        const currentPitch = player.getXRot();
        this.targetYaw = RotationGCD.aimModulo360(currentYaw, angles.yaw);
        this.targetPitch = RotationGCD.clampPitch(angles.pitch);
        this.initialYawDistance = Math.abs(RotationGCD.angleDifference(this.targetYaw, currentYaw));
        this.initialPitchDistance = Math.abs(this.targetPitch - currentPitch);
        const distance = Math.hypot(this.initialYawDistance, this.initialPitchDistance);
        const arc = Math.min(0.75, distance * 0.02) * (this.arcDirection *= -1);
        this.yawArc = this.initialYawDistance < 0.5 && this.initialPitchDistance > 1 ? arc : 0;
        this.pitchArc = this.initialPitchDistance < 0.5 && this.initialYawDistance > 1 ? arc : 0;
        if (this.targetPitch > 80) this.pitchArc = -Math.abs(this.pitchArc);
        if (this.targetPitch < -80) this.pitchArc = Math.abs(this.pitchArc);
        this.speed = speed;
        this.gcd = RotationGCD.calculateGCD();
        this.lastUpdateAt = Date.now();
        this.yawRemainder = 0;
        this.pitchRemainder = 0;
        this.yawVelocity = 0;
        this.pitchVelocity = 0;
        this.trackingVector = null;
        this.callbacks = [];
        this.active = true;
        return true;
    }

    trackVector(vector, speed) {
        if (!this.active) {
            if (!this.lookAtVector(vector, speed)) return false;
            this.trackingVector = vector;
            return true;
        }
        const player = Player.getPlayer();
        if (!player || !vector || !this.refreshTrackedTarget(player, vector)) return false;
        this.trackingVector = vector;
        if (Number.isFinite(speed)) this.speed = speed;
        return true;
    }

    retargetVector(vector, speed) {
        if (!this.active) return this.lookAtVector(vector, speed);
        const player = Player.getPlayer();
        if (!player || !vector || !this.refreshTrackedTarget(player, vector)) return false;
        this.trackingVector = null;
        if (Number.isFinite(speed)) this.speed = speed;
        return true;
    }

    stop(completed = false) {
        this.active = false;
        this.trackingVector = null;
        const callbacks = completed ? this.callbacks : [];
        this.callbacks = [];
        callbacks.forEach((callback) => callback());
    }

    update() {
        if (!this.active) return;
        const player = Player.getPlayer();
        if (!player) return this.stop();
        if (this.trackingVector && !this.refreshTrackedTarget(player, this.trackingVector)) return this.stop();
        const now = Date.now();
        const elapsedMs = this.lastUpdateAt ? Math.max(1, Math.min(100, now - this.lastUpdateAt)) : 1000 / 60;
        this.lastUpdateAt = now;
        const currentYaw = player.getYRot();
        const currentPitch = player.getXRot();
        let deltaYaw = RotationGCD.angleDifference(this.targetYaw, currentYaw);
        let deltaPitch = this.targetPitch - currentPitch;
        const distance = Math.hypot(deltaYaw, deltaPitch);
        if (distance <= 0.5) {
            this.yawVelocity = 0;
            this.pitchVelocity = 0;
            this.applyRotation(player, this.targetYaw, this.targetPitch);
            if (this.trackingVector) return;
            return this.stop(true);
        }
        this.initialYawDistance = Math.max(this.initialYawDistance, Math.abs(deltaYaw));
        this.initialPitchDistance = Math.max(this.initialPitchDistance, Math.abs(deltaPitch));
        const speed = Math.max(0.01, Math.min(0.95, this.speed));
        const frequency = (-Math.log(1 - speed) / 0.05) * 1.5;
        const initialDistance = Math.hypot(this.initialYawDistance, this.initialPitchDistance);
        const progress = initialDistance ? 1 - Math.min(1, distance / initialDistance) : 1;
        const arc = Math.sin(Math.PI * progress);
        deltaYaw += this.yawArc * arc;
        deltaPitch += this.pitchArc * arc;
        const elapsedSeconds = elapsedMs / 1000;
        const yaw = this.springStep(deltaYaw, this.yawVelocity, elapsedSeconds, frequency);
        const pitch = this.springStep(deltaPitch, this.pitchVelocity, elapsedSeconds, frequency);
        this.yawVelocity = yaw.velocity;
        this.pitchVelocity = pitch.velocity;
        const gcd = this.gcd > 0 ? this.gcd : RotationGCD.calculateGCD() || 0.15;
        const rawYawStep = yaw.step + this.yawRemainder;
        const rawPitchStep = pitch.step + this.pitchRemainder;
        const yawStep = Math.round(rawYawStep / gcd) * gcd;
        const pitchStep = Math.round(rawPitchStep / gcd) * gcd;
        this.yawRemainder = rawYawStep - yawStep;
        this.pitchRemainder = rawPitchStep - pitchStep;
        this.applyRotation(player, currentYaw + yawStep, currentPitch + pitchStep);
    }

    applyRotation(player, yaw, pitch) {
        const nextPitch = RotationGCD.clampPitch(pitch);
        player.setYRot(yaw);
        player.setXRot(nextPitch);
        player.yRotO = yaw;
        player.xRotO = nextPitch;
    }

    springStep(delta, velocity, elapsedSeconds, frequency) {
        const decay = Math.exp(-frequency * elapsedSeconds);
        const change = -delta;
        const temp = (velocity + frequency * change) * elapsedSeconds;
        return {
            step: delta + (change + temp) * decay,
            velocity: (velocity - frequency * temp) * decay,
        };
    }

    refreshTrackedTarget(player, vector) {
        const angles = this.getTargetAngles(player, vector);
        if (!angles) return false;
        this.targetYaw = RotationGCD.aimModulo360(player.getYRot(), angles.yaw);
        this.targetPitch = RotationGCD.clampPitch(angles.pitch);
        return true;
    }

    getTargetAngles(player, vector) {
        const target = Utils.convertToVector(vector);
        if (!target) return false;
        const eyes = player.getEyePosition();
        const dx = target.x() - player.getX();
        const dy = target.y() - eyes.y();
        const dz = target.z() - player.getZ();
        const horizontalDistance = Math.hypot(dx, dz);
        return {
            yaw: horizontalDistance <= 0.0001 ? player.getYRot() : Math.atan2(-dx, dz) * (180 / Math.PI),
            pitch: Math.atan2(-dy, horizontalDistance) * (180 / Math.PI),
        };
    }
}

export const MiningRotations = new MiningRotationController();

const ORTHO_FACE_AXES = {
    x: ['y', 'z'],
    y: ['x', 'z'],
    z: ['x', 'y'],
};
const FACE_FALLBACK_SAMPLES = [0, 0, 0.35, 0, -0.35, 0, 0, 0.35, 0, -0.35, 0.35, 0.35, -0.35, -0.35];
const VISIBILITY_OFFSETS = [0, 0, 0, 0.18, 0, 0, -0.18, 0, 0, 0, 0, 0.18, 0, 0, -0.18];
const VISIBILITY_SAMPLE_COUNT = VISIBILITY_OFFSETS.length / 3;
const AIM_POINT_FACE_INSET = 0.48;
const AIM_POINT_EDGE_MAG = 0.4;
const AIM_POINT_MID_CAP = 0.3;
const AIM_POINT_LO = 0.02;
const AIM_POINT_HI = 0.98;
const AIM_RETRY_MIN_DELTA_SQ = 0.0025;
const VISIBLE_RAY_OFFSETS = [0.15, 0.5, 0.85];
const TARGET_MODES = {
    REACHABLE: 'reachable',
    APPROACH: 'approach',
};
const COST_DISTANCE_WEIGHT = 8;
const COST_TURN_WEIGHT = 0.4;
const COST_TURN_EXTRA_AFTER = 40;
const COST_TURN_EXTRA_WEIGHT = 0.35;
const COST_PITCH_WEIGHT = 0.25;
const VEIN_ADJACENT_BONUS = 16;
const VEIN_NEAR_BONUS = 8;
const TARGET_BLACKLIST_MS = 4000;
const STUCK_NO_LOOK_TICKS = 25;
const STUCK_FAIL_SKIP = 2;
const MINE_TIMEOUT_TICKS = 8;
const REACHABLE_EVAL_BUDGET = 24;
const REACHABLE_VISIBLE_BUDGET = 10;
const REACHABLE_VISIBLE_STOP = 3;

export const MINING_ENGINE_PRESETS = {
    'Ultra Legit': {
        rotationSpeed: 0.28,
        fov: 90,
        minimumVisibleRays: 3,
        costTurnWeight: 0.75,
        costTurnExtraAfter: 22,
        costTurnExtraWeight: 0.6,
        costPitchWeight: 0.5,
        mineTimeoutTicks: 14,
        stuckNoLookTicks: 40,
        stuckFailSkip: 3,
        targetBlacklistMs: 6000,
        approachScanReach: 6,
        approachTargetBudget: 6,
        reachableCandidateEvaluationBudget: 16,
        reachableVisibleTargetBudget: 6,
        reachableVisibleStopCount: 2,
        costDistanceWeight: 11,
        veinAdjacentBonus: 22,
        veinNearBonus: 12,
    },
    Legit: {
        rotationSpeed: 0.48,
        fov: 120,
        minimumVisibleRays: 0,
        costTurnWeight: 0.4,
        costTurnExtraAfter: 40,
        costTurnExtraWeight: 0.35,
        costPitchWeight: 0.25,
        mineTimeoutTicks: 8,
        stuckNoLookTicks: 25,
        stuckFailSkip: 2,
        targetBlacklistMs: 4000,
        approachScanReach: 8,
        approachTargetBudget: 10,
        reachableCandidateEvaluationBudget: 24,
        reachableVisibleTargetBudget: 10,
        reachableVisibleStopCount: 3,
        costDistanceWeight: 8,
        veinAdjacentBonus: 16,
        veinNearBonus: 8,
    },
    'Non Legit': {
        rotationSpeed: 0.85,
        fov: 360,
        minimumVisibleRays: 0,
        costTurnWeight: 0.12,
        costTurnExtraAfter: 90,
        costTurnExtraWeight: 0.08,
        costPitchWeight: 0.06,
        mineTimeoutTicks: 4,
        stuckNoLookTicks: 12,
        stuckFailSkip: 1,
        targetBlacklistMs: 1500,
        approachScanReach: 10,
        approachTargetBudget: 20,
        reachableCandidateEvaluationBudget: 48,
        reachableVisibleTargetBudget: 16,
        reachableVisibleStopCount: 6,
        costDistanceWeight: 4,
        veinAdjacentBonus: 6,
        veinNearBonus: 3,
    },
};

class MiningEngineService {
    constructor() {
        this.mineReach = 4.5;
        this.faceReach = 4.5;
        this.bfsPad = Math.hypot(1, 1, 1) * 0.5;
        this.approachScanReach = 8;
        this.approachTargetBudget = 10;
        this.reachableCandidateEvaluationBudget = REACHABLE_EVAL_BUDGET;
        this.reachableVisibleTargetBudget = REACHABLE_VISIBLE_BUDGET;
        this.reachableVisibleStopCount = REACHABLE_VISIBLE_STOP;
        this.targetBlacklist = new Map();
        this.lastBlockPos = null;
        this.PRIORITIZE_TITANIUM = true;
        this.PRIORITIZE_GRAY_MITHRIL = false;
        this.costDistanceWeight = COST_DISTANCE_WEIGHT;
        this.costTurnWeight = COST_TURN_WEIGHT;
        this.costTurnExtraAfter = COST_TURN_EXTRA_AFTER;
        this.costTurnExtraWeight = COST_TURN_EXTRA_WEIGHT;
        this.costPitchWeight = COST_PITCH_WEIGHT;
        this.veinAdjacentBonus = VEIN_ADJACENT_BONUS;
        this.veinNearBonus = VEIN_NEAR_BONUS;
        this.targetBlacklistMs = TARGET_BLACKLIST_MS;
        this.stuckNoLookTicks = STUCK_NO_LOOK_TICKS;
        this.stuckFailSkip = STUCK_FAIL_SKIP;
        this.initCosts();

        this.activeCosts = this.mithrilCosts;
        this.sessionOwner = null;
        this.state = 'IDLE';
        this.foundLocations = [];
        this.currentTarget = null;
        this.nextTarget = null;
        this.scanning = false;
        this.checkFov = true;
        this.fov = 120;
        this.minimumVisibleRays = 0;
        this.tickGliding = true;
        this.lagCompensation = 1;
        this.rotationSpeed = 0.48;
        this.sneakWhileMining = true;
        this.drillSlot = null;
        this.clickMode = 'hold';
        this.mineTimeoutTicks = MINE_TIMEOUT_TICKS;
        this.tickCount = 0;
        this.mineTickCount = 0;
        this.totalTicks = 0;
        this.targetFailCount = 0;
        this.clickReleaseTicks = 0;
        this.clickWaitTicks = 0;
        this.lookTicks = 0;

        register('tick', () => this.tick());
        register('worldUnload', () => this.endSession());
        register('gameUnload', () => this.endSession());
    }

    get isActive() {
        return !!this.sessionOwner && this.state !== 'IDLE';
    }

    get isScanning() {
        return this.scanning;
    }

    initCosts() {
        this.updateMithrilCosts();

        this.gemstoneCosts = {
            'minecraft:orange_stained_glass': 4,
            'minecraft:orange_stained_glass_pane': 4,
            'minecraft:purple_stained_glass': 4,
            'minecraft:purple_stained_glass_pane': 4,
            'minecraft:lime_stained_glass': 4,
            'minecraft:lime_stained_glass_pane': 4,
            'minecraft:magenta_stained_glass': 4,
            'minecraft:magenta_stained_glass_pane': 4,
            'minecraft:red_stained_glass': 4,
            'minecraft:red_stained_glass_pane': 4,
            'minecraft:light_blue_stained_glass': 4,
            'minecraft:light_blue_stained_glass_pane': 4,
            'minecraft:yellow_stained_glass': 4,
            'minecraft:yellow_stained_glass_pane': 4,
        };

        this.oreCosts = {
            'minecraft:coal_block': 4,
            'minecraft:quartz_block': 4,
            'minecraft:iron_block': 4,
            'minecraft:redstone_block': 4,
            'minecraft:gold_block': 4,
            'minecraft:diamond_block': 4,
            'minecraft:emerald_block': 4,
        };

        this.tunnelCosts = {
            'minecraft:packed_ice': 4,
            'minecraft:smooth_red_sandstone': 4,
            'minecraft:terracotta': 4,
            'minecraft:brown_terracotta': 4,
            'minecraft:clay': 4,
            'minecraft:infested_cobblestone': 4,
            'minecraft:blue_stained_glass': 4,
            'minecraft:blue_stained_glass_pane': 4,
            'minecraft:lime_stained_glass': 4,
            'minecraft:lime_stained_glass_pane': 4,
            'minecraft:green_stained_glass': 4,
            'minecraft:green_stained_glass_pane': 4,
            'minecraft:black_stained_glass': 4,
            'minecraft:black_stained_glass_pane': 4,
            'minecraft:brown_stained_glass': 4,
            'minecraft:brown_stained_glass_pane': 4,
        };

        this.tunnelOreCosts = {
            glacite: {
                'minecraft:packed_ice': 4,
            },
            umber: {
                'minecraft:smooth_red_sandstone': 4,
                'minecraft:terracotta': 4,
                'minecraft:brown_terracotta': 4,
            },
            tungsten: {
                'minecraft:clay': 4,
                'minecraft:infested_cobblestone': 4,
            },
            aquamarine: {
                'minecraft:blue_stained_glass': 4,
                'minecraft:blue_stained_glass_pane': 4,
            },
            peridot: {
                'minecraft:green_stained_glass': 4,
                'minecraft:green_stained_glass_pane': 4,
            },
            onyx: {
                'minecraft:black_stained_glass': 4,
                'minecraft:black_stained_glass_pane': 4,
            },
            citrine: {
                'minecraft:brown_stained_glass': 4,
                'minecraft:brown_stained_glass_pane': 4,
            },
        };
    }

    updateMithrilCosts() {
        const lightBlueCost = this.PRIORITIZE_GRAY_MITHRIL ? 20 : 3;
        const prismarineCost = 10;
        const grayCost = this.PRIORITIZE_GRAY_MITHRIL ? 1 : 20;

        this.mithrilCosts = {
            'minecraft:polished_diorite': this.PRIORITIZE_TITANIUM ? 1 : 30,
            'minecraft:light_blue_wool': lightBlueCost,
            'minecraft:prismarine': prismarineCost,
            'minecraft:prismarine_bricks': prismarineCost,
            'minecraft:dark_prismarine': prismarineCost,
            'minecraft:gray_wool': grayCost,
            'minecraft:cyan_terracotta': grayCost,
        };
    }

    getEnabledOptionName(value, fallback = null) {
        if (Array.isArray(value)) {
            const selected = value.find((option) => option?.enabled)?.name;
            return selected ?? fallback;
        }
        if (typeof value === 'string') return value;
        return fallback;
    }

    isAirOrBedrock(blockName = '') {
        return !blockName || blockName.endsWith(':air') || blockName.endsWith('_air') || blockName.includes('bedrock');
    }

    isSolidBlockAt(x, y, z) {
        const block = World.getBlockAt(x, y, z);
        if (!block?.type || block.type.getID() === 0) return false;
        if (block.type.getRegistryName?.() === 'minecraft:snow') return false;

        const world = World.getWorld();
        if (!world) return false;

        const blockPos = new BP(Math.floor(x), Math.floor(y), Math.floor(z));
        return !world.getBlockState(blockPos).getCollisionShape(world, blockPos).isEmpty();
    }

    insertSortedCandidate(list, candidate, maxCount, scoreKey = 'cost') {
        if (!Array.isArray(list) || maxCount <= 0) return;

        const score = candidate?.[scoreKey];
        if (!Number.isFinite(score)) return;

        let insertAt = list.length;
        while (insertAt > 0 && list[insertAt - 1][scoreKey] > score) insertAt--;
        if (insertAt >= maxCount) return;

        list.splice(insertAt, 0, candidate);
        if (list.length > maxCount) list.pop();
    }

    collectScanTargets(targetCosts, eyePos, lookVec, scanReach, excludedBlock = null, collectReachableCandidates = true, collectApproachTargets = false) {
        const reachableCandidateReach = this.mineReach + this.bfsPad;
        const reachableCandidateReachSq = reachableCandidateReach * reachableCandidateReach;
        const approachReachSq = this.approachScanReach * this.approachScanReach;
        const approachTargets = [];

        const reach = scanReach + this.bfsPad;
        const minX = Math.floor(eyePos.x() - reach) - 1;
        const minY = Math.floor(eyePos.y() - reach) - 1;
        const minZ = Math.floor(eyePos.z() - reach) - 1;
        const maxX = Math.floor(eyePos.x() + reach) + 1;
        const maxY = Math.floor(eyePos.y() + reach) + 1;
        const maxZ = Math.floor(eyePos.z() + reach) + 1;

        const blockTypes = Object.keys(targetCosts).map((name) => new BlockType(name));
        const blocks = World.getBlocksInBox(minX, minY, minZ, maxX, maxY, maxZ, blockTypes);

        const eyeX = eyePos.x();
        const eyeY = eyePos.y();
        const eyeZ = eyePos.z();
        const hasLookVec = !!lookVec;
        const lookX = hasLookVec ? lookVec.x() : 0;
        const lookY = hasLookVec ? lookVec.y() : 0;
        const lookZ = hasLookVec ? lookVec.z() : 0;
        const scanReachSq = reach * reach;

        const reachableCandidates = [];

        for (const block of blocks) {
            const x = block.x;
            const y = block.y;
            const z = block.z;

            if (excludedBlock && x === excludedBlock.x && y === excludedBlock.y && z === excludedBlock.z) continue;
            if (this.isTargetBlacklisted(x, y, z)) continue;

            const blockName = block.type.getRegistryName();
            const targetCost = blockName ? targetCosts[blockName] : undefined;
            if (targetCost === undefined || targetCost === null) continue;

            const dx = x + 0.5 - eyeX;
            const dy = y + 0.5 - eyeY;
            const dz = z + 0.5 - eyeZ;
            const distToCenterSq = dx * dx + dy * dy + dz * dz;

            if (distToCenterSq > scanReachSq) continue;

            if (collectReachableCandidates && distToCenterSq <= reachableCandidateReachSq) {
                const distToCenter = Math.sqrt(distToCenterSq);
                const dotToCenter = hasLookVec && distToCenter > 0 ? (dx * lookX + dy * lookY + dz * lookZ) / distToCenter : 1;
                reachableCandidates.push({
                    x,
                    y,
                    z,
                    cheapCost: this.calculateBlockCost(targetCost, distToCenter, dotToCenter, { x, y, z }),
                    blockName,
                    targetCost,
                });
            }

            if (collectApproachTargets && distToCenterSq <= approachReachSq) {
                const distToCenter = Math.sqrt(distToCenterSq);
                this.insertSortedCandidate(
                    approachTargets,
                    { x, y, z, cost: this.calculateApproachCost(targetCost, distToCenter), blockName, dist: distToCenter, targetMode: TARGET_MODES.APPROACH },
                    this.approachTargetBudget
                );
            }
        }

        return { reachableCandidates, approachTargets };
    }

    evaluateReachableCandidates(candidates, eyePos, lookVec, maxReachSq, checkFov = this.checkFov, minVisibleRays = this.minimumVisibleRays) {
        if (!candidates?.length) return [];

        const sortedCandidates = candidates.slice().sort((a, b) => a.cheapCost - b.cheapCost);
        const visibleTargets = [];
        let evaluatedCount = 0;

        for (const candidate of sortedCandidates) {
            if (
                evaluatedCount >= this.reachableCandidateEvaluationBudget &&
                (visibleTargets.length >= this.reachableVisibleStopCount || evaluatedCount >= this.reachableCandidateEvaluationBudget * 3)
            ) {
                break;
            }

            evaluatedCount++;
            if (this.isTargetBlacklisted(candidate.x, candidate.y, candidate.z)) continue;

            const aimData = this.findVisibleAimPoint(candidate.x, candidate.y, candidate.z, eyePos, lookVec, maxReachSq, checkFov);
            if (!aimData || !this.hasMinimumVisibleRays(candidate, aimData, eyePos, minVisibleRays)) continue;

            const baseCost = this.calculateBlockCost(candidate.targetCost, aimData.dist, aimData.dot, {
                x: candidate.x,
                y: candidate.y,
                z: candidate.z,
                aimX: aimData.x,
                aimY: aimData.y,
                aimZ: aimData.z,
            });
            const visibilityStability = this.calculateVisibilityStability(candidate.x, candidate.y, candidate.z, eyePos, maxReachSq, 1);
            const cost = baseCost + (1 - visibilityStability) * 18;

            this.insertSortedCandidate(
                visibleTargets,
                {
                    x: candidate.x,
                    y: candidate.y,
                    z: candidate.z,
                    cost,
                    blockName: candidate.blockName,
                    aimX: aimData.x,
                    aimY: aimData.y,
                    aimZ: aimData.z,
                    visibilityStability,
                    targetMode: TARGET_MODES.REACHABLE,
                    clickMode: candidate.clickMode || 'hold',
                },
                this.reachableVisibleTargetBudget
            );
        }

        return visibleTargets;
    }

    calculateVisibilityStability(x, y, z, eyePos, maxReachSq, confirmedVisibleSamples = 0) {
        let visibleSamples = confirmedVisibleSamples;
        const eyeX = typeof eyePos?.x === 'function' ? eyePos.x() : eyePos?.x;
        const eyeY = typeof eyePos?.y === 'function' ? eyePos.y() : eyePos?.y;
        const eyeZ = typeof eyePos?.z === 'function' ? eyePos.z() : eyePos?.z;
        if (![eyeX, eyeY, eyeZ].every(Number.isFinite)) return visibleSamples / VISIBILITY_SAMPLE_COUNT;

        for (let i = confirmedVisibleSamples > 0 ? 3 : 0; i < VISIBILITY_OFFSETS.length; i += 3) {
            const sampleEye = new Vec3d(eyeX + VISIBILITY_OFFSETS[i], eyeY, eyeZ + VISIBILITY_OFFSETS[i + 2]);
            if (this.findVisibleAimPoint(x, y, z, sampleEye, null, maxReachSq, false)) visibleSamples++;
        }

        return visibleSamples / VISIBILITY_SAMPLE_COUNT;
    }

    hasMinimumVisibleRays(block, aim, eyePosition, minVisibleRays = this.minimumVisibleRays) {
        return minVisibleRays <= 0 || this.countVisibleRays(block, aim, eyePosition, minVisibleRays) >= minVisibleRays;
    }

    findVisibleAimPoint(x, y, z, eyePos, lookVec, maxReachSq, checkFov = true, excludedAim = null) {
        if (!eyePos || !Number.isFinite(maxReachSq) || maxReachSq <= 0) return null;

        const cx = x + 0.5,
            cy = y + 0.5,
            cz = z + 0.5;
        const eyeX = eyePos.x(),
            eyeY = eyePos.y(),
            eyeZ = eyePos.z();
        const rayEye = { x: eyeX, y: eyeY, z: eyeZ };
        const hasExcludedAim = excludedAim && [excludedAim.x, excludedAim.y, excludedAim.z].every(Number.isFinite);
        const isExcludedAim = (pointX, pointY, pointZ) =>
            hasExcludedAim && (pointX - excludedAim.x) ** 2 + (pointY - excludedAim.y) ** 2 + (pointZ - excludedAim.z) ** 2 < AIM_RETRY_MIN_DELTA_SQ;
        const vx = cx - eyeX,
            vy = cy - eyeY,
            vz = cz - eyeZ;
        const vLenSq = vx * vx + vy * vy + vz * vz;
        if (vLenSq === 0) return null;

        if (checkFov && lookVec) {
            const vLen = Math.sqrt(vLenSq);
            const dotToCenter = (vx * lookVec.x() + vy * lookVec.y() + vz * lookVec.z()) / vLen;
            if (dotToCenter < -0.05) return null;
        }

        const invX = vx === 0 ? Infinity : 1 / vx,
            invY = vy === 0 ? Infinity : 1 / vy,
            invZ = vz === 0 ? Infinity : 1 / vz;
        const tx1 = (x - eyeX) * invX,
            tx2 = (x + 1 - eyeX) * invX;
        const ty1 = (y - eyeY) * invY,
            ty2 = (y + 1 - eyeY) * invY;
        const tz1 = (z - eyeZ) * invZ,
            tz2 = (z + 1 - eyeZ) * invZ;

        const tminX = tx1 < tx2 ? tx1 : tx2;
        const tminY = ty1 < ty2 ? ty1 : ty2;
        const tminZ = tz1 < tz2 ? tz1 : tz2;

        let faceAxis = 'x';
        let tEntry = tminX;
        if (tminY > tEntry) {
            tEntry = tminY;
            faceAxis = 'y';
        }
        if (tminZ > tEntry) {
            tEntry = tminZ;
            faceAxis = 'z';
        }

        let s;
        if (faceAxis === 'x') {
            s = vx > 0 ? -1 : 1;
        } else if (faceAxis === 'y') {
            s = vy > 0 ? -1 : 1;
        } else {
            s = vz > 0 ? -1 : 1;
        }

        let resultX = 0;
        let resultY = 0;
        let resultZ = 0;
        let found = false;
        let axis = faceAxis;
        let pass = 0;

        while (!found && pass < 3) {
            if (pass === 1) axis = ORTHO_FACE_AXES[faceAxis][0];
            else if (pass === 2) axis = ORTHO_FACE_AXES[faceAxis][1];

            const isPrimaryAxis = pass === 0;
            const isX = axis === 'x';
            const isY = axis === 'y';
            let localS = s;
            if (!isPrimaryAxis) {
                if (isX) localS = eyeX >= cx ? 1 : -1;
                else if (isY) localS = eyeY >= cy ? 1 : -1;
                else localS = eyeZ >= cz ? 1 : -1;
            }

            if (isPrimaryAxis) {
                let uSource = isX ? eyeY : eyeX;
                let vSource = isY ? eyeZ : eyeY;
                let uBase = (isX ? y : x) + AIM_POINT_LO;
                let vBase = (isY ? z : y) + AIM_POINT_LO;
                let uLimit = (isX ? y : x) + AIM_POINT_HI;
                let vLimit = (isY ? z : y) + AIM_POINT_HI;

                let uRaw = uSource < uBase ? uBase : uSource;
                if (uRaw > uLimit) uRaw = uLimit;
                uRaw -= isX ? cy : cx;

                let vRaw = vSource < vBase ? vBase : vSource;
                if (vRaw > vLimit) vRaw = vLimit;
                vRaw -= isY ? cz : cy;

                let uMid = uRaw;
                if (uMid < -AIM_POINT_MID_CAP) uMid = -AIM_POINT_MID_CAP;
                else if (uMid > AIM_POINT_MID_CAP) uMid = AIM_POINT_MID_CAP;

                let vMid = vRaw;
                if (vMid < -AIM_POINT_MID_CAP) vMid = -AIM_POINT_MID_CAP;
                else if (vMid > AIM_POINT_MID_CAP) vMid = AIM_POINT_MID_CAP;

                const uEdge = uRaw >= 0 ? AIM_POINT_EDGE_MAG : -AIM_POINT_EDGE_MAG;
                const vEdge = vRaw >= 0 ? AIM_POINT_EDGE_MAG : -AIM_POINT_EDGE_MAG;

                for (let sampleIndex = 0; sampleIndex < 4 && !found; sampleIndex++) {
                    let u = 0;
                    let v = 0;
                    if (sampleIndex === 0) {
                        u = uMid;
                        v = vMid;
                    } else if (sampleIndex === 2) {
                        u = uEdge;
                    } else if (sampleIndex === 3) {
                        v = vEdge;
                    }
                    let fx;
                    let fy;
                    let fz;

                    if (isX) {
                        fx = cx + localS * AIM_POINT_FACE_INSET;
                        fy = cy + u;
                        fz = cz + v;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else if (isY) {
                        fx = cx + u;
                        fy = cy + localS * AIM_POINT_FACE_INSET;
                        fz = cz + v;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else {
                        fx = cx + u;
                        fy = cy + v;
                        fz = cz + localS * AIM_POINT_FACE_INSET;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                    }

                    if (
                        !isExcludedAim(fx, fy, fz) &&
                        Raytrace.isLineClear(eyeX, eyeY, eyeZ, fx, fy, fz, x, y, z) &&
                        visibilityChecker.testPointNative(x, y, z, [fx, fy, fz], rayEye)
                    ) {
                        resultX = fx;
                        resultY = fy;
                        resultZ = fz;
                        found = true;
                    }
                }
            } else {
                for (let sampleIndex = 0; sampleIndex < FACE_FALLBACK_SAMPLES.length && !found; sampleIndex += 2) {
                    const u = FACE_FALLBACK_SAMPLES[sampleIndex];
                    const v = FACE_FALLBACK_SAMPLES[sampleIndex + 1];
                    let fx;
                    let fy;
                    let fz;

                    if (isX) {
                        fx = cx + localS * AIM_POINT_FACE_INSET;
                        fy = cy + u;
                        fz = cz + v;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else if (isY) {
                        fy = cy + localS * AIM_POINT_FACE_INSET;
                        fx = cx + u;
                        fz = cz + v;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else {
                        fz = cz + localS * AIM_POINT_FACE_INSET;
                        fx = cx + u;
                        fy = cy + v;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                    }

                    if (
                        !isExcludedAim(fx, fy, fz) &&
                        Raytrace.isLineClear(eyeX, eyeY, eyeZ, fx, fy, fz, x, y, z) &&
                        visibilityChecker.testPointNative(x, y, z, [fx, fy, fz], rayEye)
                    ) {
                        resultX = fx;
                        resultY = fy;
                        resultZ = fz;
                        found = true;
                    }
                }
            }

            pass++;
        }

        if (!found) return null;

        const dX = resultX - eyeX,
            dY = resultY - eyeY,
            dZ = resultZ - eyeZ;
        const distSq = dX * dX + dY * dY + dZ * dZ;

        if (distSq > maxReachSq) return null;

        const dist = Math.sqrt(distSq);
        const dot = lookVec && dist > 0 ? (dX * lookVec.x() + dY * lookVec.y() + dZ * lookVec.z()) / dist : 1;

        return { x: resultX, y: resultY, z: resultZ, dist, dot };
    }

    calculateBlockCost(baseCost, distance, dotProduct, block = null) {
        const clampedDot = Math.max(-1, Math.min(1, Number.isFinite(dotProduct) ? dotProduct : 1));
        const turnDeg = Math.acos(clampedDot) * (180 / Math.PI);
        let cost =
            baseCost +
            distance * this.costDistanceWeight +
            turnDeg * this.costTurnWeight +
            Math.max(0, turnDeg - this.costTurnExtraAfter) * this.costTurnExtraWeight;
        if (block) {
            cost += Math.abs(this.getTargetPitchDelta(block)) * this.costPitchWeight;
            cost -= this.getVeinBonus(block.x, block.y, block.z);
        }
        return cost;
    }

    calculateApproachCost(baseCost, distance) {
        return baseCost + distance * this.costDistanceWeight;
    }

    getTargetPitchDelta(block) {
        const player = Player.getPlayer();
        if (!player || !block) return 0;

        const eyes = player.getEyePosition();
        const tx = Number.isFinite(block.aimX) ? block.aimX : block.x + 0.5;
        const ty = Number.isFinite(block.aimY) ? block.aimY : block.y + 0.5;
        const tz = Number.isFinite(block.aimZ) ? block.aimZ : block.z + 0.5;
        if (![tx, ty, tz].every(Number.isFinite)) return 0;

        const dy = ty - eyes.y();
        const horizontal = Math.hypot(tx - player.getX(), tz - player.getZ());
        const targetPitch = Math.atan2(-dy, horizontal) * (180 / Math.PI);
        return targetPitch - player.getXRot();
    }

    getVeinBonus(x, y, z) {
        const last = this.lastBlockPos;
        if (!last || ![x, y, z, last.x, last.y, last.z].every(Number.isFinite)) return 0;
        const chebyshev = Math.max(Math.abs(x - last.x), Math.abs(y - last.y), Math.abs(z - last.z));
        if (chebyshev <= 1) return this.veinAdjacentBonus;
        if (chebyshev === 2) return this.veinNearBonus;
        return 0;
    }

    targetKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    isTargetBlacklisted(x, y, z) {
        const key = this.targetKey(x, y, z);
        const expiresAt = this.targetBlacklist.get(key);
        if (!expiresAt) return false;
        if (Date.now() >= expiresAt) {
            this.targetBlacklist.delete(key);
            return false;
        }

        const blockName = World.getBlockAt(x, y, z)?.type?.getRegistryName() || '';
        if (this.isAirOrBedrock(blockName)) {
            this.targetBlacklist.delete(key);
            return false;
        }
        return true;
    }

    blacklistTarget(target, durationMs) {
        if (!Number.isFinite(durationMs)) durationMs = this.targetBlacklistMs;
        if (!target || ![target.x, target.y, target.z].every(Number.isFinite)) return;
        this.targetBlacklist.set(this.targetKey(target.x, target.y, target.z), Date.now() + durationMs);
    }

    countVisibleRays(block, aim, eyePosition, stopAt = Infinity) {
        const eye = { x: eyePosition.x(), y: eyePosition.y(), z: eyePosition.z() };
        const origin = [block.x, block.y, block.z];
        const local = [aim.x - block.x, aim.y - block.y, aim.z - block.z];
        const edgeDistances = local.map((value) => Math.min(value, 1 - value));
        const faceAxis = edgeDistances.indexOf(Math.min(...edgeDistances));
        const faceOffset = local[faceAxis] < 0.5 ? AIM_POINT_LO : AIM_POINT_HI;
        const sampleAxes = [0, 1, 2].filter((axis) => axis !== faceAxis);
        let visibleRays = 0;

        for (const firstOffset of VISIBLE_RAY_OFFSETS) {
            for (const secondOffset of VISIBLE_RAY_OFFSETS) {
                const point = [block.x + 0.5, block.y + 0.5, block.z + 0.5];
                point[faceAxis] = origin[faceAxis] + faceOffset;
                point[sampleAxes[0]] = origin[sampleAxes[0]] + firstOffset;
                point[sampleAxes[1]] = origin[sampleAxes[1]] + secondOffset;
                if (visibilityChecker.testPointCustom(block.x, block.y, block.z, point, eye) && ++visibleRays >= stopAt) return visibleRays;
            }
        }
        return visibleRays;
    }

    getCosts(type) {
        const name = String(type || '').toLowerCase();
        if (name === 'mithril') return this.mithrilCosts;
        if (name === 'gemstone') return this.gemstoneCosts;
        if (name === 'ore') return this.oreCosts;
        if (name === 'tunnel') return this.tunnelCosts;
        return null;
    }

    getTunnelCostsForOres(ores) {
        const oreList = Array.isArray(ores) ? ores : [ores];
        const mergedCosts = {};
        oreList.forEach((ore) => {
            const oreCosts = this.tunnelOreCosts?.[String(ore).toLowerCase()];
            if (!oreCosts) return;
            Object.assign(mergedCosts, oreCosts);
        });
        return Object.keys(mergedCosts).length ? mergedCosts : this.tunnelCosts;
    }

    setPrioritizeTitanium(value) {
        this.PRIORITIZE_TITANIUM = !!value;
        this.updateMithrilCosts();
        if (this.activeCosts === this.mithrilCosts) this.activeCosts = this.mithrilCosts;
        return this.mithrilCosts;
    }

    setPrioritizeGrayMithril(value) {
        this.PRIORITIZE_GRAY_MITHRIL = !!value;
        this.updateMithrilCosts();
        if (this.activeCosts === this.mithrilCosts) this.activeCosts = this.mithrilCosts;
        return this.mithrilCosts;
    }

    getDrillSlot() {
        if (Number.isFinite(this.drillSlot)) return this.drillSlot;
        return MiningUtils.getDrills()?.drill?.slot ?? 0;
    }

    configure(config = {}) {
        if (config.costs) this.activeCosts = config.costs;
        if (Number.isFinite(config.drillSlot)) this.drillSlot = Math.round(config.drillSlot);
        if (config.checkFov !== undefined) this.checkFov = !!config.checkFov;
        if (Number.isFinite(config.fov)) {
            this.fov = config.fov;
            this.checkFov = config.fov < 360;
        }
        if (Number.isFinite(config.minimumVisibleRays)) this.minimumVisibleRays = Math.max(0, Math.round(config.minimumVisibleRays));
        if (config.tickGliding !== undefined) this.tickGliding = !!config.tickGliding;
        if (Number.isFinite(config.lagCompensation)) this.lagCompensation = config.lagCompensation;
        if (Number.isFinite(config.rotationSpeed)) this.rotationSpeed = config.rotationSpeed;
        if (config.sneakWhileMining !== undefined) this.sneakWhileMining = !!config.sneakWhileMining;
        if (config.clickMode) this.clickMode = config.clickMode;
        if (Number.isFinite(config.mineTimeoutTicks)) this.mineTimeoutTicks = Math.round(config.mineTimeoutTicks);
        if (Number.isFinite(config.mineReach)) {
            this.mineReach = config.mineReach;
            this.faceReach = config.mineReach;
        }
        if (Number.isFinite(config.approachScanReach)) this.approachScanReach = config.approachScanReach;
        if (Number.isFinite(config.approachTargetBudget)) this.approachTargetBudget = Math.round(config.approachTargetBudget);
        if (Number.isFinite(config.reachableCandidateEvaluationBudget)) this.reachableCandidateEvaluationBudget = Math.round(config.reachableCandidateEvaluationBudget);
        if (Number.isFinite(config.reachableVisibleTargetBudget)) this.reachableVisibleTargetBudget = Math.round(config.reachableVisibleTargetBudget);
        if (Number.isFinite(config.reachableVisibleStopCount)) this.reachableVisibleStopCount = Math.round(config.reachableVisibleStopCount);
        if (Number.isFinite(config.costDistanceWeight)) this.costDistanceWeight = config.costDistanceWeight;
        if (Number.isFinite(config.costTurnWeight)) this.costTurnWeight = config.costTurnWeight;
        if (Number.isFinite(config.costTurnExtraAfter)) this.costTurnExtraAfter = config.costTurnExtraAfter;
        if (Number.isFinite(config.costTurnExtraWeight)) this.costTurnExtraWeight = config.costTurnExtraWeight;
        if (Number.isFinite(config.costPitchWeight)) this.costPitchWeight = config.costPitchWeight;
        if (Number.isFinite(config.veinAdjacentBonus)) this.veinAdjacentBonus = config.veinAdjacentBonus;
        if (Number.isFinite(config.veinNearBonus)) this.veinNearBonus = config.veinNearBonus;
        if (Number.isFinite(config.targetBlacklistMs)) this.targetBlacklistMs = Math.round(config.targetBlacklistMs);
        if (Number.isFinite(config.stuckNoLookTicks)) this.stuckNoLookTicks = Math.round(config.stuckNoLookTicks);
        if (Number.isFinite(config.stuckFailSkip)) this.stuckFailSkip = Math.round(config.stuckFailSkip);
        return this;
    }

    applyPreset(name) {
        const preset = MINING_ENGINE_PRESETS[name];
        if (!preset) return false;
        this.configure(preset);
        return true;
    }

    start(config = {}) {
        this.configure(config);
        const owner = config.owner || this.sessionOwner || 'default';
        if (this.sessionOwner && this.sessionOwner !== owner) this.endSession();

        this.sessionOwner = owner;
        this.state = 'SCANNING';
        this.resetMineCounters();
        this.targetFailCount = 0;
        this.clickReleaseTicks = 0;
        this.clickWaitTicks = 0;
        if (!this.activeCosts) this.activeCosts = this.mithrilCosts;
        if (!Number.isFinite(this.drillSlot)) this.drillSlot = MiningUtils.getDrills()?.drill?.slot ?? null;
        if (!config.reuseScan || !this.foundLocations.length) this.scanAndSelect();
        else this.adoptScanResults(this.foundLocations);
        this.state = this.currentTarget ? 'ROTATING' : 'SCANNING';
        return this.isActive;
    }

    stop(owner) {
        if (owner && this.sessionOwner && owner !== this.sessionOwner) return false;
        this.endSession();
        return true;
    }

    pause(owner) {
        if (!this.isActive) return false;
        if (owner && owner !== this.sessionOwner) return false;
        this.state = 'PAUSED';
        this.releaseMiningControls();
        MiningRotations.stop();
        return true;
    }

    resume(owner) {
        if (this.state !== 'PAUSED') return false;
        if (owner && owner !== this.sessionOwner) return false;
        this.state = this.currentTarget ? 'ROTATING' : 'SCANNING';
        return true;
    }

    scanOnce(config = {}) {
        this.configure(config);
        if (!this.activeCosts) this.activeCosts = this.mithrilCosts;
        return this.scanAndSelect(config.excludedBlock || null);
    }

    setManualTargets(targets, config = {}) {
        this.configure(config);
        const owner = config.owner || this.sessionOwner;
        if (owner) {
            if (this.sessionOwner && this.sessionOwner !== owner) this.endSession();
            this.sessionOwner = owner;
        }

        const player = Player.getPlayer();
        const eyePos = player?.getEyePosition?.();
        const lookVec = Player.asPlayerMP()?.getLookVector?.();
        const maxReachSq = this.mineReach * this.mineReach;
        const locations = (Array.isArray(targets) ? targets : [])
            .map((loc) => {
                const hit = eyePos ? this.findVisibleAimPoint(loc.x, loc.y, loc.z, eyePos, lookVec, maxReachSq, false) : null;
                return {
                    x: loc.x,
                    y: loc.y,
                    z: loc.z,
                    aimX: hit?.x,
                    aimY: hit?.y,
                    aimZ: hit?.z,
                    dist: hit?.dist,
                    clickMode: loc.clickMode || (loc.oneTap ? 'left' : loc.rOneTap ? 'right' : 'hold'),
                    targetMode: TARGET_MODES.REACHABLE,
                };
            })
            .filter((loc) => [loc.x, loc.y, loc.z].every(Number.isFinite));

        this.adoptScanResults(locations);
        if (this.sessionOwner) this.state = this.currentTarget ? 'ROTATING' : 'SCANNING';
        return locations;
    }

    hasWork() {
        return !!(this.isScanning || this.currentTarget || this.foundLocations.length);
    }

    scanAndSelect(excludedBlock = null) {
        const player = Player.getPlayer();
        const eyePos = player?.getEyePosition?.();
        if (!eyePos || !this.activeCosts) {
            this.adoptScanResults([]);
            return [];
        }

        this.scanning = true;
        const lookVec = Player.asPlayerMP()?.getLookVector?.();
        const scanned = this.collectScanTargets(this.activeCosts, eyePos, lookVec, this.mineReach, excludedBlock, true, false);
        const found = this.evaluateReachableCandidates(
            scanned.reachableCandidates,
            eyePos,
            lookVec,
            this.mineReach * this.mineReach,
            this.checkFov,
            this.minimumVisibleRays
        );
        this.scanning = false;
        this.adoptScanResults(found);
        return found;
    }

    adoptScanResults(found) {
        this.foundLocations = Array.isArray(found) ? found : [];
        this.currentTarget = this.foundLocations[0] || null;
        this.nextTarget = this.pickPromisedNext(this.currentTarget, this.foundLocations);
        return this.foundLocations;
    }

    pickPromisedNext(current, locations = this.foundLocations) {
        if (!current || !locations?.length) return null;
        const player = Player.getPlayer();
        const eyePos = player?.getEyePosition?.();
        if (!eyePos) return locations.find((loc) => loc !== current && (loc.x !== current.x || loc.y !== current.y || loc.z !== current.z)) || null;

        const aimX = Number.isFinite(current.aimX) ? current.aimX : current.x + 0.5;
        const aimY = Number.isFinite(current.aimY) ? current.aimY : current.y + 0.5;
        const aimZ = Number.isFinite(current.aimZ) ? current.aimZ : current.z + 0.5;
        const lookX = aimX - eyePos.x();
        const lookY = aimY - eyePos.y();
        const lookZ = aimZ - eyePos.z();
        const lookLen = Math.hypot(lookX, lookY, lookZ);
        let best = null;
        let bestCost = Infinity;

        for (const loc of locations) {
            if (loc.x === current.x && loc.y === current.y && loc.z === current.z) continue;
            if (this.isGone(loc)) continue;
            const dx = (Number.isFinite(loc.aimX) ? loc.aimX : loc.x + 0.5) - eyePos.x();
            const dy = (Number.isFinite(loc.aimY) ? loc.aimY : loc.y + 0.5) - eyePos.y();
            const dz = (Number.isFinite(loc.aimZ) ? loc.aimZ : loc.z + 0.5) - eyePos.z();
            const dist = Math.hypot(dx, dy, dz);
            if (!dist) continue;
            const dot = lookLen ? (dx * lookX + dy * lookY + dz * lookZ) / (dist * lookLen) : 1;
            const baseCost = loc.cost ?? this.activeCosts?.[loc.blockName] ?? 5;
            const cost = this.calculateBlockCost(baseCost, dist, dot, loc);
            if (cost < bestCost) {
                bestCost = cost;
                best = loc;
            }
        }
        return best;
    }

    tick() {
        if (!this.sessionOwner || this.state === 'IDLE' || this.state === 'PAUSED') return;
        if (!Player.getPlayer() || Client.isInGui()) {
            this.releaseMiningControls();
            MiningRotations.stop();
            return;
        }

        if (this.ensureDrillEquipped()) return;
        this.tickCount++;

        if (!this.currentTarget || this.isGone(this.currentTarget)) {
            this.finishCurrentTarget();
            this.scanAndSelect(this.lastBlockPos);
            if (!this.currentTarget) {
                this.releaseMiningControls();
                MiningRotations.stop();
                this.state = 'SCANNING';
                return;
            }
            this.state = 'ROTATING';
            this.resetMineCounters();
        }

        if (!this.refreshCurrentAim()) {
            if (this.recoverIfStuck()) return;
            this.skipCurrentTarget();
            return;
        }

        const aim = this.getAimVector(this.currentTarget);
        MiningRotations.trackVector(aim, this.rotationSpeed);
        const looking = this.isCrosshairOnBlock(this.currentTarget);
        if (looking) this.lookTicks++;

        if (this.clickReleaseTicks > 0) {
            Client.setKey('leftclick', false);
            this.clickReleaseTicks--;
            return;
        }

        this.setSneak(this.sneakWhileMining);
        const clickMode = this.currentTarget.clickMode || this.clickMode || 'hold';
        if (clickMode === 'left' || clickMode === 'right') {
            this.handleInstantClick(clickMode, looking);
            return;
        }

        Client.setKey('leftclick', looking);
        if (looking) this.mineTickCount++;

        const miningSpeed = MiningUtils.getMiningSpeed() || 1;
        this.totalTicks = (MiningUtils.getMineTime(this.currentTarget, miningSpeed, false) || 20) + this.glideDelay();
        if (this.recoverIfStuck()) return;

        if (this.tickGliding && looking && this.mineTickCount >= this.totalTicks) {
            this.finishCurrentTarget(true);
            this.advanceToPromisedOrScan();
        }
    }

    handleInstantClick(clickMode, looking) {
        if (this.clickWaitTicks > 0) {
            this.clickWaitTicks--;
            if (this.clickWaitTicks <= 0) this.advanceToPromisedOrScan();
            return;
        }
        if (!looking) {
            if (this.recoverIfStuck()) return;
            Client.setKey('leftclick', false);
            return;
        }
        Client.setKey('leftclick', false);
        if (clickMode === 'right') Client.rightClick();
        else Client.leftClick();
        this.clickWaitTicks = 2;
    }

    refreshCurrentAim(excludedAim = null) {
        const target = this.currentTarget;
        const eyePos = Player.getPlayer()?.getEyePosition?.();
        if (!target || !eyePos) return false;

        if (!excludedAim && this.isAimVisible(target, eyePos)) {
            const dx = target.aimX - eyePos.x();
            const dy = target.aimY - eyePos.y();
            const dz = target.aimZ - eyePos.z();
            target.dist = Math.hypot(dx, dy, dz);
            return true;
        }

        const lookVec = Player.asPlayerMP()?.getLookVector?.();
        const hit = this.findVisibleAimPoint(
            target.x,
            target.y,
            target.z,
            eyePos,
            lookVec,
            this.faceReach * this.faceReach,
            false,
            excludedAim
        );
        if (!hit || !this.hasMinimumVisibleRays(target, hit, eyePos)) return false;
        target.aimX = hit.x;
        target.aimY = hit.y;
        target.aimZ = hit.z;
        target.dist = hit.dist;
        return true;
    }

    isAimVisible(target, eyePos) {
        if (!target || ![target.aimX, target.aimY, target.aimZ].every(Number.isFinite)) return false;
        const dx = target.aimX - eyePos.x();
        const dy = target.aimY - eyePos.y();
        const dz = target.aimZ - eyePos.z();
        if (dx * dx + dy * dy + dz * dz > this.faceReach * this.faceReach) return false;
        return visibilityChecker.testPointNative(target.x, target.y, target.z, [target.aimX, target.aimY, target.aimZ], {
            x: eyePos.x(),
            y: eyePos.y(),
            z: eyePos.z(),
        });
    }

    recoverIfStuck() {
        if (!this.currentTarget) return false;
        const expected = Math.max(1, this.totalTicks || 20);
        const noLook = this.tickCount >= Math.max(this.stuckNoLookTicks, this.mineTimeoutTicks) && this.lookTicks <= 1;
        const noBreak = this.lookTicks > 1 && this.tickCount > Math.max(expected * 1.75, expected + 15, this.mineTimeoutTicks);
        const hardCap = this.tickCount > Math.max(expected * 3, 60);
        if (!noLook && !noBreak && !hardCap) return false;

        this.targetFailCount++;
        this.state = 'RETRYING';
        if (hardCap || this.targetFailCount >= this.stuckFailSkip) {
            this.skipCurrentTarget();
            return true;
        }
        this.retryCurrentAim();
        return true;
    }

    retryCurrentAim() {
        const failedAim = this.currentTarget ? { x: this.currentTarget.aimX, y: this.currentTarget.aimY, z: this.currentTarget.aimZ } : null;
        this.resetMineCounters();
        this.clickReleaseTicks = 1;
        Client.setKey('leftclick', false);
        if (this.currentTarget) this.currentTarget.aimX = this.currentTarget.aimY = this.currentTarget.aimZ = null;
        if (!this.refreshCurrentAim(failedAim)) this.skipCurrentTarget();
        else this.state = 'ROTATING';
    }

    skipCurrentTarget() {
        if (this.currentTarget) this.blacklistTarget(this.currentTarget);
        this.finishCurrentTarget(true);
        this.advanceToPromisedOrScan();
    }

    finishCurrentTarget(keepList = false) {
        if (this.currentTarget) {
            this.lastBlockPos = { x: this.currentTarget.x, y: this.currentTarget.y, z: this.currentTarget.z };
            if (!keepList) {
                this.foundLocations = this.foundLocations.filter(
                    (loc) => loc.x !== this.currentTarget.x || loc.y !== this.currentTarget.y || loc.z !== this.currentTarget.z
                );
            } else {
                this.foundLocations = this.foundLocations.filter(
                    (loc) => loc.x !== this.currentTarget.x || loc.y !== this.currentTarget.y || loc.z !== this.currentTarget.z
                );
            }
        }
        Client.setKey('leftclick', false);
        this.currentTarget = null;
        this.resetMineCounters();
        this.targetFailCount = 0;
    }

    advanceToPromisedOrScan() {
        const promised = this.nextTarget && !this.isGone(this.nextTarget) && !this.isTargetBlacklisted(this.nextTarget.x, this.nextTarget.y, this.nextTarget.z)
            ? this.nextTarget
            : null;
        if (promised) {
            this.currentTarget = promised;
            this.foundLocations = [promised, ...this.foundLocations.filter((loc) => loc !== promised)];
            this.nextTarget = this.pickPromisedNext(promised, this.foundLocations);
            this.state = 'ROTATING';
            this.resetMineCounters();
            this.refreshCurrentAim();
            return;
        }
        this.scanAndSelect(this.lastBlockPos);
        this.state = this.currentTarget ? 'ROTATING' : 'SCANNING';
        this.resetMineCounters();
    }

    isGone(block) {
        if (!block) return true;
        const blockName = World.getBlockAt(block.x, block.y, block.z)?.type?.getRegistryName?.() || '';
        return this.isAirOrBedrock(blockName);
    }

    isCrosshairOnBlock(block) {
        const pos = block && Raytrace.getLookingAt(5)?.getPos?.();
        return !!pos && pos.getX() === block.x && pos.getY() === block.y && pos.getZ() === block.z;
    }

    getAimVector(target) {
        if (!target) return null;
        return {
            x: Number.isFinite(target.aimX) ? target.aimX : target.x + 0.5,
            y: Number.isFinite(target.aimY) ? target.aimY : target.y + 0.5,
            z: Number.isFinite(target.aimZ) ? target.aimZ : target.z + 0.5,
        };
    }

    ensureDrillEquipped() {
        if (!Number.isFinite(this.drillSlot)) return false;
        if (Player.getHeldItemIndex() !== this.drillSlot) {
            Guis.setItemSlot(this.drillSlot);
            return true;
        }
        return false;
    }

    setSneak(shouldSneak) {
        if (Client.isKeyDown('shift') === shouldSneak) return;
        Client.setKey('shift', shouldSneak);
    }

    glideDelay() {
        return Math.max(0, 20 + this.lagCompensation - Math.trunc(ServerInfo.getTPS()));
    }

    resetMineCounters() {
        this.tickCount = 0;
        this.mineTickCount = 0;
        this.lookTicks = 0;
        this.totalTicks = 0;
    }

    releaseMiningControls() {
        Client.setKey('leftclick', false);
        if (this.sneakWhileMining) Client.setKey('shift', false);
    }

    endSession() {
        this.sessionOwner = null;
        this.state = 'IDLE';
        this.scanning = false;
        this.foundLocations = [];
        this.currentTarget = null;
        this.nextTarget = null;
        this.targetFailCount = 0;
        this.clickReleaseTicks = 0;
        this.clickWaitTicks = 0;
        this.resetMineCounters();
        this.releaseMiningControls();
        MiningRotations.stop();
    }
}

export const MiningEngine = new MiningEngineService();
export default MiningEngine;
