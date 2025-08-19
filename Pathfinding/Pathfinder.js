import { Rotations } from "../Utility/Rotations";
import RendererMain from "../Rendering/RendererMain";
import { Prefix } from "../Utility/Prefix";

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

class Pathfinder {
  constructor() {
    this.mc = Client.getMinecraft();
    this.currentPath = [];
    this.isWalking = false;
    this.pathWaypoints = [];
    this.isSearching = false;
    this.stuckTimer = 0;
    this.lastPosition = null;
    this.nodesProcessed = 0;
    this.startTime = 0;
    this.searchState = {
      openList: [],
      openListMap: new Map(),
      closedList: new Set(),
      startNode: null,
      endNode: null,
    };
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

  findPath(startPos, endPos) {
    this.currentPath = [];
    this.isWalking = false;
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
    Prefix.message(
      `&aFinding path from (${this.searchState.startNode.x}, ${this.searchState.startNode.y}, ${this.searchState.startNode.z}) to (${this.searchState.endNode.x}, ${this.searchState.endNode.y}, ${this.searchState.endNode.z})...`
    );
  }

  continueSearch() {
    const { openList, openListMap, closedList, endNode } = this.searchState;
    const nodesPerTick = 3000;
    const maxNodes = 500000;
    if (openList.length === 0) {
      Prefix.message("&cNo path found to the destination. Open list is empty.");
      this.isSearching = false;
      return;
    }
    let nodesProcessedThisTick = 0;
    while (openList.length > 0 && nodesProcessedThisTick < nodesPerTick) {
      if (this.nodesProcessed >= maxNodes) {
        Prefix.message(`&cMax nodes (${maxNodes}) reached. Stopping search.`);
        this.isSearching = false;
        return;
      }
      const currentNode = this.popMinHeap(openList);
      const currentNodeKey = currentNode.getKey();
      openListMap.delete(currentNodeKey);
      if (
        currentNode.x === endNode.x &&
        currentNode.y === endNode.y &&
        currentNode.z === endNode.z
      ) {
        this.currentPath = this.reconstructPath(currentNode);
        this.currentPath = this.smoothPath(this.currentPath);
        const endTime = Date.now();
        const timeTaken = endTime - this.startTime;
        ChatLib.chat(`Found path in ${timeTaken}ms.`);
        ChatLib.chat(`Nodes Processed: ${this.nodesProcessed}`);
        ChatLib.chat(`Path Length: ${this.currentPath.length}`);
        this.isSearching = false;
        this.isWalking = true;
        this.pathWaypoints = [...this.currentPath];
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

        let currentManhattan =
          Math.abs(currentNode.x - endNode.x) +
          Math.abs(currentNode.y - endNode.y) +
          Math.abs(currentNode.z - endNode.z);
        let neighborManhattan =
          Math.abs(neighbor.x - endNode.x) +
          Math.abs(neighbor.y - endNode.y) +
          Math.abs(neighbor.z - endNode.z);

        if (neighborManhattan > currentManhattan) {
          continue;
        }
        let directionalPenalty = 0;
        let neighborDeltaX = neighbor.x - currentNode.x;
        let neighborDeltaZ = neighbor.z - currentNode.z;
        if (
          (deltaX < 0 && neighborDeltaX > 0) ||
          (deltaX > 0 && neighborDeltaX < 0)
        ) {
          directionalPenalty += 5;
        }
        if (
          (deltaZ < 0 && neighborDeltaZ > 0) ||
          (deltaZ > 0 && neighborDeltaZ < 0)
        ) {
          directionalPenalty += 5;
        }

        let newGScore =
          currentNode.gScore +
          this.distanceBetween(currentNode, neighbor) +
          directionalPenalty;
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
  getBlock(x, y, z) {
    // use this as world  cache later on
    try {
      return World.getBlockAt(x, y, z);
    } catch (e) {
      return { type: { getRegistryName: () => "unloaded" } };
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

    const endNode = this.searchState.endNode;
    const verticalDifference = endNode.y - node.y;

    // this could be done alot better but it was a quick write

    if (verticalDifference > 0) {
      // end node is higher, prioritize jumps
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
    } else if (verticalDifference < 0) {
      // end node is lower, prioritize drops
      for (const [dx, _, dz] of directions) {
        let dropNode = this.createNode(node.x + dx, node.y - 1, node.z + dz);
        if (
          this.isWalkable(dropNode) &&
          !this.searchState.closedList.has(dropNode.getKey())
        ) {
          neighbors.push(dropNode);
        }
      } // check for large falls straight down
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
    } // add horizontal movements as a fallback

    for (const [dx, _, dz] of directions) {
      let neighborNode = this.createNode(node.x + dx, node.y, node.z + dz);
      if (
        this.isWalkable(neighborNode) &&
        !this.searchState.closedList.has(neighborNode.getKey())
      ) {
        neighbors.push(neighborNode);
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

        let block1 = this.getBlock(node.x + dx, node.y + 1, node.z + dz);
        let block2 = this.getBlock(node.x + dx, node.y + 2, node.z + dz);

        const block1Name = block1.type.getRegistryName();
        const block2Name = block2.type.getRegistryName();

        const isSolidBlock1 =
          block1Name !== "minecraft:air" &&
          !block1Name.includes("slab") &&
          !block1Name.includes("stairs");
        const isSolidBlock2 =
          block2Name !== "minecraft:air" &&
          !block2Name.includes("slab") &&
          !block2Name.includes("stairs");

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
      if (block.type.getRegistryName() !== "minecraft:air") {
        return false;
      }
    }
    return true;
  }

  canJumpTo(fromNode, toNode) {
    const blockBelowJump = this.getBlock(toNode.x, toNode.y - 1, toNode.z);
    if (blockBelowJump.type.getRegistryName() === "minecraft:air") {
      return false;
    }
    const blockAboveFrom = this.getBlock(
      fromNode.x,
      fromNode.y + 2,
      fromNode.z
    );
    if (blockAboveFrom.type.getRegistryName() !== "minecraft:air") {
      return false;
    }
    return true;
  }

  distanceBetween(nodeA, nodeB) {
    const dx = Math.abs(nodeA.x - nodeB.x);
    const dy = Math.abs(nodeA.y - nodeB.y);
    const dz = Math.abs(nodeA.z - nodeB.z);

    let jumpPenalty = 0;
    if (nodeB.y > nodeA.y) {
      jumpPenalty = 20;
    }

    const obstaclePenalty = this.getObstaclePenalty(nodeB);

    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return dist + jumpPenalty + obstaclePenalty;
  }

  isWalkable(node) {
    const blockAtNode = this.getBlock(node.x, node.y, node.z);
    const standingBlockType = blockAtNode.type.getRegistryName();
    if (
      standingBlockType === "minecraft:air" ||
      standingBlockType === "minecraft:water" ||
      standingBlockType === "minecraft:lava" ||
      standingBlockType === "unloaded"
    ) {
      return false;
    }
    const blockAbove1 = this.getBlock(node.x, node.y + 1, node.z);
    const blockAbove2 = this.getBlock(node.x, node.y + 2, node.z);
    const hasClearance =
      blockAbove1.type.getRegistryName() === "minecraft:air" &&
      blockAbove2.type.getRegistryName() === "minecraft:air";
    return hasClearance;
  }

  pushMinHeap(heap, element) {
    heap.push(element);
    let index = heap.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (heap[index].fScore < heap[parentIndex].fScore) {
        [heap[index], heap[parentIndex]] = [heap[parentIndex], heap[index]];
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
    register("command", (x, y, z) => {
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        ChatLib.chat("&cUsage: /walkto <x> <y> <z>");
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
    }).setName("walkto");

    register("tick", () => {
      if (this.isSearching) {
        this.continueSearch();
      } else if (this.isWalking && this.currentPath.length > 0) {
        this.updateMovement();
      }
    });

    register("postRenderWorld", () => {
      const Color =
        Java.type(
          "java.awt.Color"
        ); /*    this.searchState.closedList.forEach((key) => {
        // Render closed list nodes (scanned)
        const coords = key.split(",").map(Number);
        RendererMain.drawWaypoint(
          new Vec3i(coords[0], coords[1], coords[2]),
          false,
          new Color(1.0, 0.0, 0.0, 0.3) // Semi-transparent red
        );
      }); // Render open list nodes (candidates)

      this.searchState.openList.forEach((node) => {
        RendererMain.drawWaypoint(
          new Vec3i(node.x, node.y, node.z),
          false,
          new Color(1.0, 1.0, 0.0, 0.3) // Semi-transparent yellow
        );
      }); // Render the final path (when walking) */
      this.pathWaypoints.forEach((node) => {
        RendererMain.drawWaypoint(
          new Vec3i(node.x, node.y, node.z),
          true,
          new Color(0.0, 1.0, 0.0, 1.0) // Opaque green
        );
      });
    });

    register("worldUnload", () => {
      this.stopPathing();
    });

    register("command", () => {
      this.stopPathing();
      Rotations.stopRotation();
    }).setName("stop");
  }

  updateMovement() {
    const nextNode = this.currentPath[0];
    const targetX = nextNode.x + 0.5;
    const targetY = nextNode.y;
    const targetZ = nextNode.z + 0.5;
    const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
    const distance = Math.sqrt(
      Math.pow(targetX - playerPos.x, 2) +
        Math.pow(targetY - playerPos.y, 2) +
        Math.pow(targetZ - playerPos.z, 2)
    );
    if (distance < 5) {
      this.currentPath.shift();
      this.lastPosition = playerPos;
      this.stuckTimer = 0;
      if (this.currentPath.length === 0) {
        ChatLib.chat("&aReached destination!");
        this.stopPathing();
        return;
      }
    }
    Rotations.rotateTo([nextNode.x, nextNode.y + 2, nextNode.z]);
    this.mc.options.forwardKey.setPressed(true);
  }

  stopPathing() {
    this.isWalking = false;
    this.isSearching = false;
    this.mc.options.forwardKey.setPressed(false);
    Rotations.stopRotation();
  }
}

new Pathfinder();
