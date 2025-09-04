import { Rotations } from '../Utility/Rotations';
import RendererMain from '../Rendering/RendererMain';
import { Chat } from '../Utility/Chat';

/**
 * TODO
 * Custom Rotations
 * Jumping
 * Fix falling down 💀
 * World cache
 * optimizations
 * more optimizations
 */

class Node {
    constructor(x, y, z, parent = null, gScore = Infinity) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.parent = parent;
        this.gScore = gScore;
        this.hScore = 0;
        this.fScore = Infinity;
    }

    getKey() {
        return `${this.x},${this.y},${this.z}`;
    }
}

export class Pathfinder {
    constructor() {
        this.mc = Client.getMinecraft();
        this.currentPath = [];
        this.currentSegment = [];
        this.nextSegment = null;
        this.isWalking = false;
        this.isSearching = false;
        this.pathWaypoints = [];
        this.stuckTimer = 0;
        this.lastPosition = null;
        this.stuckThreshold = 60; // 3 seconds (20 ticks per second)
        this.nodesProcessed = 0;
        this.startTime = 0;
        this.pathComplete = null;
        this.searchState = {
            openList: [],
            openListMap: new Map(),
            closedList: new Set(),
            startNode: null,
            endNode: null,
        };
        this.lookAheadRadius = 5;
        this.registerCommandsAndEvents();
    }

    createNode(x, y, z, parent = null, gScore = Infinity) {
        return new Node(x, y, z, parent, gScore);
    }

    heuristic(nodeA, nodeB) {
        const dx = Math.abs(nodeA.x - nodeB.x);
        const dy = Math.abs(nodeA.y - nodeB.y);
        const dz = Math.abs(nodeA.z - nodeB.z);
        const manhattan = dx + dy + dz;
        return manhattan * 1.01;
    }

    findPath(startPos, endPos, onComplete) {
        this.stopPathing();
        this.pathComplete = onComplete;
        this.isSearching = true;
        this.searchState.startNode = this.createNode(
            Math.floor(startPos.x),
            Math.floor(startPos.y),
            Math.floor(startPos.z)
        );
        this.searchState.endNode = this.createNode(
            Math.floor(endPos.x),
            Math.floor(endPos.y),
            Math.floor(endPos.z)
        );
        this.searchState.openList = [this.searchState.startNode];
        this.searchState.openListMap = new Map();
        this.searchState.openListMap.set(
            this.searchState.startNode.getKey(),
            this.searchState.startNode
        );
        this.searchState.closedList = new Set();
        this.nodesProcessed = 0;
        this.startTime = Date.now();
        this.searchState.startNode.gScore = 0;
        this.searchState.startNode.hScore = this.heuristic(
            this.searchState.startNode,
            this.searchState.endNode
        );
        this.searchState.startNode.fScore = this.searchState.startNode.hScore;
        Chat.message(
            `&aFinding first path segment from (${this.searchState.startNode.x}, ${this.searchState.startNode.y}, ${this.searchState.startNode.z}) to (${this.searchState.endNode.x}, ${this.searchState.endNode.y}, ${this.searchState.endNode.z})...`
        );
    }

    continueSearch(segmentLength) {
        const { openList, openListMap, closedList, endNode } = this.searchState;
        const nodesPerTick = 500;
        const maxNodes = 500000;

        if (openList.length === 0) {
            Chat.message(
                '&cNo path found to the destination. Open list is empty.'
            );
            this.isSearching = false;
            return;
        }

        let nodesProcessedThisTick = 0;
        while (openList.length > 0 && nodesProcessedThisTick < nodesPerTick) {
            if (this.nodesProcessed >= maxNodes) {
                Chat.message(
                    `&cMax nodes (${maxNodes}) reached. Stopping search.`
                );
                this.isSearching = false;
                return;
            }
            const currentNode = this.popMinHeap(openList);
            const currentNodeKey = currentNode.getKey();
            openListMap.delete(currentNodeKey);
            if (
                (segmentLength &&
                    this.reconstructPath(currentNode).length > segmentLength) ||
                (currentNode.x === endNode.x &&
                    currentNode.y === endNode.y &&
                    currentNode.z === endNode.z)
            ) {
                let path = this.reconstructPath(currentNode);
                path = this.smoothPath(path);
                const endTime = Date.now();
                const timeTaken = endTime - this.startTime;
                ChatLib.chat(`Found segment in ${timeTaken}ms.`);
                ChatLib.chat(`Nodes Processed: ${this.nodesProcessed}`);
                ChatLib.chat(`Path Length: ${path.length}`);
                this.isSearching = false;
                if (this.currentSegment.length === 0) {
                    this.currentSegment = path;
                    this.isWalking = true;
                } else {
                    this.nextSegment = path;
                }
                this.pathWaypoints = [
                    ...this.currentSegment,
                    ...(this.nextSegment || []),
                ];
                this.lastPosition = {
                    x: Player.getX(),
                    y: Player.getY(),
                    z: Player.getZ(),
                };
                this.stuckTimer = 0;
                return;
            }
            closedList.add(currentNodeKey);
            let neighbors = this.getNeighbors(currentNode);
            let deltaX = endNode.x - currentNode.x;
            let deltaZ = endNode.z - currentNode.z;
            for (let neighbor of neighbors) {
                let neighborKey = neighbor.getKey();
                if (closedList.has(neighborKey)) {
                    continue;
                }
                let newGScore =
                    currentNode.gScore +
                    this.distanceBetween(currentNode, neighbor);
                let openListNeighbor = openListMap.get(neighborKey);
                if (!openListNeighbor || newGScore < openListNeighbor.gScore) {
                    neighbor.parent = currentNode;
                    neighbor.gScore = newGScore;
                    neighbor.hScore = this.heuristic(neighbor, endNode);
                    neighbor.fScore = neighbor.gScore + neighbor.hScore;
                    if (!openListNeighbor) {
                        this.pushMinHeap(openList, neighbor);
                        openListMap.set(neighborKey, neighbor);
                    } else {
                        this.removeNodeFromHeap(openList, openListNeighbor);
                        this.pushMinHeap(openList, neighbor);
                        openListMap.set(neighborKey, neighbor);
                    }
                }
            }
            nodesProcessedThisTick++;
            this.nodesProcessed++;
        }
    }

    findNextSegment() {
        if (
            this.isSearching ||
            !this.isWalking ||
            !this.currentSegment.length
        ) {
            return;
        }
        const lastNode = this.currentSegment[this.currentSegment.length - 1];
        if (this.nextSegment) {
            return;
        }
        this.isSearching = true;
        this.searchState.startNode = this.createNode(
            lastNode.x,
            lastNode.y,
            lastNode.z
        );
        const endPos = this.searchState.endNode;
        this.searchState.openList = [this.searchState.startNode];
        this.searchState.openListMap = new Map();
        this.searchState.openListMap.set(
            this.searchState.startNode.getKey(),
            this.searchState.startNode
        );
        this.searchState.closedList = new Set();
        this.nodesProcessed = 0;
        this.startTime = Date.now();
        this.searchState.startNode.gScore = 0;
        this.searchState.startNode.hScore = this.heuristic(
            this.searchState.startNode,
            endPos
        );
        this.searchState.startNode.fScore = this.searchState.startNode.hScore;
        Chat.message('&aFinding next path segment...');
    }

    getBlock(x, y, z) {
        try {
            return World.getBlockAt(x, y, z);
        } catch (e) {
            return { type: { getRegistryName: () => 'unloaded' } };
        }
    }

    getNeighbors(node) {
        let neighbors = [];
        const maxJump = 1;
        const maxDrop = 10;
        const directions = [
            [-1, 0, -1],
            [-1, 0, 0],
            [-1, 0, 1],
            [0, 0, -1],
            [0, 0, 1],
            [1, 0, -1],
            [1, 0, 0],
            [1, 0, 1],
        ];

        for (const [dx, _, dz] of directions) {
            let neighborNode = this.createNode(
                node.x + dx,
                node.y,
                node.z + dz
            );
            if (
                this.isWalkable(neighborNode) &&
                !this.searchState.closedList.has(neighborNode.getKey())
            ) {
                neighbors.push(neighborNode);
            }

            let dropNode = this.createNode(
                node.x + dx,
                node.y - 1,
                node.z + dz
            );
            if (
                this.isWalkable(dropNode) &&
                !this.searchState.closedList.has(dropNode.getKey())
            ) {
                neighbors.push(dropNode);
            }
        }

        for (let dy = -2; dy >= -maxDrop; dy--) {
            let fallNode = this.createNode(node.x, node.y + dy, node.z);
            if (
                this.isWalkable(fallNode) &&
                this.isClearPath(node, fallNode) &&
                !this.searchState.closedList.has(fallNode.getKey())
            ) {
                neighbors.push(fallNode);
            }
        }

        for (const [dx, _, dz] of directions) {
            let jumpNode = this.createNode(
                node.x + dx,
                node.y + maxJump,
                node.z + dz
            );
            if (
                this.isWalkable(jumpNode) &&
                this.canJumpTo(node, jumpNode) &&
                !this.searchState.closedList.has(jumpNode.getKey())
            ) {
                neighbors.push(jumpNode);
            }
        }
        return neighbors;
    }

    getObstaclePenalty(node) {
        let penalty = 0;
        const checkRadius = 1;
        for (let dx = -checkRadius; dx <= checkRadius; dx++) {
            for (let dz = -checkRadius; dz <= checkRadius; dz++) {
                if (dx === 0 && dz === 0) continue;
                let block1 = this.getBlock(
                    node.x + dx,
                    node.y + 1,
                    node.z + dz
                );
                let block2 = this.getBlock(
                    node.x + dx,
                    node.y + 2,
                    node.z + dz
                );
                const block1Name = block1.type.getRegistryName();
                const block2Name = block2.type.getRegistryName();
                const isSolidBlock1 =
                    block1Name !== 'minecraft:air' &&
                    !block1Name.includes('slab') &&
                    !block1Name.includes('stairs');
                const isSolidBlock2 =
                    block2Name !== 'minecraft:air' &&
                    !block2Name.includes('slab') &&
                    !block2Name.includes('stairs');
                if (isSolidBlock1 || isSolidBlock2) {
                    penalty += 10;
                }
            }
        }
        return penalty;
    }

    isClearPath(fromNode, toNode) {
        if (fromNode.x !== toNode.x || fromNode.z !== toNode.z) {
            return false;
        }
        for (let y = fromNode.y - 1; y > toNode.y; y--) {
            const block = this.getBlock(fromNode.x, y, fromNode.z);
            if (block.type.getRegistryName() !== 'minecraft:air') {
                return false;
            }
        }
        return true;
    }

    canJumpTo(fromNode, toNode) {
        const blockBelowJump = this.getBlock(toNode.x, toNode.y - 1, toNode.z);
        if (blockBelowJump.type.getRegistryName() === 'minecraft:air') {
            return false;
        }
        const blockAboveFrom = this.getBlock(
            fromNode.x,
            fromNode.y + 2,
            fromNode.z
        );
        if (blockAboveFrom.type.getRegistryName() !== 'minecraft:air') {
            return false;
        }
        return true;
    }

    distanceBetween(nodeA, nodeB) {
        const dx = Math.abs(nodeA.x - nodeB.x);
        const dy = Math.abs(nodeA.y - nodeB.y);
        const dz = Math.abs(nodeA.z - nodeB.z);
        const obstaclePenalty = this.getObstaclePenalty(nodeB);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dist + obstaclePenalty;
    }

    isWalkable(node) {
        const blockAtNode = this.getBlock(node.x, node.y, node.z);
        const standingBlockType = blockAtNode.type.getRegistryName();
        if (
            standingBlockType === 'minecraft:air' ||
            standingBlockType === 'minecraft:water' ||
            standingBlockType === 'minecraft:lava' ||
            standingBlockType === 'unloaded'
        ) {
            return false;
        }
        const blockAbove1 = this.getBlock(node.x, node.y + 1, node.z);
        const blockAbove2 = this.getBlock(node.x, node.y + 2, node.z);
        const hasClearance =
            blockAbove1.type.getRegistryName() === 'minecraft:air' &&
            blockAbove2.type.getRegistryName() === 'minecraft:air';
        return hasClearance;
    }

    pushMinHeap(heap, element) {
        heap.push(element);
        let index = heap.length - 1;
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (heap[index].fScore < heap[parentIndex].fScore) {
                [heap[index], heap[parentIndex]] = [
                    heap[parentIndex],
                    heap[index],
                ];
                index = parentIndex;
            } else {
                break;
            }
        }
    }

    popMinHeap(heap) {
        if (heap.length === 0) return null;
        const min = heap[0];
        const last = heap.pop();
        if (heap.length > 0) {
            heap[0] = last;
            let index = 0;
            while (true) {
                const leftChildIndex = 2 * index + 1;
                const rightChildIndex = 2 * index + 2;
                let smallestIndex = index;
                if (
                    leftChildIndex < heap.length &&
                    heap[leftChildIndex].fScore < heap[smallestIndex].fScore
                ) {
                    smallestIndex = leftChildIndex;
                }
                if (
                    rightChildIndex < heap.length &&
                    heap[rightChildIndex].fScore < heap[smallestIndex].fScore
                ) {
                    smallestIndex = rightChildIndex;
                }
                if (smallestIndex !== index) {
                    [heap[index], heap[smallestIndex]] = [
                        heap[smallestIndex],
                        heap[index],
                    ];
                    index = smallestIndex;
                } else {
                    break;
                }
            }
        }
        return min;
    }

    removeNodeFromHeap(heap, node) {
        const index = heap.indexOf(node);
        if (index === -1) return;
        const last = heap.pop();
        if (index === heap.length) return;
        heap[index] = last;
        let parentIndex = Math.floor((index - 1) / 2);
        if (index > 0 && heap[index].fScore < heap[parentIndex].fScore) {
            this.pushMinHeap(heap, last);
        } else {
            let currentIndex = index;
            while (true) {
                const leftChildIndex = 2 * currentIndex + 1;
                const rightChildIndex = 2 * currentIndex + 2;
                let smallestIndex = currentIndex;
                if (
                    leftChildIndex < heap.length &&
                    heap[leftChildIndex].fScore < heap[smallestIndex].fScore
                ) {
                    smallestIndex = leftChildIndex;
                }
                if (
                    rightChildIndex < heap.length &&
                    heap[rightChildIndex].fScore < heap[smallestIndex].fScore
                ) {
                    smallestIndex = rightChildIndex;
                }
                if (smallestIndex !== currentIndex) {
                    [heap[currentIndex], heap[smallestIndex]] = [
                        heap[smallestIndex],
                        heap[currentIndex],
                    ];
                    currentIndex = smallestIndex;
                } else {
                    break;
                }
            }
        }
    }

    reconstructPath(endNode) {
        const path = [];
        let temp = endNode;
        while (temp) {
            path.unshift({ x: temp.x, y: temp.y, z: temp.z });
            temp = temp.parent;
        }
        return path;
    }

    smoothPath(path) {
        if (path.length <= 2) return path;
        const smoothedPath = [path[0]];
        let lastNode = path[0];
        for (let i = 1; i < path.length - 1; i++) {
            const currentNode = path[i];
            const nextNode = path[i + 1];
            if (
                currentNode.x - lastNode.x === nextNode.x - currentNode.x &&
                currentNode.y - lastNode.y === nextNode.y - currentNode.y &&
                currentNode.z - lastNode.z === nextNode.z - currentNode.z
            ) {
                continue;
            }
            smoothedPath.push(currentNode);
            lastNode = currentNode;
        }
        smoothedPath.push(path[path.length - 1]);
        return smoothedPath;
    }

    registerCommandsAndEvents() {
        register('command', (x, y, z) => {
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                ChatLib.chat('&cUsage: /walkto <x> <y> <z>');
                return;
            }
            this.findPath(
                {
                    x: Player.getX(),
                    y: Player.getY(),
                    z: Player.getZ(),
                },
                { x: parseInt(x), y: parseInt(y), z: parseInt(z) }
            );
        }).setName('walkto');

        register('tick', () => {
            if (this.isSearching) {
                this.continueSearch(70);
            } else if (this.isWalking) {
                this.updateMovement();
            }
        });

        register('postRenderWorld', () => {
            const Color = java.awt.Color;

            this.pathWaypoints.forEach((node) => {
                RendererMain.drawWaypoint(
                    new Vec3i(node.x, node.y, node.z),
                    true,
                    new Color(0.0, 1.0, 0.0, 1.0)
                );
            });
        });

        register('worldUnload', () => {
            this.stopPathing();
        });

        register('command', () => {
            this.stopPathing();
            Rotations.stopRotation();
        }).setName('stop');
    }

    updateMovement() {
        // Check for "stuck" status before proceeding with movement logic.
        const currentPos = {
            x: Math.floor(Player.getX()),
            y: Math.floor(Player.getY()),
            z: Math.floor(Player.getZ()),
        };

        if (
            this.lastPosition &&
            currentPos.x === this.lastPosition.x &&
            currentPos.y === this.lastPosition.y &&
            currentPos.z === this.lastPosition.z
        ) {
            this.stuckTimer++;
        } else {
            this.stuckTimer = 0;
        }
        this.lastPosition = currentPos;

        if (this.stuckTimer >= this.stuckThreshold) {
            ChatLib.chat('&cStuck for too long, re-pathing...');
            this.stopPathing();
            // Re-initiate pathfinding to the original destination to find a new path.
            this.findPath(
                { x: Player.getX(), y: Player.getY(), z: Player.getZ() },
                this.searchState.endNode
            );
            return;
        }

        // Original movement logic starts here
        if (!this.currentSegment || this.currentSegment.length === 0) {
            if (this.nextSegment) {
                this.currentSegment = this.nextSegment;
                this.nextSegment = null;
                this.pathWaypoints = [...this.currentSegment];
                return;
            }
            ChatLib.chat('&aReached destination!');
            if (this.pathComplete) {
                this.pathComplete();
                this.pathComplete = null;
            }
            this.stopPathing();
            return;
        }

        const playerPos = {
            x: Player.getX(),
            y: Player.getY(),
            z: Player.getZ(),
        };

        let currentPathSegmentStart = null;
        let currentPathSegmentEnd = null;
        let segmentIndex = -1;

        for (let i = 0; i < this.currentSegment.length - 1; i++) {
            const distFromStart = Math.sqrt(
                Math.pow(playerPos.x - this.currentSegment[i].x - 0.5, 2) +
                    Math.pow(playerPos.y - this.currentSegment[i].y, 2) +
                    Math.pow(playerPos.z - this.currentSegment[i].z - 0.5, 2)
            );
            const distFromEnd = Math.sqrt(
                Math.pow(playerPos.x - this.currentSegment[i + 1].x - 0.5, 2) +
                    Math.pow(playerPos.y - this.currentSegment[i + 1].y, 2) +
                    Math.pow(
                        playerPos.z - this.currentSegment[i + 1].z - 0.5,
                        2
                    )
            );

            if (
                distFromStart < this.lookAheadRadius &&
                distFromEnd > distFromStart
            ) {
                currentPathSegmentStart = this.currentSegment[i];
                currentPathSegmentEnd = this.currentSegment[i + 1];
                segmentIndex = i;
                break;
            }
        }

        if (!currentPathSegmentStart) {
            currentPathSegmentStart = this.currentSegment[0];
            currentPathSegmentEnd =
                this.currentSegment[1] || this.currentSegment[0];
        }

        const dx = currentPathSegmentEnd.x - currentPathSegmentStart.x;
        const dy = currentPathSegmentEnd.y - currentPathSegmentStart.y;
        const dz = currentPathSegmentEnd.z - currentPathSegmentStart.z;
        const segmentLengthSquared = dx * dx + dy * dy + dz * dz;

        const t =
            segmentLengthSquared === 0
                ? 0
                : ((playerPos.x - currentPathSegmentStart.x) * dx +
                      (playerPos.y - currentPathSegmentStart.y) * dy +
                      (playerPos.z - currentPathSegmentStart.z) * dz) /
                  segmentLengthSquared;

        const projectedPoint = {
            x: currentPathSegmentStart.x + dx * t,
            y: currentPathSegmentStart.y + dy * t,
            z: currentPathSegmentStart.z + dz * t,
        };

        let targetX, targetY, targetZ;
        const remainingDistance = this.lookAheadRadius;
        const remainingSegmentLength = Math.sqrt(
            Math.pow(currentPathSegmentEnd.x - projectedPoint.x, 2) +
                Math.pow(currentPathSegmentEnd.y - projectedPoint.y, 2) +
                Math.pow(currentPathSegmentEnd.z - projectedPoint.z, 2)
        );

        if (remainingSegmentLength >= remainingDistance) {
            const ratio = remainingDistance / remainingSegmentLength;
            targetX =
                projectedPoint.x +
                (currentPathSegmentEnd.x - projectedPoint.x) * ratio;
            targetY =
                projectedPoint.y +
                (currentPathSegmentEnd.y - projectedPoint.y) * ratio;
            targetZ =
                projectedPoint.z +
                (currentPathSegmentEnd.z - projectedPoint.z) * ratio;
        } else {
            let distanceCovered = remainingSegmentLength;
            let found = false;
            for (
                let i = segmentIndex + 1;
                i < this.currentSegment.length - 1;
                i++
            ) {
                const nextSegmentLength = Math.sqrt(
                    Math.pow(
                        this.currentSegment[i + 1].x - this.currentSegment[i].x,
                        2
                    ) +
                        Math.pow(
                            this.currentSegment[i + 1].y -
                                this.currentSegment[i].y,
                            2
                        ) +
                        Math.pow(
                            this.currentSegment[i + 1].z -
                                this.currentSegment[i].z,
                            2
                        )
                );
                if (distanceCovered + nextSegmentLength >= remainingDistance) {
                    const ratio =
                        (remainingDistance - distanceCovered) /
                        nextSegmentLength;
                    targetX =
                        this.currentSegment[i].x +
                        (this.currentSegment[i + 1].x -
                            this.currentSegment[i].x) *
                            ratio;
                    targetY =
                        this.currentSegment[i].y +
                        (this.currentSegment[i + 1].y -
                            this.currentSegment[i].y) *
                            ratio;
                    targetZ =
                        this.currentSegment[i].z +
                        (this.currentSegment[i + 1].z -
                            this.currentSegment[i].z) *
                            ratio;
                    found = true;
                    break;
                }
                distanceCovered += nextSegmentLength;
            }

            if (!found) {
                targetX = this.currentSegment[this.currentSegment.length - 1].x;
                targetY = this.currentSegment[this.currentSegment.length - 1].y;
                targetZ = this.currentSegment[this.currentSegment.length - 1].z;
            }
        }

        if (this.currentSegment.length > 0) {
            const distToNextNode = Math.sqrt(
                Math.pow(playerPos.x - this.currentSegment[0].x, 2) +
                    Math.pow(playerPos.y - this.currentSegment[0].y, 2) +
                    Math.pow(playerPos.z - this.currentSegment[0].z, 2)
            );
            if (distToNextNode < 5.0) {
                this.currentSegment.shift();
            }
        }

        const dx_rot = targetX - playerPos.x;
        const dy_rot = targetY - playerPos.y;
        const dz_rot = targetZ - playerPos.z;

        const yaw = Math.atan2(dz_rot, dx_rot) * (180 / Math.PI) - 90;
        const dist2D = Math.sqrt(dx_rot * dx_rot + dz_rot * dz_rot);
        const pitch = -Math.atan2(dy_rot, dist2D) * (180 / Math.PI) - 12.25;

        Rotations.rotateToAngles(yaw, pitch);
        this.mc.options.forwardKey.setPressed(true);

        if (this.currentSegment.length <= 15) {
            this.findNextSegment();
        }
    }

    stopPathing() {
        this.isWalking = false;
        this.isSearching = false;
        this.currentSegment = [];
        this.nextSegment = null;
        this.pathWaypoints = [];
        this.mc.options.forwardKey.setPressed(false);
        this.mc.options.leftKey.setPressed(false);
        this.mc.options.rightKey.setPressed(false);
        Rotations.stopRotation();
    }
}

new Pathfinder();
