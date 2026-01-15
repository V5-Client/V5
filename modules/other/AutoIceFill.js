import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';
import { Chat } from '../../utils/Chat';

const MAX_ATTACH_DIST_SQ = 7;
const MAX_Y_DIFF = 1.1;
const BASE_BRAKE = 4.5;
const LOOK_AHEAD_WEIGHT = 0.15;

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

        this.on('tick', () => this.onTick());
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

        const playerX = Math.floor(Player.getX());
        const playerZ = Math.floor(Player.getZ());
        const playerY = Player.getY();

        if (!this.activePath && !this.attachNearestPath(paths, playerX, playerZ, playerY, false)) return;

        if (this.activePath) {
            const idx = this.indexOfBlock(this.activePath, playerX, playerZ);
            if (idx !== -1 && idx < this.activePath.length - 1 && idx + 1 > this.pathIndex) {
                this.pathIndex = idx + 1;
            }
        }

        let target = this.ensureValidTarget(paths, playerX, playerZ, playerY);
        if (!target) return;

        const playerBlockX = Math.floor(Player.getX());
        const playerBlockZ = Math.floor(Player.getZ());

        if (this.isOnBlock(target, playerBlockX, playerBlockZ, playerY)) {
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

        const velX = Player.getMotionX();
        const velZ = Player.getMotionZ();

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

        const speed = Math.sqrt(velX * velX + velZ * velZ);
        let align = 0;
        if (speed > 0.0001) {
            const dirX = leadX - Player.getX();
            const dirZ = leadZ - Player.getZ();
            const dirMag = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
            align = (velX * (dirX / dirMag) + velZ * (dirZ / dirMag)) / speed; // -1..1
        }
        const brakeScale = BASE_BRAKE * (1 - Math.max(0, align) * 0.5);

        const steerX = leadX - velX * brakeScale;
        const steerZ = leadZ - velZ * brakeScale;
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
}

new AutoIceFill();
