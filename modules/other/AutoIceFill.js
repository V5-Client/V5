import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';
import { Utils } from '../../utils/Utils';

const MAX_ATTACH_DIST_SQ = 9;
const MAX_Y_DIFF = 1.1;
const LOOK_AHEAD_WEIGHT = 0.2;
const ICE_DECAY = 0.91 * 0.98; // horizontal friction applied each tick while on ice
const SLIP_DISTANCE_COEFF = ICE_DECAY / (1 - ICE_DECAY); // geometric slip distance from current velocity
const MAX_SLIP_LEAD = 8;
const LATERAL_CANCEL_GAIN = 1.15;
const CENTER_CORRECTION_GAIN = 0.5;
const CENTER_CORRECTION_CLAMP = 0.6;
const BRAKE_MARGIN = 0.15;
const PARALLEL_BRAKE_SCALE = 0.3;
const START_BLOCK_ID = 554;

let IceFillSolver;
let IcePlatform;
let platformsField;
let solutionField;

class AutoIceFill extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Ice Fill',
            subcategory: 'Other',
            description: 'Requires Devonian Ice Fill solver enabled. Works on 400/500 speed; hold shift to slow down.',
            tooltip: '',
        });

        this.activePath = null;
        this.activeStart = null;
        this.pathIndex = 0;
        this.reflectionFailed = false;

        try {
            IceFillSolver = Java.type('com.github.synnerz.devonian.features.dungeons.solvers.IceFillSolver');
            IcePlatform = Java.type('com.github.synnerz.devonian.features.dungeons.solvers.IcePlatform');
            platformsField = IceFillSolver.class.getDeclaredField('platforms');
            platformsField.setAccessible(true);
            solutionField = IcePlatform.class.getDeclaredField('solution');
            solutionField.setAccessible(true);
        } catch (e) {
            this.reflectionFailed = true;
        }

        this.when(
            () => {
                return this.enabled && Utils.subArea().startsWith('The Catacombs');
            },
            'tick',
            () => this.onTick()
        );
    }

    onDisable() {
        this.stopFollowing(true);
    }

    onTick() {
        if (this.reflectionFailed) {
            Chat.message('&c[Auto Ice Fill] Failed to access Devonian solver. Please install devonian or disable auto ice fill.');
            return;
        }

        const solutions = this.readSolutions();
        const paths = solutions;

        if (this.activePath) {
            const updated = paths.find((path) => path.length > 0 && this.sameBlock(path[0], this.activeStart));
            if (updated) this.activePath = updated;
        }

        const playerXReal = Player.getX();
        const playerZReal = Player.getZ();
        const playerY = Player.getY();
        const playerX = Math.floor(playerXReal);
        const playerZ = Math.floor(playerZReal);

        if (!this.activePath && !this.attachNearestPath(paths, playerX, playerZ, playerY, false)) return;

        if (this.activePath) {
            const idx = this.indexOfBlock(this.activePath, playerX, playerZ);
            if (idx !== -1) {
                const desired = Math.min(this.activePath.length - 1, idx + 1);
                if (desired !== this.pathIndex) this.pathIndex = desired;
            }
        }

        let target = this.ensureValidTarget(paths, playerX, playerZ, playerY);
        if (!target) return;

        const playerBlockX = Math.floor(playerXReal);
        const playerBlockZ = Math.floor(playerZReal);

        const velX = Player.getMotionX();
        const velZ = Player.getMotionZ();

        if (this.isOnBlock(target, playerBlockX, playerBlockZ, playerY) && this.shouldAdvanceBlock(target, playerXReal, playerZReal, playerY, velX, velZ)) {
            this.pathIndex += 1;
            target = this.ensureValidTarget(paths, playerX, playerZ, playerY);
            if (!target) return;
        }

        const centerX = target.x + 0.5;
        const centerZ = target.z + 0.5;
        const distToTargetSq = (centerX - Player.getX()) * (centerX - Player.getX()) + (centerZ - Player.getZ()) * (centerZ - Player.getZ());
        const yDiff = Math.abs(Player.getY() - (target.y + 1));

        if (distToTargetSq > MAX_ATTACH_DIST_SQ || yDiff > MAX_Y_DIFF) {
            this.stopFollowing(true);
            return;
        }

        let leadX = centerX;
        let leadZ = centerZ;
        const nextIdx = this.pathIndex + 1;
        if (nextIdx < this.activePath.length) {
            const next = this.activePath[nextIdx];
            const nx = next.x + 0.5;
            const nz = next.z + 0.5;
            const dirX = nx - centerX;
            const dirZ = nz - centerZ;
            const mag = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
            leadX += (dirX / mag) * LOOK_AHEAD_WEIGHT;
            leadZ += (dirZ / mag) * LOOK_AHEAD_WEIGHT;
        }

        const toLeadX = leadX - Player.getX();
        const toLeadZ = leadZ - Player.getZ();
        const distToLead = Math.sqrt(toLeadX * toLeadX + toLeadZ * toLeadZ) || 0.0001;
        const dirX = toLeadX / distToLead;
        const dirZ = toLeadZ / distToLead;

        const speed = Math.sqrt(velX * velX + velZ * velZ);
        const parallelSpeed = speed > 0.0001 ? velX * dirX + velZ * dirZ : 0;

        const slipX = velX * SLIP_DISTANCE_COEFF;
        const slipZ = velZ * SLIP_DISTANCE_COEFF;
        const parallelSlip = parallelSpeed * SLIP_DISTANCE_COEFF;
        const parallelSlipX = dirX * parallelSlip;
        const parallelSlipZ = dirZ * parallelSlip;
        const perpSlipX = slipX - parallelSlipX;
        const perpSlipZ = slipZ - parallelSlipZ;

        const stopDistance = Math.abs(parallelSlip);
        let brakingRatio = stopDistance > distToLead + BRAKE_MARGIN ? (stopDistance - distToLead - BRAKE_MARGIN) / stopDistance : 0;
        if (nextIdx < this.activePath.length) {
            const next = this.activePath[nextIdx];
            const segX = next.x - target.x;
            const segZ = next.z - target.z;
            const segMag = Math.sqrt(segX * segX + segZ * segZ) || 1;
            const segDirX = segX / segMag;
            const segDirZ = segZ / segMag;
            const straightness = segDirX * dirX + segDirZ * dirZ; // -1..1
            if (straightness > 0.65) brakingRatio *= 0.25;
            else if (straightness > 0.35) brakingRatio *= 0.55;
        }
        brakingRatio *= PARALLEL_BRAKE_SCALE;
        const parallelCancelX = parallelSlipX * brakingRatio;
        const parallelCancelZ = parallelSlipZ * brakingRatio;

        const lateralCancelX = perpSlipX * LATERAL_CANCEL_GAIN;
        const lateralCancelZ = perpSlipZ * LATERAL_CANCEL_GAIN;

        const lateralOffset = (Player.getX() - centerX) * -dirZ + (Player.getZ() - centerZ) * dirX || 0;
        const clampedOffset = Math.max(-CENTER_CORRECTION_CLAMP, Math.min(CENTER_CORRECTION_CLAMP, lateralOffset));
        const centerNudgeX = -dirZ * clampedOffset * CENTER_CORRECTION_GAIN;
        const centerNudgeZ = dirX * clampedOffset * CENTER_CORRECTION_GAIN;

        const steerX = leadX - this.clampOffset(parallelCancelX + lateralCancelX, MAX_SLIP_LEAD) + centerNudgeX;
        const steerZ = leadZ - this.clampOffset(parallelCancelZ + lateralCancelZ, MAX_SLIP_LEAD) + centerNudgeZ;
        Keybind.setKeysForStraightLineCoords(steerX, target.y, steerZ, false);
    }

    readSolutions() {
        const solver = IceFillSolver.INSTANCE;
        if (!solver) return [];

        const platformsObj = platformsField.get(solver);
        if (!platformsObj || !platformsObj.iterator) return [];

        const paths = [];
        const platIter = platformsObj.iterator();
        while (platIter.hasNext()) {
            const platform = platIter.next();
            const sol = solutionField.get(platform);
            if (!sol || !sol.iterator) {
                paths.push([]);
                continue;
            }
            const coords = [];
            const coordIter = sol.iterator();
            while (coordIter.hasNext()) {
                const c = coordIter.next();
                coords.push({ x: c.getX(), y: c.getY(), z: c.getZ() });
            }
            paths.push(coords);
        }

        return paths;
    }

    sameBlock(a, b) {
        return !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z;
    }

    indexOfBlock(path, px, pz) {
        if (!path) return -1;
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            if (p && p.x === px && p.z === pz) return i;
        }
        return -1;
    }

    isOnBlock(target, px, pz, py) {
        if (!target) return false;
        if (px !== target.x || pz !== target.z) return false;
        if (!this.isTargetBlock(target)) return false;
        if (py === undefined) return true;
        return py >= target.y && py <= target.y + 1.5; // feet above the block
    }

    stopFollowing(resetKeys) {
        if (resetKeys) Keybind.stopMovement();
        this.activePath = null;
        this.activeStart = null;
        this.pathIndex = 0;
    }

    isTargetBlock(coord) {
        if (!coord) return false;
        const block = World.getBlockAt(coord.x, coord.y, coord.z);
        return block.type.getID() !== 0;
    }

    attachNearestPath(paths, px, pz, py, resetKeys = true) {
        const candidate = this.choosePath(paths, px, pz, py);
        if (!candidate || !this.isTargetBlock(candidate.start)) {
            this.stopFollowing(resetKeys);
            return false;
        }
        this.activeStart = candidate.start;
        this.activePath = candidate.path;
        this.pathIndex = candidate.nextIndex || 0;
        return true;
    }

    choosePath(paths, px, pz, py) {
        if (!paths) return null;
        let best = null;
        let bestDistSq = Number.MAX_SAFE_INTEGER;

        for (const path of paths) {
            if (!path || path.length < 1) continue;
            const start = path[0];
            if (py !== undefined && Math.abs(py - (start.y + 1)) > MAX_Y_DIFF) continue;

            const idx = this.indexOfBlock(path, px, pz);
            const onPath = idx !== -1 && idx < path.length - 1;
            const distSq = onPath ? 0 : this.distToStartSq(start, px, pz);
            if (distSq >= bestDistSq) continue;

            bestDistSq = distSq;
            best = { path, start, nextIndex: onPath ? idx + 1 : 0, distSq };
        }

        return best && best.distSq <= MAX_ATTACH_DIST_SQ ? best : null;
    }

    ensureValidTarget(paths, px, pz, py) {
        while (true) {
            if (!this.activePath || this.pathIndex >= this.activePath.length) {
                if (!this.attachNearestPath(paths, px, pz, py)) return null;
            }

            const target = this.activePath[this.pathIndex];
            if (this.isTargetBlock(target)) return target;
            this.pathIndex += 1;
        }
    }

    distToStartSq(start, px, pz) {
        const dx = start.x + 0.5 - px;
        const dz = start.z + 0.5 - pz;
        return dx * dx + dz * dz;
    }

    clampOffset(v, max) {
        if (!isFinite(v)) return 0;
        return Math.max(-max, Math.min(max, v));
    }

    shouldAdvanceBlock(target, pxReal, pzReal, py, velX, velZ) {
        const centerX = target.x + 0.5;
        const centerZ = target.z + 0.5;
        const dx = centerX - pxReal;
        const dz = centerZ - pzReal;
        const distSq = dx * dx + dz * dz;

        // For the first block, demand a tighter center hit to avoid skipping it.
        if (this.pathIndex === 0) {
            if (distSq > 0.45 * 0.45) return false;
            const block = World.getBlockAt(target.x, target.y, target.z);
            if (!block || block.type.getID() !== START_BLOCK_ID) return false;
        } else {
            if (distSq > 0.85 * 0.85) return false;
        }

        // If we have a next block, ensure we're moving generally toward it or standing still.
        const nextIdx = this.pathIndex + 1;
        if (nextIdx < (this.activePath ? this.activePath.length : 0)) {
            const next = this.activePath[nextIdx];
            if (next) {
                const segX = next.x + 0.5 - centerX;
                const segZ = next.z + 0.5 - centerZ;
                const segMag = Math.sqrt(segX * segX + segZ * segZ) || 1;
                const dirX = segX / segMag;
                const dirZ = segZ / segMag;
                const forward = velX * dirX + velZ * dirZ;
                if (forward < -0.05 && distSq > 0.15 * 0.15) return false;
            }
        }

        return true;
    }
}

new AutoIceFill();
