import { getSetting } from '../../GUI/GuiSave';
import RendererMain from '../../Rendering/RendererMain';
import { Keybind } from '../../Utility/Keybinding';
import { MiningUtils } from '../../Utility/MiningUtils';
import { RayTrace } from '../../Utility/Raytrace';
import { Rotations } from '../../Utility/Rotations';
import { Utils } from '../../Utility/Utils';

const Vec3d = net.minecraft.util.math.Vec3d;

class MiningBot {
    constructor() {
        this.foundLocations = [];
        this.lastScanTime = 0;
        this.lowestCostBlockIndex = 0;

        this.PRIORITIZE_TITANIUM = true;
        this.TICKGLIDE = true;

        this.mithrilCosts = {
            'minecraft:polished_diorite': this.PRIORITIZE_TITANIUM ? 1 : 5,
            'minecraft:light_blue_wool': 3,
            'minecraft:prismarine': 5,
            'minecraft:prismarine_bricks': 5,
            'minecraft:dark_prismarine': 5,
            'minecraft:gray_wool': 7,
            'minecraft:cyan_terracotta': 7,
        };

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

        this.COSTTYPE = this.mithrilCosts;

        this.STATES = {
            WAITING: 0,
            MINING: 1,
            ABILITY: 2,
            BUFF: 3,
            REFUEL: 4,
        };
        this.state = this.STATES.WAITING;

        this.TYPES = {
            MININGBOT: 0,
            COMMISSION: 1,
            GEMSTONE: 2,
            ORE: 3,
            TUNNEL: 4,
        };
        this.type = this.TYPES.MININGBOT;

        this.enabled = true;
        this.miningspeed = 0;
        this.currentTarget = null;
        this.tickCount = 0;

        register('step', () => {
            //wtf are we doing
            this.TICKGLIDE = getSetting('Mining Bot', 'Tick Gliding');
            this.FAKELOOK = getSetting('Mining Bot', 'Fakelook');
            this.MOVEMENT = getSetting('Mining Bot', 'Movement');
        }).setFps(1);

        register('command', () => {
            this.enabled = true;
            this.state = this.STATES.MINING;
        }).setName('startb');

        register('command', () => {
            this.enabled = false;
            this.state = this.STATES.WAITING;
            Keybind.setKey('leftclick', false);
            this.foundLocations = [];
            this.lastBlockPos = null;
            this.currentTarget = null;
            this.tickCount = 0;
            ChatLib.chat('§c[Mining Bot] §7Disabled.');
        }).setName('stopb');

        register('tick', () => {
            if (!this.enabled) return;

            switch (this.state) {
                case this.STATES.MINING:
                    if (
                        this.foundLocations.length === 0 ||
                        this.foundLocations.length === 1
                    ) {
                        this.scanForBlock(this.COSTTYPE); //return; //  ChatLib.chat("idk what to do here!"); // if there is not blocks it should be fixed by the actual macro itself e.g falling off cobble -> tp back
                    }

                    this.miningspeed =
                        this.type === this.TYPES.TUNNEL
                            ? MiningUtils.getSpeedWithCold()
                            : MiningUtils.getMiningSpeed();

                    let lowestCostBlock =
                        this.foundLocations[this.lowestCostBlockIndex];

                    if (lowestCostBlock) {
                        let block = World.getBlockAt(
                            lowestCostBlock.x,
                            lowestCostBlock.y,
                            lowestCostBlock.z
                        );
                        let blockName = block?.type?.getRegistryName();

                        if (
                            !this.lastBlockPos ||
                            this.lastBlockPos.x !== lowestCostBlock.x ||
                            this.lastBlockPos.y !== lowestCostBlock.y ||
                            this.lastBlockPos.z !== lowestCostBlock.z
                        ) {
                            this.tickCount = 0;
                            this.lastBlockPos = lowestCostBlock;
                        }

                        Keybind.setKey('leftclick', true);

                        if (this.TICKGLIDE) {
                            // i see no reason why mithril should be tickglided (it fails 90% of the time here)
                            if (this.COSTTYPE === this.mithrilCosts) {
                                this.TICKGLIDE = false;
                            }
                            let currentTarget =
                                this.foundLocations[this.lowestCostBlockIndex];
                            let lookingAt = Player.lookingAt();

                            if (
                                lookingAt &&
                                lookingAt?.getX() === currentTarget?.x &&
                                lookingAt?.getY() === currentTarget?.y &&
                                lookingAt?.getZ() === currentTarget?.z
                            ) {
                                this.tickCount++;
                            }

                            if (
                                World.getBlockAt(
                                    currentTarget.x,
                                    currentTarget.y,
                                    currentTarget.z
                                )
                                    ?.type?.getRegistryName()
                                    .includes('air')
                            ) {
                                ChatLib.chat('NOT GOOD');
                                this.scanForBlock(this.COSTTYPE);
                                this.tickCount = 0;
                                return;
                            }

                            let totalTicks = MiningUtils.getMineTime(
                                this.miningspeed,
                                false,
                                currentTarget
                            );

                            // Always rotate to the center of the current block
                            const targetVector = [
                                currentTarget.x + 0.5,
                                currentTarget.y + 0.5,
                                currentTarget.z + 0.5,
                            ];
                            Rotations.rotateTo(targetVector);

                            if (this.tickCount >= totalTicks) {
                                this.tickCount = 0;

                                // The block is considered mined, remove it from the list
                                this.foundLocations.shift();

                                if (this.foundLocations.length > 0) {
                                    // The next block is now at the top of the list
                                    this.lowestCostBlockIndex = 0; // Should be already 0, but for clarity
                                    this.currentTarget = this.foundLocations[0];
                                    // Scan for more blocks starting from the new target
                                    this.scanForBlock(
                                        this.COSTTYPE,
                                        false,
                                        new BlockPos(
                                            this.currentTarget.x,
                                            this.currentTarget.y,
                                            this.currentTarget.z
                                        )
                                    );
                                } else {
                                    ChatLib.chat(
                                        'No more blocks found. Rescanning from player position.'
                                    );
                                    // No blocks left, do a full scan from player's position
                                    this.scanForBlock(
                                        this.COSTTYPE,
                                        true,
                                        null
                                    );
                                    this.lowestCostBlockIndex = 0;
                                }
                            }
                        } else if (!this.TICKGLIDE) {
                            // Default rotation to the center of the current block
                            const targetVector = [
                                lowestCostBlock.x + 0.5,
                                lowestCostBlock.y + 0.5,
                                lowestCostBlock.z + 0.5,
                            ];
                            Rotations.rotateTo(targetVector);

                            if (
                                blockName.includes('air') ||
                                blockName.includes('bedrock')
                            ) {
                                this.scanForBlock(
                                    this.COSTTYPE,
                                    true,
                                    new BlockPos(
                                        lowestCostBlock.x,
                                        lowestCostBlock.y,
                                        lowestCostBlock.z
                                    )
                                );
                                this.lowestCostBlockIndex = 0;
                            }
                        }
                    }
                    break;
            }
        });
    }

    scanForBlock(target, specific = true, startPos = null) {
        if (this.scanning) return;
        new Thread(() => {
            this.tickCount = 0;

            this.foundLocations = [];
            let startX, startY, startZ;

            if (startPos) {
                startX = startPos.getX();
                startY = startPos.getY();
                startZ = startPos.getZ();
            } else {
                startX = Math.floor(Player.getX());
                startY = Math.floor(Player.getY());
                startZ = Math.floor(Player.getZ());
            }

            let cubeRadius = 4;
            let foundBlock = false;

            let playerX = Player.getX();
            let playerY = Player.getY();
            let playerZ = Player.getZ();
            let playerEyePos = Player.getPlayer().getEyePos();
            let viewVector = Player.asPlayerMP().getLookVector();

            let queue = [{ x: startX, y: startY, z: startZ }];
            let visited = new Set();
            visited.add(`${startX},${startY},${startZ}`);

            let directions = [
                [1, 0, 0],
                [-1, 0, 0],
                [0, 1, 0],
                [0, -1, 0],
                [0, 0, 1],
                [0, 0, -1],
            ];

            while (queue.length > 0) {
                let { x, y, z } = queue.shift();

                if (
                    Math.abs(x - playerX) > cubeRadius ||
                    Math.abs(y - playerY) > cubeRadius ||
                    Math.abs(z - playerZ) > cubeRadius
                ) {
                    continue;
                }

                let block = World.getBlockAt(x, y, z);
                let blockName = block?.type?.getRegistryName();

                let isTargetBlock = false;
                if (specific) {
                    isTargetBlock = target.hasOwnProperty(blockName);
                } else {
                    isTargetBlock = Object.keys(target).includes(blockName);
                }

                if (isTargetBlock) {
                    let blockPos = new BlockPos(x, y, z);
                    let dist = Math.sqrt(
                        Math.pow(x - playerX, 2) +
                            Math.pow(y - playerY, 2) +
                            Math.pow(z - playerZ, 2)
                    );

                    const startPoint = [
                        playerEyePos.x,
                        playerEyePos.y,
                        playerEyePos.z,
                    ];
                    const endPoint = [x + 0.5, y + 0.5, z + 0.5];
                    const traversedBlocks = RayTrace.rayTraceBetweenPoints(
                        startPoint,
                        endPoint
                    );

                    let isObstructed = false;
                    if (traversedBlocks) {
                        for (let i = 0; i < traversedBlocks.length; i++) {
                            const blockCoords = traversedBlocks[i];
                            const currentBlockPos = new BlockPos(
                                blockCoords[0],
                                blockCoords[1],
                                blockCoords[2]
                            );

                            // If the traversed block is not the target block, check if it's solid
                            if (!currentBlockPos.equals(blockPos)) {
                                const block = World.getBlockAt(
                                    currentBlockPos.getX(),
                                    currentBlockPos.getY(),
                                    currentBlockPos.getZ()
                                );
                                if (block && block.type.getID() !== 0) {
                                    isObstructed = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (!isObstructed) {
                        foundBlock = true;
                        let toBlockVector = new Vec3d(
                            x - Player.getX(),
                            y - playerEyePos.getY(),
                            z - Player.getZ()
                        ).normalize();

                        let dotProduct =
                            toBlockVector.x * viewVector.x +
                            toBlockVector.y * viewVector.y +
                            toBlockVector.z * viewVector.z;

                        let priorityAdjustment = -dotProduct * 50;
                        let totalCost =
                            target[blockName] + dist * 5 + priorityAdjustment;

                        this.foundLocations.push({
                            x: x,
                            y: y,
                            z: z,
                            cost: totalCost,
                        });
                    }
                }

                for (let i = 0; i < directions.length; i++) {
                    let [dx, dy, dz] = directions[i];
                    let nextX = x + dx;
                    let nextY = y + dy;
                    let nextZ = z + dz;
                    let nextKey = `${nextX},${nextY},${nextZ}`;
                    let dist = Math.sqrt(
                        Math.pow(nextX - playerX, 2) +
                            Math.pow(nextY - playerY, 2) +
                            Math.pow(nextZ - playerZ, 2)
                    );

                    if (dist <= 5 && !visited.has(nextKey)) {
                        visited.add(nextKey);
                        queue.push({ x: nextX, y: nextY, z: nextZ });
                    }
                }
            }

            if (!foundBlock) {
                ChatLib.chat('no found');
            } else {
                this.foundLocations.sort((a, b) => a.cost - b.cost);
                this.currentTarget = this.foundLocations[0];
                this.lowestCostBlockIndex = 0;
                ChatLib.chat('Scan complete. Displaying snake trail...');
            }
            this.scanning = false;
        }).start();
    }
}
// debugging
const bot = new MiningBot();

register('postRenderWorld', () => {
    if (bot.foundLocations.length > 0) {
        const Color = java.awt.Color;
        const sortedLocations = bot.foundLocations;

        const numLocations = sortedLocations.length;
        for (let i = 0; i < numLocations; i++) {
            const location = sortedLocations[i];
            const t = numLocations > 1 ? i / (numLocations - 1) : 0;

            const r = t;
            const g = 1 - t;
            const b = 0;
            const color = new Color(r, g, b, 1);

            RendererMain.drawWaypoint(
                new Vec3i(location.x, location.y, location.z),
                true,
                color
            );
        }
    }
});
