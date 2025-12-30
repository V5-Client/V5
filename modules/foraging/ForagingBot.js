import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import RenderUtils from '../../utils/render/RendererUtils';
import { Vec3d } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { RayTrace } from '../../utils/Raytrace';
import { findAndFollowPath, stopPathing } from '../../utils/pathfinder/PathAPI';
import { Rotations } from '../../utils/player/Rotations';
import { Keybind } from '../../utils/player/Keybinding';

const MAX_SCAN = 500;
const MAX_DISTANCE = 30;
const IGNORE_RADIUS = 1;

// todo
// better targetting
// "failsafes" if it fucks up pathfinding or whatever since current antistuck is haram
// seperate tree route and walk route

class ForagingBot extends ModuleBase {
    constructor() {
        super({
            name: 'Foraging Bot',
            subcategory: 'Foraging',
            description: 'unfinished.',
            tooltip: 'unfinished.',
            showEnabledToggle: false,
        });

        this.connectedBlocks = [];
        this.targetBlock = null;
        this.debug = false;
        this.pathInProgress = false;

        // delete on release
        this.registerWaypointCommand();

        this.pointIndex = 0;
        this.route = [
            [-622, 117, 57],
            [-672, 119, 59],
            [-693, 119, 25],
            [-721, 120, 21],
            //[-748, 119, 15],
            //[-727, 121, -15],
            [-691, 120, -9],
            [-683, 117, -41],
            [-696, 115, -65],
            [-641, 115, -42],
            [-577, 113, -28],
            [-562, 115, -39],
            //[-568, 117, 9],
            [-559, 113, 27],
            [-550, 112, 44],
            [-548, 110, 60],
            [-567, 111, 49],
            [-588, 114, 41],
        ];

        this.scannedBlocksSnapshot = [];
        this.scanOrigin = null;
        this.lastClickedBlock = null;
        this.rotationInProgress = false;
        this.STATES = {
            WAITING: 0,
            PATHFINDING: 1,
            SCANNING: 2,
            THROWING: 3,
        };
        this.state = this.STATES.WAITING;

        this.bindToggleKey();
        this.addToggle('Debug', this.setDebug.bind(this), 'Render stuff');

        this.on('tick', this.tick.bind(this));
        this.on('postRenderWorld', this.renderConnectedBlocks.bind(this));
    }

    setDebug(value) {
        this.debug = value;
    }

    registerWaypointCommand() {
        register('command', () => {
            const x = Math.floor(Player.getX());
            const y = Math.floor(Player.getY()) - 1;
            const z = Math.floor(Player.getZ());
            const text = '[' + x + ',' + y + ',' + z + ']';
            Client.copy(text);
        }).setName('addwaypoint1');
    }

    resetState(state, pointIndex) {
        this.state = state;
        this.pointIndex = pointIndex;

        this.connectedBlocks = [];
        this.scannedBlocksSnapshot = [];
        this.targetBlock = null;
        this.scanOrigin = null;
        this.lastClickedBlock = null;
        this.rotationInProgress = false;
        this.pathInProgress = false;
    }

    tick() {
        if (Client.isInChat() || Client.isInGui()) return;

        switch (this.state) {
            case this.STATES.PATHFINDING:
                this.handlePathfinding();
                break;
            case this.STATES.SCANNING:
                this.handleScanning();
                break;
            case this.STATES.THROWING:
                this.handleThrowing();
                break;
        }
    }

    handlePathfinding() {
        if (this.pathInProgress) return;

        // some people say its a broken pathfinder, i say its just route randomisation
        const start = [Math.round(Player.getX() + Math.random() * 3 - 1.5), Math.round(Player.getY()) - 1, Math.round(Player.getZ() + Math.random() * 3 - 1.5)];
        const end = this.route[this.pointIndex];
        if (!end) {
            this.advanceRoutePoint();
            return;
        }

        this.pathInProgress = true;
        findAndFollowPath(start, end, this.onPathFinished.bind(this));
    }

    onPathFinished(success) {
        this.pathInProgress = false;
        if (success) {
            this.state = this.STATES.SCANNING;
            return;
        }
        this.advanceRoutePoint();
    }

    handleScanning() {
        this.scanConnectedBlocks(this.route[this.pointIndex]);
        this.state = this.STATES.WAITING;
    }

    handleThrowing() {
        if (Rotations.isRotating || this.rotationInProgress) return;

        const targetBlock = this.findLowestCostBlock();
        if (!targetBlock) return;

        this.targetBlock = targetBlock;
        this.rotationInProgress = true;

        const aimPoint = targetBlock.hitPoint || [targetBlock.x + 0.5, targetBlock.y + 0.7, targetBlock.z + 0.5];
        Rotations.rotateToVector(aimPoint, 2);
        Rotations.onEndRotation(() => {
            Keybind.rightClick();
            this.lastClickedBlock = { x: targetBlock.x, y: targetBlock.y, z: targetBlock.z };
            this.connectedBlocks = this.connectedBlocks.filter(
                (block) =>
                    Math.abs(block.x - targetBlock.x) > IGNORE_RADIUS ||
                    Math.abs(block.y - targetBlock.y) > IGNORE_RADIUS ||
                    Math.abs(block.z - targetBlock.z) > IGNORE_RADIUS
            );
            this.targetBlock = null;
            Client.scheduleTask(17, () => {
                this.rotationInProgress = false;
            });
        });
    }

    scanConnectedBlocks(start) {
        this.scanOrigin = start ? [...start] : null;
        const target = World.getBlockAt(start[0], start[1], start[2]);
        const targetId = target?.type?.getID();
        if (targetId === undefined || targetId === null) {
            Chat.message('Foraging Bot: Start block has no ID.');
            return [];
        }

        const key = (x, y, z) => x + ',' + y + ',' + z;
        const visited = new Set([key(target.x, target.y, target.z)]);
        const queue = [{ x: target.x, y: target.y, z: target.z }];
        const found = [];

        while (queue.length > 0 && found.length < MAX_SCAN) {
            const current = queue.shift();
            const block = World.getBlockAt(current.x, current.y, current.z);
            if (!block || block.type?.getID() !== targetId) continue;

            found.push({ x: current.x, y: current.y, z: current.z });

            this.addNeighbors(current, queue, visited, key, targetId);
        }

        this.connectedBlocks = found;
        this.scannedBlocksSnapshot = found.map((b) => ({ ...b }));
        this.targetBlock = null;
        Chat.message(`Scan complete. Found ${found.length} blocks.`);
        return found;
    }

    addNeighbors(current, queue, visited, key, targetId) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    if (dx === 0 && dy === 0 && dz === 0) continue;
                    const nx = current.x + dx;
                    const ny = current.y + dy;
                    const nz = current.z + dz;
                    const neighborKey = key(nx, ny, nz);
                    if (visited.has(neighborKey)) continue;

                    const neighbor = World.getBlockAt(nx, ny, nz);
                    if (neighbor?.type?.getID() === targetId) {
                        visited.add(neighborKey);
                        queue.push({ x: nx, y: ny, z: nz });
                    }
                }
            }
        }
    }

    filterValidBlocks(blocks) {
        if (!blocks || blocks.length === 0) return [];
        const ignore = this.lastClickedBlock;

        return blocks.filter((block) => {
            if (
                ignore &&
                Math.abs(block.x - ignore.x) <= IGNORE_RADIUS &&
                Math.abs(block.y - ignore.y) <= IGNORE_RADIUS &&
                Math.abs(block.z - ignore.z) <= IGNORE_RADIUS
            ) {
                return false;
            }
            const worldBlock = World.getBlockAt(block.x, block.y, block.z);
            return worldBlock?.type?.getID() === 80;
        });
    }

    advanceRoutePoint() {
        if (this.route.length <= 1) {
            Chat.message('Foraging Bot: Route complete. Stopping.');
            this.toggle(false);
            return false;
        }

        this.pointIndex = (this.pointIndex + 1) % this.route.length;
        this.resetState(this.STATES.PATHFINDING, this.pointIndex);
        Chat.message(`Foraging Bot: Moving to next route point (${this.pointIndex + 1}/${this.route.length}).`);
        return false;
    }

    getTargetableBlocks() {
        const sourceBlocks = this.scannedBlocksSnapshot?.length ? this.scannedBlocksSnapshot : this.connectedBlocks;
        const validBlocks = this.filterValidBlocks(sourceBlocks);
        if (validBlocks.length === 0) {
            this.advanceRoutePoint();
            return [];
        }

        const blocksWithHits = this.addHitPoints(validBlocks);
        const visibleBlocks = this.filterVisibleBlocks(blocksWithHits);
        const targetableBlocks = this.filterInRange(visibleBlocks.length ? visibleBlocks : blocksWithHits);

        if (targetableBlocks.length === 0) {
            this.advanceRoutePoint();
            return [];
        }

        this.connectedBlocks = validBlocks;
        return targetableBlocks;
    }

    addHitPoints(list) {
        return list.map((block) => ({
            ...block,
            hitPoint: RayTrace.getPointOnBlock(block, false),
        }));
    }

    filterVisibleBlocks(list) {
        return list.filter((block) => !!block.hitPoint);
    }

    filterInRange(list) {
        return list.filter((block) => {
            const point = block.hitPoint || [block.x + 0.5, block.y + 0.5, block.z + 0.5];
            const distData = MathUtils.getDistanceToPlayerEyes(point[0], point[1], point[2]);
            return (distData?.distance ?? Infinity) <= MAX_DISTANCE;
        });
    }

    findLowestCostBlock() {
        const blocksToScore = this.getTargetableBlocks();
        if (blocksToScore.length === 0) return null;

        const scoredBlocks = blocksToScore.map((block) => {
            const point = block.hitPoint || [block.x + 0.5, block.y + 0.5, block.z + 0.5];
            const angleData = MathUtils.angleToPlayer(point);
            const distanceData = MathUtils.getDistanceToPlayerEyes(point[0], point[1], point[2]);

            return {
                ...block,
                angleDistance: angleData?.distance ?? Infinity,
                distance: distanceData?.distance ?? Infinity,
            };
        });

        scoredBlocks.sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            if (a.angleDistance !== b.angleDistance) return a.angleDistance - b.angleDistance;
            return a.distance - b.distance;
        });

        return scoredBlocks[0] || null;
    }

    onEnable() {
        Chat.message('Foraging Bot: &aEnabled');
        this.resetState(this.STATES.PATHFINDING, 0);
    }

    onDisable() {
        Chat.message('Foraging Bot: &cDisabled');
        Rotations.stopRotation();
        stopPathing();
        this.resetState(this.STATES.WAITING, this.pointIndex);
    }

    renderConnectedBlocks() {
        if (!this.debug || this.connectedBlocks.length === 0) return;

        this.connectedBlocks.forEach((location) => {
            const blockVec = new Vec3d(location.x, location.y, location.z);
            RenderUtils.drawWireFrame(blockVec, [205, 133, 63, 255]);
        });
    }
}

export const ForagingB = new ForagingBot();
