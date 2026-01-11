import { Keybind } from '../../utils/player/Keybinding';
import { MiningUtils } from '../../utils/MiningUtils';
import { RayTrace } from '../../utils/Raytrace';
import { Rotations } from '../../utils/player/Rotations';
import { Utils } from '../../utils/Utils';
import { MathUtils } from '../../utils/Math';
import { Chat } from '../../utils/Chat';
import { manager } from '../../utils/SkyblockEvents';
import { Guis } from '../../utils/player/Inventory';
import { NukerUtils } from '../../utils/NukerUtils';
import RenderUtils from '../../utils/render/RendererUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { Vec3d, MCHand } from '../../utils/Constants';
import { PlayerActionC2S, PlayerInteractItemC2S } from '../../utils/Packets';

class Bot extends ModuleBase {
    constructor() {
        super({
            name: 'Mining Bot',
            subcategory: 'Mining',
            description: 'Universal settings for Mining & block miner',
            tooltip: 'Automatically mines.',
            showEnabledToggle: false,
            isMacro: true,
        });

        this.foundLocations = [];
        this.lowestCostBlockIndex = 0;

        this.PRIORITIZE_TITANIUM = true;
        this.TICKGLIDE = true;
        this.FAKELOOK = false;
        this.MOVEMENT = false;
        this.SCAN_ONLY = false;
        this.DEBUG_MODE = false;

        this.STATES = { WAITING: 0, ABILITY: 1, MINING: 2, BUFF: 3, REFUEL: 4 };
        this.TYPES = { MININGBOT: 0, COMMISSION: 1, GEMSTONE: 2, ORE: 3, TUNNEL: 4 };

        this.state = this.STATES.WAITING;
        this.type = this.TYPES.MININGBOT;
        this.TYPE = null;

        this.COSTTYPE = null;

        this.miningspeed = 0;
        this.currentTarget = null;
        this.lastBlockPos = null;
        this.lastBlockType = null;
        this.miningbot = null;
        this.ability = null;
        this.file = null;

        this.mineTickCount = 0;
        this.tickCount = 0;
        this.totalTicks = 0;
        this.allowScan = false;
        this.speedBoost = false;
        this.nukedBlock = false;

        this.lastGUI = Date.now();

        this.faceReach = 4.5;
        this.bfsPad = Math.sqrt(3) * 0.5;
        this.rotationSpeed = 75;

        this.initCosts();
        this.bindToggleKey();
        this.initEventHandlers();
        this.initSettings();
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
    }

    updateMithrilCosts() {
        this.mithrilCosts = {
            'minecraft:polished_diorite': this.PRIORITIZE_TITANIUM ? 1 : 12,
            'minecraft:light_blue_wool': 3,
            'minecraft:prismarine': 5,
            'minecraft:prismarine_bricks': 5,
            'minecraft:dark_prismarine': 5,
            'minecraft:gray_wool': 7,
            'minecraft:cyan_terracotta': 7,
        };
    }

    initEventHandlers() {
        this.exploit = register('packetSent', (packet, event) => {
            if (packet?.getAction()?.toString() === 'ABORT_DESTROY_BLOCK') cancel(event);
        })
            .setFilteredClass(PlayerActionC2S)
            .unregister();

        this.debug = register('postRenderWorld', () => this.renderDebug()).unregister();
        this.normalRender = register('postRenderWorld', () => this.renderNormal()).unregister();

        this.on('tick', () => {
            if (Client.isInChat() || Client.isInGui()) return (this.lastGUI = Date.now());

            switch (this.state) {
                case this.STATES.ABILITY:
                    this.handleAbilityState();
                    break;
                case this.STATES.MINING:
                    this.handleMiningState();
                    break;
            }
        });

        manager.subscribe('abilityready', () => {
            this.resetMining();
            this.state = this.STATES.ABILITY;
        });
        manager.subscribe('abilityused', () => {
            if (this.ability === 'SpeedBoost') this.speedBoost = true;
            this.resetMining();
        });
        manager.subscribe('abilitygone', () => {
            this.speedBoost = false;
            this.resetMining();
        });
    }

    resetMining() {
        if (this.state !== this.STATES.MINING && this.state !== this.STATES.ABILITY) return;

        this.mineTickCount = 0;
        this.tickCount = 0;
    }

    initSettings() {
        this.addToggle(
            'Tick Gliding',
            (value) => {
                this.TICKGLIDE = value;
            },
            'Predicts when blocks are broken to begin mining the next block early.',
            true
        );
        this.addToggle(
            'Jasper Drill Exploit',
            (value) => {
                value ? this.exploit.register() : this.exploit.unregister();
            },
            'Left click a gemstone with a Gemstone Drill to activate exploit.'
        );
        this.addToggle(
            'Prioritze Titanium',
            (value) => {
                this.setPrioritizeTitanium(value);
            },
            'Whenever Titanium is in range it will be targeted the most'
        );
        this.addMultiToggle(
            'Fakelook',
            ['Off', 'Instant', 'Queued'],
            true,
            (value) => {
                this.FAKELOOK = value;
            },
            'Fakelook begins to mine blocks before the player looks at them.',
            'Off'
        );
        this.addMultiToggle(
            'Types',
            ['Mithril', 'Gemstone', 'Ore'],
            true,
            (value) => {
                this.TYPE = value;
                this.setCost();
            },
            'Targets specified block type.',
            'Mithril'
        );
        this.addToggle(
            'Debug Mode',
            (value) => {
                this.DEBUG_MODE = value;
                value ? this.debug.register() : this.debug.unregister();
            },
            'Debugging - not recommended for average use.'
        );
        this.addToggle(
            'Scan Mode',
            (value) => {
                this.SCAN_ONLY = value;
            },
            'Continuously scans for targets every tick.'
        );
    }

    setPrioritizeTitanium(value) {
        this.PRIORITIZE_TITANIUM = value;
        this.updateMithrilCosts();
    }

    handleAbilityState() {
        if (this.SCAN_ONLY) {
            this.state = this.STATES.MINING;
            return;
        }

        const tabNames = TabList.getNames();
        let abilityStatus = '';

        for (let i = 0; i < tabNames.length; i++) {
            let rawLine = tabNames[i].getName().toString();

            let line = rawLine.replace(/§[0-9a-fk-or]/gi, '').trim();

            if (line.includes('Pickaxe Ability')) {
                if (tabNames[i + 1]) {
                    abilityStatus = tabNames[i + 1]
                        .getName()
                        .toString()
                        .replace(/§[0-9a-fk-or]/gi, '')
                        .trim();
                }
                break;
            }
        }

        if (!abilityStatus.includes('Available')) {
            this.state = this.STATES.MINING;
            return;
        }

        const { drill } = MiningUtils.getDrills();
        if (!drill) {
            Chat.message('&cNo drill found in ABILITY state!');
            this.toggle(false);
            return;
        }

        if (Player.getHeldItemIndex() !== drill.slot) {
            Guis.setItemSlot(drill.slot);
            return;
        }

        this.file = Utils.getConfigFile('miningstats.json');
        if (this.file) {
            this.ability = this.file.ability;
        }

        const hasAbility = this.ability && this.ability !== 'none' && this.ability !== 'None' && this.ability !== '';

        if (hasAbility) {
            let packet = new PlayerInteractItemC2S(Hand.MAIN_HAND, 0, Player.yaw, Player.pitch);
            Client.sendPacket(packet);
        }

        this.state = this.STATES.MINING;
        if (!this.manualScan) {
            this.scanForBlock(this.COSTTYPE);
        }
    }

    handleMiningState() {
        if (this.SCAN_ONLY) {
            this.scanForBlock(this.COSTTYPE);
            return;
        }

        const { drill } = MiningUtils.getDrills();
        if (Player.getHeldItemIndex() !== drill.slot) {
            Guis.setItemSlot(drill.slot);
            return;
        }

        let needScan = !this.currentTarget || this.allowScan;
        if (!needScan) {
            const block = World.getBlockAt(this.currentTarget.x, this.currentTarget.y, this.currentTarget.z);
            const blockName = block?.type?.getRegistryName();
            if (blockName.includes('air') || blockName.includes('bedrock')) {
                needScan = true;
            }
        }

        if (needScan) {
            if (this.manualScan) {
                let currentBlock = this.currentTarget ? World.getBlockAt(this.currentTarget.x, this.currentTarget.y, this.currentTarget.z) : null;
                let currentReg = currentBlock?.type?.getRegistryName() || '';

                if (this.currentTarget === null || currentReg.includes('air') || currentReg.includes('bedrock')) {
                    this.lowestCostBlockIndex++;
                    this.nukedBlock = false;

                    if (this.lowestCostBlockIndex >= this.foundLocations.length) {
                        this.foundLocations = [];
                        return;
                    }

                    this.currentTarget = this.foundLocations[this.lowestCostBlockIndex];
                    this.mineTickCount = 0;
                    this.tickCount = 0;
                }
            } else {
                this.scanForBlock(this.COSTTYPE, null, this.currentTarget);
                this.currentTarget = this.foundLocations[0];
                this.lowestCostBlockIndex = 0;
            }
            this.allowScan = false;
        }

        let lowestCostBlock = this.currentTarget || this.foundLocations[this.lowestCostBlockIndex];
        if (!lowestCostBlock) return;

        let block = World.getBlockAt(lowestCostBlock.x, lowestCostBlock.y, lowestCostBlock.z);
        let blockName = block?.type?.getRegistryName();

        if (
            this.lastBlockPos &&
            this.lastBlockPos.x === lowestCostBlock.x &&
            this.lastBlockPos.y === lowestCostBlock.y &&
            this.lastBlockPos.z === lowestCostBlock.z &&
            this.lastBlockType &&
            this.lastBlockType !== blockName
        ) {
            if (!blockName.includes('air') && !blockName.includes('bedrock')) {
                this.lastBlockType = blockName;
                this.resetMining();
                return;
            }
        }

        if (
            !this.lastBlockPos ||
            this.lastBlockPos.x !== lowestCostBlock.x ||
            this.lastBlockPos.y !== lowestCostBlock.y ||
            this.lastBlockPos.z !== lowestCostBlock.z
        ) {
            this.mineTickCount = 0;
            this.tickCount = 0;
            this.lastBlockPos = lowestCostBlock;
            this.lastBlockType = blockName;
            this.nukedBlock = false;
        }

        this.currentTarget = this.foundLocations[this.lowestCostBlockIndex];

        let lookingAt = Player.lookingAt();
        if (
            lookingAt &&
            lookingAt.getX() === this.currentTarget?.x &&
            lookingAt.getY() === this.currentTarget?.y &&
            lookingAt.getZ() === this.currentTarget?.z
        ) {
            this.mineTickCount++;
        }
        this.tickCount++;

        const fakeLookMode = this.FAKELOOK.find((option) => option.enabled)?.name;
        if (fakeLookMode === 'Off') {
            if (!Player.toMC().handSwinging && Date.now() - this.lastGUI > 100) {
                Keybind.setKey('leftclick', true);
                this.lastGUI = Date.now(); // stupid fix
            }
        }

        this.miningspeed = this.type === this.TYPES.TUNNEL ? MiningUtils.getSpeedWithCold() : MiningUtils.getMiningSpeed();
        this.totalTicks = MiningUtils.getMineTime(this.miningspeed, this.speedBoost, this.currentTarget);

        if (!this.currentTarget) return;
        const blockDist = MathUtils.getDistanceToPlayerEyes(this.currentTarget.x, this.currentTarget.y, this.currentTarget.z).distance;
        if (this.COSTTYPE === this.gemstoneCosts) {
            if (blockDist < 1) Keybind.setKey('s', true);
            else if (blockDist > 4.5) Keybind.setKey('w', true);
            else Keybind.stopMovement();
        }

        if (fakeLookMode !== 'Off') {
            Keybind.setKey('leftclick', false);
            if (blockName.includes('air') || blockName.includes('bedrock')) {
                this.lowestCostBlockIndex++;
            }
            if (this.currentTarget && !this.nukedBlock) {
                const pos = [this.currentTarget.x, this.currentTarget.y, this.currentTarget.z];
                if (fakeLookMode === 'Instant') NukerUtils.nuke(pos, this.totalTicks);
                else if (fakeLookMode === 'Queued') NukerUtils.nukeQueueAdd(pos, this.totalTicks);
                this.nukedBlock = true;
            }
        }
        const shouldRotate = this.TICKGLIDE
            ? this.mineTickCount > this.totalTicks || this.tickCount > this.totalTicks * 2 || this.allowScan
            : !this.currentTarget || blockName.includes('air') || blockName.includes('bedrock') || this.allowScan;

        if (shouldRotate) {
            if (this.manualScan) {
                this.allowScan = true;
                this.mineTickCount = 0;
                this.tickCount = 0;
            } else {
                if (!this.TICKGLIDE) {
                    this.scanForBlock(this.COSTTYPE, this.currentTarget ? { x: this.currentTarget.x, y: this.currentTarget.y, z: this.currentTarget.z } : null);
                    this.currentTarget = this.foundLocations[0];
                } else {
                    this.mineTickCount = 0;
                    this.tickCount = 0;
                    this.scanForBlock(this.COSTTYPE, null, this.currentTarget);
                }
                this.allowScan = false;
            }
        }

        const targetVector = this.getAimVectorForTarget(this.currentTarget);
        if (this.currentTarget && targetVector) {
            Rotations.rotateToVector(targetVector);
        }
    }

    scanForBlock(targetCosts, startPos = null, excludedBlock = null) {
        if (!targetCosts) return Chat.message('No target specified, is cost type set?');

        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();
        const eyePos = Player.getPlayer().getEyePos();
        const lookVec = Player.asPlayerMP().getLookVector();

        const start = startPos || { x: Math.floor(pX), y: Math.floor(pY), z: Math.floor(pZ) };
        const found = [];
        const queue = [{ x: start.x, y: start.y, z: start.z }];
        let head = 0;

        const reach = 4.5 + this.bfsPad;
        const minBx = Math.floor(eyePos.x - reach) - 1,
            dimX = Math.floor(eyePos.x + reach) + 1 - minBx + 1;
        const minBy = Math.floor(eyePos.y - reach) - 1,
            dimY = Math.floor(eyePos.y + reach) + 1 - minBy + 1;
        const minBz = Math.floor(eyePos.z - reach) - 1,
            dimZ = Math.floor(eyePos.z + reach) + 1 - minBz + 1;
        const visited = new Uint8Array(dimX * dimY * dimZ);

        const idxOf = (x, y, z) => x - minBx + dimX * (y - minBy + dimY * (z - minBz));
        const isVisited = (idx) => visited[idx] === 1;
        const setVisited = (idx) => (visited[idx] = 1);
        setVisited(idxOf(start.x, start.y, start.z));

        const bfsReachSq = reach * reach;
        const mineReachSq = 4.5 * 4.5;

        while (head < queue.length) {
            const { x, y, z } = queue[head++];

            if (excludedBlock && x === excludedBlock.x && y === excludedBlock.y && z === excludedBlock.z) continue;

            const block = World.getBlockAt(x, y, z);
            if (!block || !block.type) continue;
            const blockName = block.type.getRegistryName();
            if (!blockName || !(blockName in targetCosts)) {
            } else {
                const aimData = this.findVisibleAimPoint(x, y, z, eyePos, lookVec, mineReachSq);

                if (aimData) {
                    const cost = this.calculateBlockCost(targetCosts[blockName], aimData.dist, aimData.dot);
                    found.push({
                        x,
                        y,
                        z,
                        cost,
                        aimX: aimData.x,
                        aimY: aimData.y,
                        aimZ: aimData.z,
                    });
                }
            }

            const dirs = [
                [1, 0, 0],
                [-1, 0, 0],
                [0, 1, 0],
                [0, -1, 0],
                [0, 0, 1],
                [0, 0, -1],
            ];
            for (let i = 0; i < 6; i++) {
                const nx = x + dirs[i][0],
                    ny = y + dirs[i][1],
                    nz = z + dirs[i][2];
                const vIdx = idxOf(nx, ny, nz);
                if (!isVisited(vIdx)) {
                    const ddx = nx + 0.5 - eyePos.x;
                    const ddy = ny + 0.5 - eyePos.y;
                    const ddz = nz + 0.5 - eyePos.z;
                    if (ddx * ddx + ddy * ddy + ddz * ddz <= bfsReachSq) {
                        setVisited(vIdx);
                        queue.push({ x: nx, y: ny, z: nz });
                    }
                }
            }
        }

        if (found.length > 0) {
            found.sort((a, b) => a.cost - b.cost);
            this.nukedBlock = false;
            this.foundLocations = found;
            this.currentTarget = this.foundLocations[0];
            this.lowestCostBlockIndex = 0;
        } else {
            this.currentTarget = null;
            this.foundLocations = [];
            this.lowestCostBlockIndex = 0;
        }
    }

    findVisibleAimPoint(x, y, z, eyePos, lookVec, maxReachSq, checkFov = true) {
        const cx = x + 0.5,
            cy = y + 0.5,
            cz = z + 0.5;
        const vx = cx - eyePos.x,
            vy = cy - eyePos.y,
            vz = cz - eyePos.z;
        const vLenSq = vx * vx + vy * vy + vz * vz;
        if (vLenSq === 0) return null;

        if (checkFov && lookVec) {
            const vLen = Math.sqrt(vLenSq);
            const dotToCenter = (vx * lookVec.x + vy * lookVec.y + vz * lookVec.z) / vLen;
            if (dotToCenter < -0.05) return null;
        }

        const invX = 1 / vx,
            invY = 1 / vy,
            invZ = 1 / vz;
        const tx1 = (x - eyePos.x) * invX,
            tx2 = (x + 1 - eyePos.x) * invX;
        const ty1 = (y - eyePos.y) * invY,
            ty2 = (y + 1 - eyePos.y) * invY;
        const tz1 = (z - eyePos.z) * invZ,
            tz2 = (z + 1 - eyePos.z) * invZ;

        const tminX = tx1 < tx2 ? tx1 : tx2;
        const tminY = ty1 < ty2 ? ty1 : ty2;
        const tminZ = tz1 < tz2 ? tz1 : tz2;

        const tEntry = tminX > tminY ? (tminX > tminZ ? tminX : tminZ) : tminY > tminZ ? tminY : tminZ;

        let faceAxis = 'x';
        if (tEntry === tminY) faceAxis = 'y';
        else if (tEntry === tminZ) faceAxis = 'z';

        const s = faceAxis === 'x' ? (vx > 0 ? -1 : 1) : faceAxis === 'y' ? (vy > 0 ? -1 : 1) : vz > 0 ? -1 : 1;

        const INSET = 0.48,
            FACE_INSET = 0.48,
            EDGE_MAG = 0.45,
            MID_CAP = 0.3;
        const LO = 0.02,
            HI = 0.98;
        const clamp = (v, l, h) => (v < l ? l : v > h ? h : v);

        const checkLine = (axis, ttx, tty, ttz, ffx, ffy, ffz) => {
            const jU = 0,
                jV = 0;
            let tx = ttx,
                ty = tty,
                tz = ttz,
                fx = ffx,
                fy = ffy,
                fz = ffz;

            if (axis === 'x') {
                ty = clamp(tty + jU, y + LO, y + HI);
                tz = clamp(ttz + jV, z + LO, z + HI);
                fy = clamp(ffy + jU, y + LO, y + HI);
                fz = clamp(ffz + jV, z + LO, z + HI);
            } else if (axis === 'y') {
                tx = clamp(ttx + jU, x + LO, x + HI);
                tz = clamp(ttz + jV, z + LO, z + HI);
                fx = clamp(ffx + jU, x + LO, x + HI);
                fz = clamp(ffz + jV, z + LO, z + HI);
            } else {
                tx = clamp(ttx + jU, x + LO, x + HI);
                ty = clamp(tty + jV, y + LO, y + HI);
                fx = clamp(ffx + jU, x + LO, x + HI);
                fy = clamp(ffy + jV, y + LO, y + HI);
            }
            if (RayTrace.isLineClear(eyePos.x, eyePos.y, eyePos.z, tx, ty, tz, x, y, z)) {
                return { hit: true, x: fx, y: fy, z: fz };
            }
            return { hit: false };
        };

        let result = null;

        const tryFace = (axis) => {
            if (result) return;
            const isX = axis === 'x',
                isY = axis === 'y';

            const uRaw = clamp(isX ? eyePos.y : eyePos.x, (isX ? y : x) + LO, (isX ? y : x) + HI) - (isX ? cy : cx);
            const vRaw = clamp(isY ? eyePos.z : eyePos.y, (isY ? z : y) + LO, (isY ? z : y) + HI) - (isY ? cz : cy);

            const uMid = Math.max(-MID_CAP, Math.min(MID_CAP, uRaw));
            const vMid = Math.max(-MID_CAP, Math.min(MID_CAP, vRaw));
            const uEdge = uRaw >= 0 ? EDGE_MAG : -EDGE_MAG;
            const vEdge = vRaw >= 0 ? EDGE_MAG : -EDGE_MAG;

            const tryP = (u, v) => {
                if (result) return;
                let tx, ty, tz, fx, fy, fz;
                if (isX) {
                    tx = cx + s * INSET;
                    ty = cy + u;
                    tz = cz + v;
                    fx = cx + s * FACE_INSET;
                    fy = ty;
                    fz = tz;
                } else if (isY) {
                    tx = cx + u;
                    ty = cy + s * INSET;
                    tz = cz + v;
                    fx = tx;
                    fy = cy + s * FACE_INSET;
                    fz = tz;
                } else {
                    tx = cx + u;
                    ty = cy + v;
                    tz = cz + s * INSET;
                    fx = tx;
                    fy = ty;
                    fz = cz + s * FACE_INSET;
                }
                const hit = checkLine(axis, tx, ty, tz, fx, fy, fz);
                if (hit.hit) result = hit;
            };

            tryP(uMid, vMid);

            tryP(0, 0);

            tryP(uEdge, 0);

            tryP(0, vEdge);
        };

        tryFace(faceAxis);

        if (!result) {
            const orthos = ['x', 'y', 'z'].filter((a) => a !== faceAxis);
            const ORTH_OFFSETS = [0, 0.35, -0.35];
            const ORTH_ORDER = [1, 2, 0];

            for (let axis of orthos) {
                if (result) break;

                const sOrtho = axis === 'x' ? (eyePos.x >= cx ? 1 : -1) : axis === 'y' ? (eyePos.y >= cy ? 1 : -1) : eyePos.z >= cz ? 1 : -1;

                for (let idx of ORTH_ORDER) {
                    if (result) break;
                    const u = idx === 0 ? 0 : ORTH_OFFSETS[idx];
                    const v = idx === 0 ? 0 : ORTH_OFFSETS[idx];

                    let tx, ty, tz, fx, fy, fz;
                    if (axis === 'x') {
                        tx = cx + sOrtho * INSET;
                        ty = cy + u;
                        tz = cz + v;
                        fx = cx + sOrtho * FACE_INSET;
                        fy = cy + u;
                        fz = cz + v;
                    } else if (axis === 'y') {
                        ty = cy + sOrtho * INSET;
                        tx = cx + u;
                        tz = cz + v;
                        fy = cy + sOrtho * FACE_INSET;
                        fx = cx + u;
                        fz = cz + v;
                    } else {
                        tz = cz + sOrtho * INSET;
                        tx = cx + u;
                        ty = cy + v;
                        fz = cz + sOrtho * FACE_INSET;
                        fx = cx + u;
                        fy = cy + v;
                    }
                    const hit = checkLine(axis, tx, ty, tz, fx, fy, fz);
                    if (hit.hit) result = hit;
                }
            }
        }

        if (!result) return null;

        const dX = result.x - eyePos.x,
            dY = result.y - eyePos.y,
            dZ = result.z - eyePos.z;
        const distSq = dX * dX + dY * dY + dZ * dZ;

        if (distSq > maxReachSq) return null;

        const dist = Math.sqrt(distSq);
        const dot = lookVec ? (dX * lookVec.x + dY * lookVec.y + dZ * lookVec.z) / dist : 1.0;

        return { x: result.x, y: result.y, z: result.z, dist, dot };
    }

    calculateBlockCost(baseCost, distance, dotProduct) {
        return baseCost + distance * 2 + -dotProduct * 50;
    }

    getAimVectorForTarget(target) {
        if (!target) return null;
        const ax = target.aimX !== undefined ? target.aimX : target.x + 0.5;
        const ay = target.aimY !== undefined ? target.aimY : target.y + 0.5;
        const az = target.aimZ !== undefined ? target.aimZ : target.z + 0.5;
        return [ax, ay, az];
    }

    setCost(cost) {
        if (cost) {
            this.COSTTYPE = cost;
        } else {
            const Type = this.TYPE.find((option) => option.enabled)?.name;
            if (Type) {
                const costPropertyName = Type.toLowerCase() + 'Costs';

                if (this[costPropertyName]) {
                    this.COSTTYPE = this[costPropertyName];
                } else {
                    Chat.message(`&cError: Could not find cost type for ${Type}!`);
                    this.COSTTYPE = null;
                }
            } else {
                this.COSTTYPE = null;
            }
        }
    }

    populateLocations(locations) {
        this.manualScan = true;

        const eyePos = Player.getPlayer().getEyePos();
        const maxReachSq = 4.5 * 4.5;

        this.foundLocations = locations
            .map((loc) => {
                const hit = this.findVisibleAimPoint(loc.x, loc.y, loc.z, eyePos, null, maxReachSq, false);

                if (!hit) return null;

                return {
                    x: loc.x,
                    y: loc.y,
                    z: loc.z,
                    aimX: hit.x,
                    aimY: hit.y,
                    aimZ: hit.z,
                    dist: hit.dist,
                    isVisible: true,
                };
            })
            .filter((loc) => loc !== null);

        if (this.foundLocations.length === 0) {
            return false;
        }

        this.currentTarget = this.foundLocations[0];
        this.lowestCostBlockIndex = 0;
        this.toggle(true);

        return true;
    }

    onEnable() {
        if (Client.isInGui()) {
            Chat.message('&cMiningBot: Cannot start while GUI is open');
            this.toggle(false);
            return;
        }

        this.setCost();
        Chat.message('Mining Bot Enabled');
        this.allowScan = true;
        this.state = this.STATES.ABILITY;

        this.normalRender.register();
    }

    onDisable() {
        Chat.message('Mining Bot Disabled');
        this.state = this.STATES.WAITING;
        Keybind.setKey('leftclick', false);
        Keybind.setKey('rightclick', false);
        this.foundLocations = [];
        this.lastBlockPos = null;
        this.lastBlockType = null;
        this.currentTarget = null;
        this.mineTickCount = 0;
        this.tickCount = 0;
        Rotations.stopRotation();
        Guis.EnableUserInput();
        this.normalRender.unregister();
    }

    renderNormal() {
        if (this.DEBUG_MODE) return;
        if (this.foundLocations.length === 0) return;

        const fakeLookMode = this.FAKELOOK?.find?.((option) => option.enabled)?.name;
        const isFakelook = fakeLookMode && fakeLookMode !== 'Off';

        // cyan for normal, purple for fakelook
        const currentFillColor = isFakelook ? [180, 100, 255, 60] : [85, 255, 255, 60];
        const currentWireframeColor = isFakelook ? [180, 100, 255, 255] : [85, 255, 255, 255];
        const aimColor = isFakelook ? [255, 150, 255, 255] : [255, 220, 80, 255];

        // orange for normal, redish orange for fakelook
        const nextFillColor = isFakelook ? [255, 130, 70, 60] : [255, 170, 100, 60];
        const nextWireframeColor = isFakelook ? [255, 130, 70, 255] : [255, 170, 100, 255];

        const current = this.foundLocations[0];
        if (!current) return;

        RenderUtils.drawStyledBox(new Vec3d(current.x, current.y, current.z), currentFillColor, currentWireframeColor, 6, false);

        if (current.aimX !== undefined) {
            const d = 0.08;
            RenderUtils.drawLine(
                new Vec3d(current.aimX - d, current.aimY, current.aimZ),
                new Vec3d(current.aimX + d, current.aimY, current.aimZ),
                aimColor,
                2,
                false
            );
            RenderUtils.drawLine(
                new Vec3d(current.aimX, current.aimY - d, current.aimZ),
                new Vec3d(current.aimX, current.aimY + d, current.aimZ),
                aimColor,
                2,
                false
            );
            RenderUtils.drawLine(
                new Vec3d(current.aimX, current.aimY, current.aimZ - d),
                new Vec3d(current.aimX, current.aimY, current.aimZ + d),
                aimColor,
                2,
                false
            );
        }

        // If you just used the next lowest cost block, it rarely will ACTUALLY be the next best block because look direction. This fixes that by pretending to be at the current aim point.
        if (this.foundLocations.length > 1 && current.aimX !== undefined) {
            const eyePos = Player.getPlayer().getEyePos();

            const simLookX = current.aimX - eyePos.x;
            const simLookY = current.aimY - eyePos.y;
            const simLookZ = current.aimZ - eyePos.z;
            const simLookLen = Math.sqrt(simLookX * simLookX + simLookY * simLookY + simLookZ * simLookZ);

            if (simLookLen > 0) {
                const normLookX = simLookX / simLookLen;
                const normLookY = simLookY / simLookLen;
                const normLookZ = simLookZ / simLookLen;

                let bestNext = null;
                let bestCost = Infinity;

                for (let i = 1; i < this.foundLocations.length; i++) {
                    const loc = this.foundLocations[i];
                    if (loc.aimX === undefined) continue;

                    const dx = loc.aimX - eyePos.x;
                    const dy = loc.aimY - eyePos.y;
                    const dz = loc.aimZ - eyePos.z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist === 0) continue;

                    const dot = (dx * normLookX + dy * normLookY + dz * normLookZ) / dist;

                    const block = World.getBlockAt(loc.x, loc.y, loc.z);
                    const blockName = block?.type?.getRegistryName();
                    const baseCost = this.COSTTYPE?.[blockName] ?? 5;

                    const cost = this.calculateBlockCost(baseCost, dist, dot);

                    if (cost < bestCost) {
                        bestCost = cost;
                        bestNext = loc;
                    }
                }

                if (bestNext) {
                    RenderUtils.drawStyledBox(new Vec3d(bestNext.x, bestNext.y, bestNext.z), nextFillColor, nextWireframeColor, 6, false);
                }
            }
        } else if (this.foundLocations.length > 1) {
            const next = this.foundLocations[1];
            RenderUtils.drawStyledBox(new Vec3d(next.x, next.y, next.z), nextFillColor, nextWireframeColor, 6, false);
        }
    }

    renderDebug() {
        if (this.foundLocations.length > 0) {
            const count = this.foundLocations.length;
            for (let i = 0; i < count; i++) {
                const loc = this.foundLocations[i];
                const t = count > 1 ? i / (count - 1) : 0;

                const r = i === 0 ? 1 : t,
                    g = i === 0 ? 1 : 1 - t,
                    b = i === 0 ? 1 : 0;

                RenderUtils.drawWireFrame(new Vec3d(loc.x, loc.y, loc.z), [r * 255, g * 255, b * 255, 255]);

                if (loc.aimX !== undefined) {
                    const d = 0.1;
                    const color = [r * 255, g * 255, b * 255, 230];
                    RenderUtils.drawLine(new Vec3d(loc.aimX - d, loc.aimY, loc.aimZ), new Vec3d(loc.aimX + d, loc.aimY, loc.aimZ), color, 3, false);
                    RenderUtils.drawLine(new Vec3d(loc.aimX, loc.aimY - d, loc.aimZ), new Vec3d(loc.aimX, loc.aimY + d, loc.aimZ), color, 3, false);
                    RenderUtils.drawLine(new Vec3d(loc.aimX, loc.aimY, loc.aimZ - d), new Vec3d(loc.aimX, loc.aimY, loc.aimZ + d), color, 3, false);
                }
            }
        }
    }
}

export const MiningBot = new Bot();
