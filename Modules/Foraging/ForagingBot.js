import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import RenderUtils from '../../utils/render/RendererUtils';
import { Vec3d } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { RayTrace } from '../../utils/Raytrace';
import { findAndFollowPath, stopPathing } from '../../utils/pathfinder/PathAPI';
import { Rotations } from '../../utils/player/Rotations';
import { Keybind } from '../../utils/player/Keybinding';

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

        // delete on release
        register('command', () => {
            let text = '[' + Math.floor(Player.getX()) + ',' + (Math.floor(Player.getY()) - 1) + ',' + Math.floor(Player.getZ()) + ']';
            Client.copy(text);
        }).setName('addwaypoint1');

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
        this.addToggle('Debug', (v) => (this.debug = v), 'Render stuff');

        this.on('tick', () => this.tick());
        this.on('postRenderWorld', () => this.renderConnectedBlocks());
    }

    tick() {
        if (Client.isInChat() || Client.isInGui()) return;

        switch (this.state) {
            case this.STATES.PATHFINDING:
                // some people say its a broken pathfinder, i say its just route randomisation
                let start = [
                    Math.round(Player.getX() + Math.random() * 3 - 1.5),
                    Math.round(Player.getY()) - 1,
                    Math.round(Player.getZ() + Math.random() * 3 - 1.5),
                ];
                let end = this.route[this.pointIndex];
                findAndFollowPath(start, end, (success) => {
                    if (success) {
                        this.state = this.STATES.THROWING;
                    } else {
                        this.advanceRoutePoint();
                    }
                });
                this.state = this.STATES.SCANNING;
                break;
            case this.STATES.SCANNING:
                this.scanConnectedBlocks(this.route[this.pointIndex]);
                this.state = this.STATES.WAITING;
                break;
            case this.STATES.THROWING:
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
                        (block) => Math.abs(block.x - targetBlock.x) > 1 || Math.abs(block.y - targetBlock.y) > 1 || Math.abs(block.z - targetBlock.z) > 1
                    );
                    this.targetBlock = null;
                    Client.scheduleTask(17, () => {
                        this.rotationInProgress = false;
                    });
                });
                break;
        }
    }

    scanConnectedBlocks(start) {
        this.scanOrigin = start ? [...start] : null;
        const target = World.getBlockAt(start[0], start[1], start[2]);
        const targetId = target?.type?.getID();
        if (targetId === undefined || targetId === null) {
            Chat.message('Foraging Bot: Start block has no ID.');
            return [];
        }

        const key = (x, y, z) => `${x},${y},${z}`;
        const visited = new Set([key(target.x, target.y, target.z)]);
        const queue = [{ x: target.x, y: target.y, z: target.z }];
        const found = [];

        while (queue.length > 0 && found.length < 500) {
            const current = queue.shift();
            const block = World.getBlockAt(current.x, current.y, current.z);
            if (!block || block.type?.getID() !== targetId) continue;

            found.push({ x: current.x, y: current.y, z: current.z });

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        if (dx !== 0 || dy !== 0 || dz !== 0) {
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
        }

        this.connectedBlocks = found;
        this.scannedBlocksSnapshot = found.map((b) => ({ ...b }));
        this.targetBlock = null;
        Chat.message(`Scan complete. Found ${found.length} blocks.`);
        return found;
    }

    filterValidBlocks(blocks) {
        if (!blocks || blocks.length === 0) return [];
        const ignore = this.lastClickedBlock;

        return blocks.filter((block) => {
            if (ignore && Math.abs(block.x - ignore.x) <= 1 && Math.abs(block.y - ignore.y) <= 1 && Math.abs(block.z - ignore.z) <= 1) return false;
            const worldBlock = World.getBlockAt(block.x, block.y, block.z);
            return worldBlock?.type?.getID() === 80;
        });
    }

    advanceRoutePoint() {
        if (!this.route.length || this.route.length < 2) {
            Chat.message('Foraging Bot: Route complete. Stopping.');
            this.toggle(false);
            return false;
        }

        this.pointIndex = (this.pointIndex + 1) % this.route.length;
        this.connectedBlocks = [];
        this.scannedBlocksSnapshot = [];
        this.targetBlock = null;
        this.scanOrigin = null;
        this.lastClickedBlock = null;
        this.rotationInProgress = false;
        this.state = this.STATES.PATHFINDING;
        Chat.message(`Foraging Bot: Moving to next route point (${this.pointIndex + 1}/${this.route.length}).`);
        return false;
    }

    rescanOrAdvance() {
        const sourceBlocks = this.scannedBlocksSnapshot?.length ? this.scannedBlocksSnapshot : this.connectedBlocks;
        this.connectedBlocks = this.filterValidBlocks(sourceBlocks);

        if (this.connectedBlocks.length === 0) {
            return this.advanceRoutePoint();
        }
        return true;
    }

    findLowestCostBlock() {
        if (!this.connectedBlocks || this.connectedBlocks.length === 0) {
            if (!this.rescanOrAdvance()) return null;
        }

        this.connectedBlocks = this.filterValidBlocks(this.connectedBlocks);
        if (this.connectedBlocks.length === 0) {
            if (!this.rescanOrAdvance()) return null;
        }

        const addHitPoints = (list) =>
            list.map((block) => ({
                ...block,
                hitPoint: RayTrace.getPointOnBlock(block, false),
            }));

        let blocksWithHits = addHitPoints(this.connectedBlocks);
        let visibleBlocks = blocksWithHits.filter((block) => !!block.hitPoint);

        if (visibleBlocks.length === 0) {
            if (!this.rescanOrAdvance()) return null;
            blocksWithHits = addHitPoints(this.connectedBlocks);
            visibleBlocks = blocksWithHits.filter((block) => !!block.hitPoint);
            if (visibleBlocks.length === 0) {
                this.advanceRoutePoint();
                return null;
            }
        }

        const MAX_DISTANCE = 30;
        const filterInRange = (list) =>
            list.filter((block) => {
                const point = block.hitPoint || [block.x + 0.5, block.y + 0.5, block.z + 0.5];
                const distData = MathUtils.getDistanceToPlayerEyes(point[0], point[1], point[2]);
                return (distData?.distance ?? Infinity) <= MAX_DISTANCE;
            });

        let blocksToScore = filterInRange(visibleBlocks);
        if (blocksToScore.length === 0) {
            blocksToScore = filterInRange(blocksWithHits);
        }
        if (blocksToScore.length === 0) {
            this.advanceRoutePoint();
            return null;
        }

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
        this.state = this.STATES.PATHFINDING;
        this.pointIndex = 0;
        this.scannedBlocksSnapshot = [];
        this.scanOrigin = null;
        this.lastClickedBlock = null;
        this.rotationInProgress = false;
    }

    onDisable() {
        Chat.message('Foraging Bot: &cDisabled');
        Rotations.stopRotation();
        stopPathing();
        this.connectedBlocks = [];
        this.targetBlock = null;
        this.scannedBlocksSnapshot = [];
        this.scanOrigin = null;
        this.lastClickedBlock = null;
        this.rotationInProgress = false;
    }

    renderConnectedBlocks() {
        if (!this.debug || this.connectedBlocks.length === 0) return;

        const count = this.connectedBlocks.length;
        for (let i = 0; i < count; i++) {
            const location = this.connectedBlocks[i];
            const blockVec = new Vec3d(location.x, location.y, location.z);
            RenderUtils.drawWireFrame(blockVec, [205, 133, 63, 255]);
        }
    }
}

export const ForagingB = new ForagingBot();
