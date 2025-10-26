import { Keybind } from '../../Utility/Keybinding';
import { MiningUtils } from '../../Utility/MiningUtils';
import { RayTrace } from '../../Utility/Raytrace';
import { Rotations } from '../../Utility/Rotations';
import { Utils } from '../../Utility/Utils';
import { MathUtils } from '../../Utility/Math';
import { Chat } from '../../Utility/Chat';
import { registerEventSB } from '../../Utility/SkyblockEvents';
import { Guis } from '../../Utility/Inventory';
import { NukerUtils } from '../../Utility/NukerUtils';
import RenderUtils from '../../Rendering/RendererUtils';
import { ModuleBase } from '../../Utility/ModuleBase';
const { addCategoryItem, addToggle, addMultiToggle } = global.Categories;

const Vec3d = net.minecraft.util.math.Vec3d;

class Bot extends ModuleBase {
    constructor() {
        super({
            name: 'Mining Bot',
            subcategory: 'Mining',
            description: 'Universal settings for Mining & block miner',
            tooltip: 'Automatically mines.',
            showEnabledToggle: false,
        });
        this.bindToggleKey();
        this.foundLocations = [];
        this.lowestCostBlockIndex = 0;

        this.PRIORITIZE_TITANIUM = true;
        this.TICKGLIDE = true;
        this.FAKELOOK = false;
        this.MOVEMENT = false;
        this.SCAN_ONLY = false;

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

        this.oreCosts = {
            'minecraft:coal_block': 4,
            'minecraft:quartz_block': 4,
            'minecraft:iron_block': 4,
            'minecraft:redstone_block': 4,
            'minecraft:gold_block': 4,
            'minecraft:diamond_block': 4,
            'minecraft:emerald_block': 4,
        };

        this.TYPE = null;
        this.COSTTYPE = null;

        this.STATES = {
            WAITING: 0,
            ABILITY: 1,
            MINING: 2,
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

        this.miningspeed = 0;
        this.currentTarget = null;
        this.tickCount = 0;
        this.lastBlockPos = null;
        this.allowScan = false;
        this.totalTicks = 0;
        this.miningbot = null;
        this.ability = null;
        this.file = null;
        this.abilityClicked = false;
        this.speedBoost = false;
        this.empty = false;
        this.nuking = false;

        this.exploit = register('packetSent', (packet, event) => {
            let packetAction = packet?.getAction()?.toString();

            if (packetAction === 'ABORT_DESTROY_BLOCK') cancel(event);
        })
            .setFilteredClass(
                net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket
            )
            .unregister();

        this.debug = register('postRenderWorld', () => {
            if (this.foundLocations.length > 0) {
                const count = this.foundLocations.length;
                for (let i = 0; i < count; i++) {
                    const location = this.foundLocations[i];
                    const blockVec = new Vec3d(
                        location.x,
                        location.y,
                        location.z
                    );

                    const t = count > 1 ? i / (count - 1) : 0;
                    const r = i === 0 ? 1 : t;
                    const g = i === 0 ? 1 : 1 - t;
                    const b = i === 0 ? 1 : 0;
                    RenderUtils.drawWireFrame(blockVec, [
                        r * 255,
                        g * 255,
                        b * 255,
                        255,
                    ]);

                    const hasAim =
                        location.aimX !== undefined &&
                        location.aimY !== undefined &&
                        location.aimZ !== undefined;
                    if (hasAim) {
                        const ax = location.aimX;
                        const ay = location.aimY;
                        const az = location.aimZ;

                        // Crosshair around aim point
                        const d = 0.1;
                        const aimX1 = new Vec3d(ax - d, ay, az);
                        const aimX2 = new Vec3d(ax + d, ay, az);
                        const aimY1 = new Vec3d(ax, ay - d, az);
                        const aimY2 = new Vec3d(ax, ay + d, az);
                        const aimZ1 = new Vec3d(ax, ay, az - d);
                        const aimZ2 = new Vec3d(ax, ay, az + d);

                        const color = [r * 255, g * 255, b * 255, 230];
                        RenderUtils.drawLine(aimX1, aimX2, color, 3, false);
                        RenderUtils.drawLine(aimY1, aimY2, color, 3, false);
                        RenderUtils.drawLine(aimZ1, aimZ2, color, 3, false);
                    }
                }
            }
        }).unregister();

        this.on('tick', () => {
            if (Client.isInChat() || Client.isInGui()) return;

            const { drill } = MiningUtils.getDrills();

            const Type = this.TYPE.find((option) => option.enabled)?.name;

            if (Type) {
                const costPropertyName = Type.toLowerCase() + 'Costs';
                this.COSTTYPE = this[costPropertyName];
            }

            switch (this.state) {
                case this.STATES.ABILITY:
                    if (this.SCAN_ONLY) {
                        this.state = this.STATES.MINING;
                        break;
                    }

                    Guis.setItemSlot(drill.slot);
                    Keybind.setKey('leftclick', false);

                    if (!this.file) {
                        this.file = Utils.getConfigFile('miningstats.json');
                        this.ability = this.file.ability;
                    }

                    if (!this.ability) {
                        Chat.message(
                            '&cFailed to get Pickaxe Ability! Run /getminingstats'
                        );
                        this.toggle(false);
                        return;
                    }

                    // pickobulus will be done soon
                    if (
                        this.ability !== 'Pickobulus' &&
                        Player.getHeldItemIndex() === drill.slot
                    ) {
                        if (!this.abilityClicked) {
                            Client.scheduleTask(3, () => {
                                Keybind.rightClick();
                                this.scanForBlock(this.COSTTYPE);
                                this.state = this.STATES.MINING;
                                this.abilityClicked = false;
                            });
                            this.abilityClicked = true;
                        }
                    }
                    break;
                case this.STATES.MINING:
                    if (this.SCAN_ONLY) {
                        this.scanForBlock(this.COSTTYPE, true);
                        break;
                    }

                    Guis.setItemSlot(drill.slot);

                    if (this.empty) {
                        Chat.message('No more mineable blocks.');
                        this.toggle(false);
                    }

                    // todo fix this gets called 20 times per second which is intensive due to file read and stuff
                    this.miningspeed =
                        this.type === this.TYPES.TUNNEL
                            ? MiningUtils.getSpeedWithCold()
                            : MiningUtils.getMiningSpeed();

                    let lowestCostBlock =
                        this.foundLocations[this.lowestCostBlockIndex];

                    if (!lowestCostBlock) return;
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

                    this.currentTarget =
                        this.foundLocations[this.lowestCostBlockIndex];

                    let lookingAt = Player.lookingAt();
                    if (
                        lookingAt &&
                        lookingAt?.getX() === this.currentTarget?.x &&
                        lookingAt?.getY() === this.currentTarget?.y &&
                        lookingAt?.getZ() === this.currentTarget?.z
                    ) {
                        this.tickCount++;
                    }

                    this.totalTicks = MiningUtils.getMineTime(
                        this.miningspeed,
                        this.speedBoost,
                        this.currentTarget
                    );

                    Keybind.setKey('leftclick', true);

                    const blockDist = MathUtils.getDistanceToPlayerEyes(
                        this.currentTarget.x,
                        this.currentTarget.y,
                        this.currentTarget.z
                    ).distance;

                    switch (this.COSTTYPE) {
                        case this.gemstoneCosts:
                            if (blockDist < 1) Keybind.setKey('s', true);
                            else if (blockDist > 4.5) Keybind.setKey('w', true);
                            else Keybind.stopMovement();

                            break;
                    }

                    const fakeLookMode = this.FAKELOOK.find(
                        (option) => option.enabled
                    )?.name;

                    if (fakeLookMode !== 'Off') {
                        if (
                            blockName.includes('air') ||
                            blockName.includes('bedrock')
                        ) {
                            this.lowestCostBlockIndex++;
                        }

                        if (fakeLookMode === 'Instant') {
                            if (!this.currentTarget) return;
                            if (!this.nuking) {
                                NukerUtils.nuke(
                                    [
                                        this.currentTarget.x,
                                        this.currentTarget.y,
                                        this.currentTarget.z,
                                    ],
                                    this.totalTicks
                                );
                                this.nuking = true;
                            }
                        } else if (fakeLookMode === 'Queued') {
                            if (!this.currentTarget) return;
                            if (!this.nuking) {
                                NukerUtils.nukeQueueAdd(
                                    [
                                        this.currentTarget.x,
                                        this.currentTarget.y,
                                        this.currentTarget.z,
                                    ],
                                    this.totalTicks
                                );
                                this.nuking = true;
                            }
                        }
                    }

                    if (this.TICKGLIDE) {
                        const targetVector = this.getAimVectorForTarget(
                            this.currentTarget
                        );

                        if (this.currentTarget && targetVector)
                            Rotations.rotateTo(
                                targetVector,
                                false,
                                this.rotationSpeed
                            );

                        if (
                            this.tickCount > this.totalTicks ||
                            this.allowScan
                        ) {
                            this.tickCount = 0;
                            this.allowScan = false;
                            this.scanForBlock(
                                this.COSTTYPE,
                                true,
                                null,
                                this.currentTarget
                            );
                        }
                    } else if (!this.TICKGLIDE) {
                        this.currentTarget = lowestCostBlock;
                        const targetVector = this.getAimVectorForTarget(
                            this.currentTarget
                        );

                        if (
                            blockName.includes('air') ||
                            blockName.includes('bedrock') ||
                            this.allowScan
                        ) {
                            this.scanForBlock(this.COSTTYPE, true, {
                                x: this.currentTarget.x,
                                y: this.currentTarget.y,
                                z: this.currentTarget.z,
                            });
                            this.lowestCostBlockIndex = 0;
                            this.allowScan = false;
                        }

                        if (this.currentTarget && targetVector)
                            Rotations.rotateTo(
                                targetVector,
                                false,
                                this.rotationSpeed
                            );
                    }
                    break;
            }
        });

        registerEventSB('abilityready', () => {
            this.state = this.STATES.ABILITY;
        });

        registerEventSB('abilityused', () => {
            if (this.ability === 'SpeedBoost') this.speedBoost = true;
        });

        registerEventSB('abilitygone', () => (this.speedBoost = false));

        addToggle(
            'Modules',
            'Mining Bot',
            'Tick Gliding',
            (value) => {
                this.TICKGLIDE = value;
            },
            'Predicts when blocks are broken to begin mining the next block early.'
        );
        addToggle(
            'Modules',
            'Mining Bot',
            'Jasper Drill Exploit',
            (value) => {
                value ? this.exploit.register() : this.exploit.unregister();
            },
            'Left click a gemstone with a Gemstone Drill to activate exploit. (Permanent +800 Mining speed)'
        );
        addToggle(
            'Modules',
            'Mining Bot',
            'Prioritze Titanium',
            (value) => {
                this.PRIORITIZE_TITANIUM = value;
            },
            'Whenever Titanium is in range it will be targeted the most'
        );
        addMultiToggle(
            'Modules',
            'Mining Bot',
            'Fakelook',
            ['Off', 'Instant', 'Queued'],
            true,
            (value) => {
                this.FAKELOOK = value;
            },
            'Fakelook begins to mine blocks before the player looks at them.'
        );
        addMultiToggle(
            'Modules',
            'Mining Bot',
            'Types',
            ['Mithril', 'Gemstone', 'Ore'],
            true,
            (value) => {
                this.TYPE = value;
            },
            'Targets specified block type.'
        );
        addToggle(
            'Modules',
            'Mining Bot',
            'Debug Mode',
            (value) => {
                value ? this.debug.register() : this.debug.unregister();
            },
            'Debugging - not recommended for average use.'
        );
        addToggle(
            'Modules',
            'Mining Bot',
            'Scan Mode',
            (value) => {
                this.SCAN_ONLY = value;
            },
            'Continuously scans for targets every tick.'
        );

        this.faceReach = 4.5;
        this.bfsPad = Math.sqrt(3) * 0.5; // ~0.866, half-diagonal of a block
        this.rotationSpeed = 75; // rotation time (ms)
    }

    /**
     * Returns the aim vector for a target block, preferring precomputed aim (aimX/Y/Z)
     * and falling back to the block center when not provided.
     * @param {{x:number,y:number,z:number,aimX?:number,aimY?:number,aimZ?:number}|null} target
     * @returns {number[]|null} [x,y,z] or null if target missing
     */
    getAimVectorForTarget(target) {
        if (!target) return null;
        const ax = target.aimX !== undefined ? target.aimX : target.x + 0.5;
        const ay = target.aimY !== undefined ? target.aimY : target.y + 0.5;
        const az = target.aimZ !== undefined ? target.aimZ : target.z + 0.5;
        return [ax, ay, az];
    }

    scanForBlock(
        target,
        specific = true,
        startPos = null,
        excludedBlock = null
    ) {
        const playerX = Player.getX();
        const playerY = Player.getY();
        const playerZ = Player.getZ();
        const playerEyePos = Player.getPlayer().getEyePos();
        const viewVector = Player.asPlayerMP().getLookVector();

        const INSET = 0.48; // near-face probe inset
        const FACE_INSET = 0.48; // where we actually aim on the face (avoid exact 0.5)
        const EDGE_MAG = 0.45; // tangential edge magnitude (avoid exact edges)
        const LO = 0.02,
            HI = 0.98;
        const MID_CAP = 0.35; // cap how far from face center mid samples go
        const JITTER = 0.05; // randomisation
        const ORTH_OFFSETS = [0, 0.35, -0.35];
        const ORTH_ORDER = [1, 2, 0].sort(() => Math.random() - 0.5); // randomise order each call

        const mineReach = 4.5;
        const mineReachSq = mineReach * mineReach; // 20.25 when faceReach=4.5

        // BFS pad so centers beyond reach are still scanned when their face is within reach
        const bfsReach = mineReach + this.bfsPad; // 4.5 + ~0.866
        const bfsReachSq = bfsReach * bfsReach;

        this.tickCount = 0;

        const start = startPos || {
            x: Math.floor(playerX),
            y: Math.floor(playerY),
            z: Math.floor(playerZ),
        };

        const excluded = excludedBlock || null;

        const foundLocations = [];

        const queue = [{ x: start.x, y: start.y, z: start.z }];
        let head = 0;

        // Compact visited bitset over a local bounding box for optimisation
        const minBx = Math.floor(playerEyePos.x - bfsReach) - 1;
        const maxBx = Math.floor(playerEyePos.x + bfsReach) + 1;
        const minBy = Math.floor(playerEyePos.y - bfsReach) - 1;
        const maxBy = Math.floor(playerEyePos.y + bfsReach) + 1;
        const minBz = Math.floor(playerEyePos.z - bfsReach) - 1;
        const maxBz = Math.floor(playerEyePos.z + bfsReach) + 1;
        const dimX = maxBx - minBx + 1;
        const dimY = maxBy - minBy + 1;
        const dimZ = maxBz - minBz + 1;
        const size = dimX * dimY * dimZ;
        const visited = new Uint8Array(size);
        const idxOf = (xx, yy, zz) =>
            xx - minBx + dimX * (yy - minBy + dimY * (zz - minBz));
        const setVisited = (idx) => (visited[idx] = 1);
        const isVisited = (idx) => visited[idx] === 1;
        setVisited(idxOf(start.x, start.y, start.z));

        const directions = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];

        while (head < queue.length) {
            const { x, y, z } = queue[head++];

            if (
                excluded &&
                x === excluded.x &&
                y === excluded.y &&
                z === excluded.z
            ) {
                continue;
            }

            const block = World.getBlockAt(x, y, z);
            const blockName = block?.type?.getRegistryName();

            let isTargetBlock = false;
            if (blockName) {
                if (specific) {
                    isTargetBlock = Object.prototype.hasOwnProperty.call(
                        target,
                        blockName
                    );
                } else {
                    isTargetBlock = blockName in target;
                }
            }

            if (isTargetBlock) {
                const centerX = x + 0.5;
                const centerY = y + 0.5;
                const centerZ = z + 0.5;

                // Vector from eyes to block center (used to pick dominant face)
                const vX = centerX - playerEyePos.x;
                const vY = centerY - playerEyePos.y;
                const vZ = centerZ - playerEyePos.z;

                // Pick the true near face via AABB entry along eye->center ray
                const ex = playerEyePos.x,
                    ey = playerEyePos.y,
                    ez = playerEyePos.z;
                const dirX = vX,
                    dirY = vY,
                    dirZ = vZ;
                const minX = x,
                    maxX = x + 1,
                    minY = y,
                    maxY = y + 1,
                    minZ = z,
                    maxZ = z + 1;
                const invX = 1 / dirX;
                const invY = 1 / dirY;
                const invZ = 1 / dirZ;
                const tx1 = (minX - ex) * invX;
                const tx2 = (maxX - ex) * invX;
                const ty1 = (minY - ey) * invY;
                const ty2 = (maxY - ey) * invY;
                const tz1 = (minZ - ez) * invZ;
                const tz2 = (maxZ - ez) * invZ;
                const tminX = Math.min(tx1, tx2);
                const tminY = Math.min(ty1, ty2);
                const tminZ = Math.min(tz1, tz2);
                const tEntry = Math.max(tminX, tminY, tminZ);

                let faceAxis = 'x';
                if (tEntry === tminY) faceAxis = 'y';
                else if (tEntry === tminZ) faceAxis = 'z';

                const s =
                    faceAxis === 'x'
                        ? dirX > 0
                            ? -1
                            : 1
                        : faceAxis === 'y'
                          ? dirY > 0
                              ? -1
                              : 1
                          : dirZ > 0
                            ? -1
                            : 1;

                const clamp = (vv, lo, hi) =>
                    vv < lo ? lo : vv > hi ? hi : vv;

                // fov culling: skip ray tests for blocks clearly behind view
                const vLen = Math.sqrt(vX * vX + vY * vY + vZ * vZ) || 1;
                const dotToCenter =
                    (vX * viewVector.x +
                        vY * viewVector.y +
                        vZ * viewVector.z) /
                    vLen;
                if (dotToCenter >= -0.05) {
                    let isVisible = false;
                    let aimX = centerX,
                        aimY = centerY,
                        aimZ = centerZ;
                    const randJ = (m) => (Math.random() * 2 - 1) * m;
                    const lineClearWithJitter = (
                        axis,
                        ttx,
                        tty,
                        ttz,
                        ffx,
                        ffy,
                        ffz
                    ) => {
                        let ttx2 = ttx,
                            tty2 = tty,
                            ttz2 = ttz,
                            ffx2 = ffx,
                            ffy2 = ffy,
                            ffz2 = ffz;
                        const jU = randJ(JITTER);
                        const jV = randJ(JITTER);
                        if (axis === 'x') {
                            tty2 = clamp(tty + jU, y + LO, y + HI);
                            ttz2 = clamp(ttz + jV, z + LO, z + HI);
                            ffy2 = clamp(ffy + jU, y + LO, y + HI);
                            ffz2 = clamp(ffz + jV, z + LO, z + HI);
                        } else if (axis === 'y') {
                            ttx2 = clamp(ttx + jU, x + LO, x + HI);
                            ttz2 = clamp(ttz + jV, z + LO, z + HI);
                            ffx2 = clamp(ffx + jU, x + LO, x + HI);
                            ffz2 = clamp(ffz + jV, z + LO, z + HI);
                        } else {
                            // axis === 'z'
                            ttx2 = clamp(ttx + jU, x + LO, x + HI);
                            tty2 = clamp(tty + jV, y + LO, y + HI);
                            ffx2 = clamp(ffx + jU, x + LO, x + HI);
                            ffy2 = clamp(ffy + jV, y + LO, y + HI);
                        }
                        const clear = RayTrace.isLineClear(
                            ex,
                            ey,
                            ez,
                            ttx2,
                            tty2,
                            ttz2,
                            x,
                            y,
                            z
                        );
                        return { clear, fx: ffx2, fy: ffy2, fz: ffz2 };
                    };
                    const tryLine = (ttx, tty, ttz, ffx, ffy, ffz) => {
                        if (isVisible) return false;
                        const res = lineClearWithJitter(
                            faceAxis,
                            ttx,
                            tty,
                            ttz,
                            ffx,
                            ffy,
                            ffz
                        );
                        if (res.clear) {
                            isVisible = true;
                            aimX = res.fx;
                            aimY = res.fy;
                            aimZ = res.fz;
                            return true;
                        }
                        return false;
                    };
                    if (faceAxis === 'x') {
                        const uRaw = clamp(ey, y + LO, y + HI) - centerY;
                        const vRaw = clamp(ez, z + LO, z + HI) - centerZ;
                        const uMid = Math.max(
                            -MID_CAP,
                            Math.min(MID_CAP, uRaw)
                        );
                        const vMid = Math.max(
                            -MID_CAP,
                            Math.min(MID_CAP, vRaw)
                        );
                        const uEdge = uRaw >= 0 ? EDGE_MAG : -EDGE_MAG;
                        const vEdge = vRaw >= 0 ? EDGE_MAG : -EDGE_MAG;
                        // modest mid toward eye projection FIRST
                        tryLine(
                            centerX + s * INSET,
                            centerY + uMid,
                            centerZ + vMid,
                            centerX + s * FACE_INSET,
                            centerY + uMid,
                            centerZ + vMid
                        );
                        // center next
                        tryLine(
                            centerX + s * INSET,
                            centerY,
                            centerZ,
                            centerX + s * FACE_INSET,
                            centerY,
                            centerZ
                        );
                        // edges only if needed (aim slightly inset, not exactly on edges)
                        tryLine(
                            centerX + s * INSET,
                            centerY + uEdge,
                            centerZ,
                            centerX + s * FACE_INSET,
                            centerY + uEdge,
                            centerZ
                        );
                        tryLine(
                            centerX + s * INSET,
                            centerY,
                            centerZ + vEdge,
                            centerX + s * FACE_INSET,
                            centerY,
                            centerZ + vEdge
                        );
                    } else if (faceAxis === 'y') {
                        const uRaw = clamp(ex, x + LO, x + HI) - centerX;
                        const vRaw = clamp(ez, z + LO, z + HI) - centerZ;
                        const uMid = Math.max(
                            -MID_CAP,
                            Math.min(MID_CAP, uRaw)
                        );
                        const vMid = Math.max(
                            -MID_CAP,
                            Math.min(MID_CAP, vRaw)
                        );
                        const uEdge = uRaw >= 0 ? EDGE_MAG : -EDGE_MAG;
                        const vEdge = vRaw >= 0 ? EDGE_MAG : -EDGE_MAG;
                        // mid first
                        tryLine(
                            centerX + uMid,
                            centerY + s * INSET,
                            centerZ + vMid,
                            centerX + uMid,
                            centerY + s * FACE_INSET,
                            centerZ + vMid
                        );
                        // center next
                        tryLine(
                            centerX,
                            centerY + s * INSET,
                            centerZ,
                            centerX,
                            centerY + s * FACE_INSET,
                            centerZ
                        );
                        // edges (aim inset)
                        tryLine(
                            centerX + uEdge,
                            centerY + s * INSET,
                            centerZ,
                            centerX + uEdge,
                            centerY + s * FACE_INSET,
                            centerZ
                        );
                        tryLine(
                            centerX,
                            centerY + s * INSET,
                            centerZ + vEdge,
                            centerX,
                            centerY + s * FACE_INSET,
                            centerZ + vEdge
                        );
                    } else {
                        const uRaw = clamp(ex, x + LO, x + HI) - centerX;
                        const vRaw = clamp(ey, y + LO, y + HI) - centerY;
                        const uMid = Math.max(
                            -MID_CAP,
                            Math.min(MID_CAP, uRaw)
                        );
                        const vMid = Math.max(
                            -MID_CAP,
                            Math.min(MID_CAP, vRaw)
                        );
                        const uEdge = uRaw >= 0 ? EDGE_MAG : -EDGE_MAG;
                        const vEdge = vRaw >= 0 ? EDGE_MAG : -EDGE_MAG;
                        // mid first
                        tryLine(
                            centerX + uMid,
                            centerY + vMid,
                            centerZ + s * INSET,
                            centerX + uMid,
                            centerY + vMid,
                            centerZ + s * FACE_INSET
                        );
                        // center next
                        tryLine(
                            centerX,
                            centerY,
                            centerZ + s * INSET,
                            centerX,
                            centerY,
                            centerZ + s * FACE_INSET
                        );
                        tryLine(
                            centerX + uEdge,
                            centerY,
                            centerZ + s * INSET,
                            centerX + uEdge,
                            centerY,
                            centerZ + s * FACE_INSET
                        );
                        tryLine(
                            centerX,
                            centerY + vEdge,
                            centerZ + s * INSET,
                            centerX,
                            centerY + vEdge,
                            centerZ + s * FACE_INSET
                        );
                    }

                    // If near face was fully blocked, try the two orthogonal faces
                    if (!isVisible) {
                        const orthos = ['x', 'y', 'z'].filter(
                            (a) => a !== faceAxis
                        );
                        const signFromEye = (axis) =>
                            axis === 'x'
                                ? playerEyePos.x >= centerX
                                    ? 1
                                    : -1
                                : axis === 'y'
                                  ? playerEyePos.y >= centerY
                                      ? 1
                                      : -1
                                  : playerEyePos.z >= centerZ
                                    ? 1
                                    : -1;
                        for (let o = 0; o < orthos.length && !isVisible; o++) {
                            const axis = orthos[o];
                            const s = signFromEye(axis);
                            // Prefer non-center offsets before trying center
                            for (let oi = 0; oi < 3; oi++) {
                                const i = ORTH_ORDER[oi];
                                const u = i === 0 ? 0 : ORTH_OFFSETS[i];
                                const v = i === 0 ? 0 : ORTH_OFFSETS[i];
                                let tx = centerX,
                                    ty = centerY,
                                    tz = centerZ;
                                let fx = centerX,
                                    fy = centerY,
                                    fz = centerZ;
                                if (axis === 'x') {
                                    tx = centerX + s * INSET;
                                    ty = centerY + u;
                                    tz = centerZ + v;
                                    fx = centerX + s * FACE_INSET;
                                    fy = centerY + u;
                                    fz = centerZ + v;
                                } else if (axis === 'y') {
                                    ty = centerY + s * INSET;
                                    tx = centerX + u;
                                    tz = centerZ + v;
                                    fy = centerY + s * FACE_INSET;
                                    fx = centerX + u;
                                    fz = centerZ + v;
                                } else {
                                    tz = centerZ + s * INSET;
                                    tx = centerX + u;
                                    ty = centerY + v;
                                    fz = centerZ + s * FACE_INSET;
                                    fx = centerX + u;
                                    fy = centerY + v;
                                }
                                const res = lineClearWithJitter(
                                    axis,
                                    tx,
                                    ty,
                                    tz,
                                    fx,
                                    fy,
                                    fz
                                );
                                if (res.clear) {
                                    isVisible = true;
                                    aimX = res.fx;
                                    aimY = res.fy;
                                    aimZ = res.fz;
                                    faceAxis = axis;
                                    break;
                                }
                            }
                        }
                    }

                    if (isVisible) {
                        const adx = aimX - playerEyePos.x;
                        const ady = aimY - playerEyePos.y;
                        const adz = aimZ - playerEyePos.z;
                        const aimDistSq = adx * adx + ady * ady + adz * adz;
                        const aimInReach = aimDistSq <= mineReachSq;

                        if (!aimInReach) {
                            continue;
                        }

                        const useDist = Math.sqrt(aimDistSq) || 1;

                        const dotProduct =
                            (adx * viewVector.x +
                                ady * viewVector.y +
                                adz * viewVector.z) /
                            useDist;

                        const baseCost = target[blockName] || 10;
                        const distanceCost = useDist * 2; // Distance penalty (closer = lower cost)
                        const fovCost = -dotProduct * 50; // Favor blocks in center of view
                        const totalCost = baseCost + distanceCost + fovCost;

                        foundLocations.push({
                            x,
                            y,
                            z,
                            cost: totalCost,
                            aimX,
                            aimY,
                            aimZ,
                        });
                    }
                }
            }

            for (let i = 0; i < directions.length; i++) {
                const [dx, dy, dz] = directions[i];
                const nextX = x + dx;
                const nextY = y + dy;
                const nextZ = z + dz;
                if (!isVisited(idxOf(nextX, nextY, nextZ))) {
                    const ddx = nextX + 0.5 - playerEyePos.x;
                    const ddy = nextY + 0.5 - playerEyePos.y;
                    const ddz = nextZ + 0.5 - playerEyePos.z;
                    const distSq = ddx * ddx + ddy * ddy + ddz * ddz;
                    if (distSq <= bfsReachSq) {
                        setVisited(vIndex);
                        queue.push({ x: nextX, y: nextY, z: nextZ });
                    }
                }
            }
        }

        // Sort by cost (ascending) and set the first as current target
        if (foundLocations.length > 0) {
            foundLocations.sort((a, b) => a.cost - b.cost);
            this.nuking = false;
            this.foundLocations = foundLocations;
            this.currentTarget = this.foundLocations[0];
            this.lowestCostBlockIndex = 0;
            this.empty = false;
        } else {
            this.empty = true;
        }
    }

    setCost(cost) {
        this.COSTTYPE = cost;
    }

    onEnable() {
        Chat.message('Mining Bot Enabled');
        this.empty = false;
        this.allowScan = true;
        this.state = this.STATES.ABILITY;
    }

    onDisable() {
        Chat.message('Mining Bot Disabled');
        this.state = this.STATES.WAITING;
        Keybind.setKey('leftclick', false);
        this.foundLocations = [];
        this.lastBlockPos = null;
        this.currentTarget = null;
        this.tickCount = 0;
        this.empty = false;
    }
}

export const MiningBot = new Bot();
