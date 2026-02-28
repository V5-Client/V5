import { MCHand, Vec3d } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { NukerUtils } from '../../utils/NukerUtils';
import { PlayerActionC2S } from '../../utils/Packets';
import { Raytrace } from '../../utils/Raytrace';
import { manager } from '../../utils/SkyblockEvents';
import { Utils } from '../../utils/Utils';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { ServerInfo } from '../../utils/player/ServerInfo';
import Render from '../../utils/render/Render';
import { Mouse } from '../../utils/Ungrab';

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
        this.ADDITIONAL_LAG_COMP = 0;

        this.STATES = { WAITING: 0, ABILITY: 1, MINING: 2, BUFF: 3, REFUEL: 4 };

        this.state = this.STATES.WAITING;
        this.TYPE = null;

        this.COSTTYPE = null;

        this.miningspeed = 0;
        this.currentTarget = null;
        this.lastBlockPos = null;
        this.lastBlockType = null;
        this.ability = null;

        this.mineTickCount = 0;
        this.tickCount = 0;
        this.totalTicks = 0;
        this.allowScan = false;
        this.speedBoost = false;
        this.nukedBlock = false;
        this.scanning = false;
        this.FOVPenalty = true;
        this.abilityFromChat = false;
        this.lastUse = 0;
        this.ABILITY_COOLDOWN_MS = 200000;

        this.faceReach = 4.5;
        this.bfsPad = Math.hypot(1, 1, 1) * 0.5;
        this.movementReevalCooldownUntil = 0;
        this.movementReevalCooldownMs = 180;
        this.lastSneakCommand = false;

        this.initCosts();
        this.bindToggleKey();
        this.initEventHandlers();
        this.initSettings();

        this.setTheme('#5a7cbb');

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => Object.keys(this.STATES).find((key) => this.STATES[key] === this.state) || 'Unknown',
                    Target: () =>
                        this.currentTarget
                            ? `${Math.floor(this.currentTarget.x)}, ${Math.floor(this.currentTarget.y)}, ${Math.floor(this.currentTarget.z)}`
                            : 'None',
                    Ticks: () => `${this.mineTickCount}/${this.totalTicks}`,
                },
            },
        ]);
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
            'minecraft:green_stained_glass': 4,
            'minecraft:green_stained_glass_pane': 4,
            'minecraft:black_stained_glass': 4,
            'minecraft:black_stained_glass_pane': 4,
            'minecraft:brown_stained_glass': 4,
            'minecraft:brown_stained_glass_pane': 4,
        };
    }

    updateMithrilCosts() {
        this.mithrilCosts = {
            'minecraft:polished_diorite': this.PRIORITIZE_TITANIUM ? 1 : 30,
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
            this.resetTickCounters();
            this.abilityFromChat = true;
            this.state = this.STATES.ABILITY;
        });

        manager.subscribe('abilityused', () => {
            if (this.ability === 'SpeedBoost') this.speedBoost = true;
            this.resetTickCounters();
        });

        manager.subscribe('abilitygone', () => {
            this.speedBoost = false;
            this.lastUse = Date.now();
            this.resetTickCounters();
        });
    }

    resetTickCounters() {
        this.mineTickCount = 0;
        this.tickCount = 0;
    }

    initSettings() {
        this.addToggle(
            'Movement',
            (value) => {
                this.MOVEMENT = value;
                if (!value) Keybind.stopMovement();
            },
            'Moves around vein while mining.',
            true
        );
        this.addToggle(
            'Tick Gliding',
            (value) => {
                this.TICKGLIDE = value;
            },
            'Predicts when blocks are broken to begin mining the next block early.',
            true
        );
        this.addSlider(
            'Additional lag compensation',
            0,
            5,
            1,
            (value) => {
                this.ADDITIONAL_LAG_COMP = value;
            },
            'Adds extra ticks to glide delay on top of TPS compensation. (Tick Gliding)'
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
            ['Mithril', 'Gemstone', 'Ore', 'Tunnel'],
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

    getAbilityStatusFromTab() {
        const tabNames = TabList.getNames();
        for (const [i, tabName] of tabNames.entries()) {
            const rawLine = tabName.getName().toString();
            const line = rawLine.replace(/§[0-9a-fk-or]/gi, '').trim();

            if (line.includes('Pickaxe Ability') && tabNames[i + 1]) {
                return tabNames[i + 1]
                    .getName()
                    .toString()
                    .replace(/§[0-9a-fk-or]/gi, '')
                    .trim();
            }
        }
        return '';
    }

    getFakeLookMode() {
        return this.FAKELOOK?.find?.((option) => option.enabled)?.name || 'Off';
    }

    isAirOrBedrock(blockName = '') {
        return blockName.includes('air') || blockName.includes('bedrock');
    }

    ensureDrillEquipped(drill) {
        if (!drill || drill.slot === undefined || drill.slot === null) return false;
        if (Player.getHeldItemIndex() !== drill.slot) {
            Guis.setItemSlot(drill.slot);
            return true;
        }
        return false;
    }

    loadAbilitySetting() {
        const file = Utils.getConfigFile('miningstats.json');
        this.ability = file?.ability || null;
    }

    shouldScanForNewBlock() {
        if (!this.currentTarget || this.allowScan) return true;

        const block = World.getBlockAt(this.currentTarget.x, this.currentTarget.y, this.currentTarget.z);
        if (!block?.type) return true;
        const blockName = block?.type?.getRegistryName() || '';

        return this.isAirOrBedrock(blockName);
    }

    advanceManualScan() {
        const currentBlock = this.currentTarget ? World.getBlockAt(this.currentTarget.x, this.currentTarget.y, this.currentTarget.z) : null;
        const currentReg = currentBlock?.type?.getRegistryName() || '';

        if (this.currentTarget === null || this.isAirOrBedrock(currentReg)) {
            this.lowestCostBlockIndex++;
            this.nukedBlock = false;

            if (this.lowestCostBlockIndex >= this.foundLocations.length) {
                this.foundLocations = [];
                this.currentTarget = null;
                this.lowestCostBlockIndex = 0;
                return false;
            }

            this.currentTarget = this.foundLocations[this.lowestCostBlockIndex];
            this.resetTickCounters();
        }

        return true;
    }

    updateBlockTracking(lowestCostBlock, blockName) {
        const isSameAsLast =
            this.lastBlockPos &&
            this.lastBlockPos.x === lowestCostBlock.x &&
            this.lastBlockPos.y === lowestCostBlock.y &&
            this.lastBlockPos.z === lowestCostBlock.z;

        if (isSameAsLast && this.lastBlockType && this.lastBlockType !== blockName) {
            if (!this.isAirOrBedrock(blockName)) {
                this.lastBlockType = blockName;
                this.resetTickCounters();
                return false;
            }
        }

        if (!isSameAsLast) {
            this.resetTickCounters();
            this.lastBlockPos = lowestCostBlock;
            this.lastBlockType = blockName;
            this.nukedBlock = false;
        }

        return true;
    }

    incrementMiningCountersIfLookingAtCurrent(fakeLookMode) {
        this.tickCount++;
        if (fakeLookMode !== 'Off') {
            Player.getPlayer().swingHand(MCHand.MAIN_HAND);
            this.mineTickCount++;
        } else {
            const lookingAt = Player.lookingAt();
            if (
                lookingAt &&
                lookingAt.getX() === this.currentTarget?.x &&
                lookingAt.getY() === this.currentTarget?.y &&
                lookingAt.getZ() === this.currentTarget?.z
            ) {
                this.mineTickCount++;
            }
        }
    }

    stopMiningControls(stopMovement = false) {
        if (stopMovement) {
            Keybind.stopMovement();
            Keybind.setKey('space', false);
        }
        Keybind.setKey('leftclick', false);
    }

    handleBreaking(blockName, fakeLookMode) {
        if (fakeLookMode === 'Off') {
            Keybind.setKey('leftclick', true);
        } else {
            Keybind.setKey('leftclick', false);
            if (this.isAirOrBedrock(blockName)) {
                this.lowestCostBlockIndex++;
                if (this.lowestCostBlockIndex >= this.foundLocations.length) this.allowScan = true;
            }
            if (this.currentTarget && !this.nukedBlock) {
                const pos = [this.currentTarget.x, this.currentTarget.y, this.currentTarget.z];
                if (fakeLookMode === 'Instant') NukerUtils.nuke(pos, this.totalTicks);
                else if (fakeLookMode === 'Queued') NukerUtils.nukeQueueAdd(pos, this.totalTicks);
                this.nukedBlock = true;
            }
        }
    }

    shouldGlideToNextBlock(blockName) {
        return this.TICKGLIDE
            ? this.mineTickCount >= this.totalTicks || this.tickCount > this.totalTicks * 2 || this.allowScan
            : !this.currentTarget || this.isAirOrBedrock(blockName) || this.allowScan;
    }

    handleRotationOrScan(allowStickyTarget = true) {
        if (this.manualScan) {
            this.lowestCostBlockIndex++;
            if (this.lowestCostBlockIndex >= this.foundLocations.length) {
                this.foundLocations = [];
                this.currentTarget = null;
                this.lowestCostBlockIndex = 0;
                return;
            }
            this.currentTarget = this.foundLocations[this.lowestCostBlockIndex];
            return;
        }
        const currentName = this.currentTarget
            ? World.getBlockAt(this.currentTarget.x, this.currentTarget.y, this.currentTarget.z)?.type?.getRegistryName() || ''
            : '';
        if (allowStickyTarget && this.currentTarget && !this.isAirOrBedrock(currentName) && this.refreshCurrentTargetAimPoint()) return;

        this.scanForBlock(this.COSTTYPE, null, this.currentTarget);
        this.allowScan = false;
    }

    isTunnelMode() {
        if (this.COSTTYPE === this.tunnelCosts) return true;
        const selectedType = Array.isArray(this.TYPE) ? this.TYPE.find((option) => option.enabled)?.name : null;
        return selectedType === 'Tunnel';
    }

    handleAbilityState() {
        if (this.SCAN_ONLY) return (this.state = this.STATES.MINING);

        const abilityStatus = this.getAbilityStatusFromTab();
        if (abilityStatus.includes('Available') || this.abilityFromChat || this.lastUse + this.ABILITY_COOLDOWN_MS < Date.now()) {
            if (this.ensureDrillEquipped(this.drill)) return;

            const fakeLookMode = this.getFakeLookMode();

            if (Player.getPlayer().handSwinging && fakeLookMode === 'Off') {
                return Keybind.setKey('leftclick', false);
            }

            Keybind.rightClick();

            this.lastUse = Date.now();
            this.abilityFromChat = false;
            this.state = this.STATES.MINING;
            return;
        }

        this.state = this.STATES.MINING;
    }

    handleMiningState() {
        if (this.SCAN_ONLY) {
            this.scanForBlock(this.COSTTYPE);
            if (this.MOVEMENT) this.stopMiningControls(true);
            return;
        }

        if (this.ensureDrillEquipped(this.drill)) return;

        if (this.lastUse + this.ABILITY_COOLDOWN_MS < Date.now()) return (this.state = this.STATES.ABILITY);

        if (this.shouldScanForNewBlock()) {
            if (this.manualScan) {
                if (!this.advanceManualScan()) {
                    this.stopMiningControls(this.MOVEMENT);
                    return;
                }
            } else {
                this.scanForBlock(this.COSTTYPE);
            }
            this.allowScan = false;
        }

        const lowestCostBlock = this.currentTarget || this.foundLocations[this.lowestCostBlockIndex];
        if (!lowestCostBlock) {
            this.stopMiningControls(this.MOVEMENT);
            return;
        }

        const block = World.getBlockAt(lowestCostBlock.x, lowestCostBlock.y, lowestCostBlock.z);
        const blockName = block?.type?.getRegistryName() || '';

        if (!this.updateBlockTracking(lowestCostBlock, blockName)) return;

        this.currentTarget = lowestCostBlock;
        if (this.MOVEMENT && !this.refreshCurrentTargetAimPoint()) {
            this.movementReevalCooldownUntil = Math.max(this.movementReevalCooldownUntil, Date.now() + this.movementReevalCooldownMs);
            this.stopMiningControls(true);
            this.resetTickCounters();
            this.handleRotationOrScan(true);
            return;
        }
        if (this.MOVEMENT && Date.now() < this.movementReevalCooldownUntil) {
            this.stopMiningControls(true);
        } else {
            this.handleVeinMovement();
        }

        const fakeLookMode = this.getFakeLookMode();

        this.incrementMiningCountersIfLookingAtCurrent(fakeLookMode);

        if (!this.currentTarget) return;

        this.miningspeed = this.isTunnelMode() ? MiningUtils.getSpeedWithCold() : MiningUtils.getMiningSpeed();
        this.totalTicks = MiningUtils.getMineTime(this.currentTarget, this.miningspeed, this.speedBoost) + this.glideDelay();

        this.handleBreaking(blockName, fakeLookMode);

        const shouldGlide = this.shouldGlideToNextBlock(blockName);
        if (shouldGlide) {
            this.resetTickCounters();
            this.handleRotationOrScan(false);
        }

        const targetVector = this.getAimVectorForTarget(this.currentTarget);
        if (this.currentTarget && targetVector) {
            Rotations.rotateToVector(targetVector);
        }
    }

    scanForBlock(targetCosts, startPos = null, excludedBlock = null) {
        if (!targetCosts) return this.message('No target specified, is cost type set?');

        this.scanning = true;

        const pX = Player.getX(),
            pY = Player.getY(),
            pZ = Player.getZ();
        const eyePos = Player.getPlayer().getEyePos();
        const lookVec = Player.asPlayerMP().getLookVector();

        const start = startPos || { x: Math.floor(pX), y: Math.floor(pY), z: Math.floor(pZ) };
        const found = [];
        const queue = [{ x: start.x, y: start.y, z: start.z }];
        let head = 0;
        const dirs = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
        ];

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

        if (!this.isWithinVisitedBounds(start.x, start.y, start.z, minBx, minBy, minBz, dimX, dimY, dimZ)) {
            this.scanning = false;
            this.currentTarget = null;
            this.foundLocations = [];
            this.lowestCostBlockIndex = 0;
            return;
        }

        setVisited(idxOf(start.x, start.y, start.z));

        const bfsReachSq = reach * reach;
        const mineReachSq = 4.5 * 4.5;

        while (head < queue.length) {
            const { x, y, z } = queue[head++];

            if (excludedBlock && x === excludedBlock.x && y === excludedBlock.y && z === excludedBlock.z) continue;

            const block = World.getBlockAt(x, y, z);
            if (!block || !block.type) continue;
            const blockName = block.type.getRegistryName();
            if (blockName && blockName in targetCosts && targetCosts[blockName] !== null) {
                const aimData = this.findVisibleAimPoint(x, y, z, eyePos, lookVec, mineReachSq, this.FOVPenalty);

                if (aimData) {
                    const baseCost = this.calculateBlockCost(targetCosts[blockName], aimData.dist, aimData.dot);
                    const visibilityStability = this.calculateVisibilityStability(x, y, z, eyePos, mineReachSq);
                    const cost = baseCost + (1 - visibilityStability) * 18;
                    found.push({
                        x,
                        y,
                        z,
                        cost,
                        aimX: aimData.x,
                        aimY: aimData.y,
                        aimZ: aimData.z,
                        visibilityStability,
                    });
                }
            }
            for (let i = 0; i < 6; i++) {
                const nx = x + dirs[i][0],
                    ny = y + dirs[i][1],
                    nz = z + dirs[i][2];

                if (!this.isWithinVisitedBounds(nx, ny, nz, minBx, minBy, minBz, dimX, dimY, dimZ)) continue;

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

        this.scanning = false;
    }

    isScanning() {
        return this.scanning;
    }

    findVisibleAimPoint(x, y, z, eyePos, lookVec, maxReachSq, checkFov = true) {
        if (!eyePos || !Number.isFinite(maxReachSq) || maxReachSq <= 0) return null;
        const cx = x + 0.5,
            cy = y + 0.5,
            cz = z + 0.5;
        const vx = cx - eyePos.x,
            vy = cy - eyePos.y,
            vz = cz - eyePos.z;
        const vLenSq = vx * vx + vy * vy + vz * vz;
        if (vLenSq === 0) return null;

        if (checkFov && lookVec) {
            const vLen = Math.hypot(vx, vy, vz);
            const dotToCenter = (vx * lookVec.x + vy * lookVec.y + vz * lookVec.z) / vLen;
            if (dotToCenter < -0.05) return null;
        }

        const invX = vx === 0 ? Infinity : 1 / vx,
            invY = vy === 0 ? Infinity : 1 / vy,
            invZ = vz === 0 ? Infinity : 1 / vz;
        const tx1 = (x - eyePos.x) * invX,
            tx2 = (x + 1 - eyePos.x) * invX;
        const ty1 = (y - eyePos.y) * invY,
            ty2 = (y + 1 - eyePos.y) * invY;
        const tz1 = (z - eyePos.z) * invZ,
            tz2 = (z + 1 - eyePos.z) * invZ;

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

        const INSET = 0.48,
            FACE_INSET = 0.48,
            EDGE_MAG = 0.45,
            MID_CAP = 0.3;
        const LO = 0.02,
            HI = 0.98;
        const clamp = (v, l, h) => {
            if (v < l) return l;
            if (v > h) return h;
            return v;
        };

        const checkLine = (axis, ttx, tty, ttz, ffx, ffy, ffz) => {
            let tx = ttx,
                ty = tty,
                tz = ttz,
                fx = ffx,
                fy = ffy,
                fz = ffz;

            if (axis === 'x') {
                ty = clamp(tty, y + LO, y + HI);
                tz = clamp(ttz, z + LO, z + HI);
                fy = clamp(ffy, y + LO, y + HI);
                fz = clamp(ffz, z + LO, z + HI);
            } else if (axis === 'y') {
                tx = clamp(ttx, x + LO, x + HI);
                tz = clamp(ttz, z + LO, z + HI);
                fx = clamp(ffx, x + LO, x + HI);
                fz = clamp(ffz, z + LO, z + HI);
            } else {
                tx = clamp(ttx, x + LO, x + HI);
                ty = clamp(tty, y + LO, y + HI);
                fx = clamp(ffx, x + LO, x + HI);
                fy = clamp(ffy, y + LO, y + HI);
            }
            if (Raytrace.isLineClear(eyePos.x, eyePos.y, eyePos.z, tx, ty, tz, x, y, z)) {
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
            const samples = [
                [0, 0],
                [0.35, 0],
                [-0.35, 0],
                [0, 0.35],
                [0, -0.35],
                [0.35, 0.35],
                [-0.35, -0.35],
            ];

            for (let axis of orthos) {
                if (result) break;

                let sOrtho;
                if (axis === 'x') {
                    sOrtho = eyePos.x >= cx ? 1 : -1;
                } else if (axis === 'y') {
                    sOrtho = eyePos.y >= cy ? 1 : -1;
                } else {
                    sOrtho = eyePos.z >= cz ? 1 : -1;
                }

                for (let i = 0; i < samples.length; i++) {
                    if (result) break;
                    const u = samples[i][0];
                    const v = samples[i][1];

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

        const dist = Math.hypot(dX, dY, dZ);
        const dot = lookVec && dist > 0 ? (dX * lookVec.x + dY * lookVec.y + dZ * lookVec.z) / dist : 1;

        return { x: result.x, y: result.y, z: result.z, dist, dot };
    }

    calculateBlockCost(baseCost, distance, dotProduct) {
        return baseCost + distance * 2 - dotProduct * 50;
    }

    calculateVisibilityStability(x, y, z, eyePos, maxReachSq) {
        const offsets = [
            [0, 0, 0],
            [0.18, 0, 0],
            [-0.18, 0, 0],
            [0, 0, 0.18],
            [0, 0, -0.18],
        ];

        let visibleSamples = 0;
        for (let i = 0; i < offsets.length; i++) {
            const sampleEye = {
                x: eyePos.x + offsets[i][0],
                y: eyePos.y,
                z: eyePos.z + offsets[i][2],
            };

            if (this.findVisibleAimPoint(x, y, z, sampleEye, null, maxReachSq, false)) {
                visibleSamples++;
            }
        }

        return visibleSamples / offsets.length;
    }

    isTargetDirectlyUnderPlayer(target = this.currentTarget) {
        if (!target) return false;

        const playerBlockX = Math.floor(Player.getX());
        const playerBlockY = Math.floor(Player.getY());
        const playerBlockZ = Math.floor(Player.getZ());

        return target.x === playerBlockX && target.z === playerBlockZ && target.y <= playerBlockY - 1;
    }

    isTargetAbovePlayer(target = this.currentTarget, minUpwardPitchDeg = 60) {
        if (!target) return false;

        const targetPoint = {
            x: target.aimX ?? target.x + 0.5,
            y: target.aimY ?? target.y + 0.5,
            z: target.aimZ ?? target.z + 0.5,
        };
        const { pitch } = MathUtils.calculateAbsoluteAngles(targetPoint);

        return pitch <= -Math.abs(minUpwardPitchDeg);
    }

    setSneak(shouldSneak, force = false) {
        if (force || this.lastSneakCommand !== shouldSneak || Player.isSneaking() !== shouldSneak) {
            Keybind.setKey('shift', shouldSneak);
            this.lastSneakCommand = shouldSneak;
        }
    }

    handleVeinMovement() {
        if (!this.MOVEMENT || !this.currentTarget) {
            Keybind.stopMovement();
            Keybind.setKey('space', false);
            return;
        }

        const targetPoint = {
            x: this.currentTarget.aimX ?? this.currentTarget.x + 0.5,
            y: this.currentTarget.aimY ?? this.currentTarget.y + 0.5,
            z: this.currentTarget.aimZ ?? this.currentTarget.z + 0.5,
        };

        const values = MathUtils.getDistanceToPlayerEyes(targetPoint);
        const yaw = MathUtils.calculateAngles(targetPoint).yaw;

        if (!this._movementHumanizer) {
            this._movementHumanizer = {
                strafeThreshold: 10,
                stopYawThreshold: 4,
                moveInMin: 2.35,
                moveInMax: 3.15,
                moveOutThreshold: 3.75,
                unsneakLargeMoveThreshold: 6.2,
                unsneakDropYThreshold: 0.5,
            };
        }

        const cfg = this._movementHumanizer;
        if (this.isTargetDirectlyUnderPlayer(this.currentTarget) || this.isTargetAbovePlayer(this.currentTarget)) {
            Keybind.stopMovement();
            this.setSneak(true);
            Keybind.setKey('space', false);
            return;
        }

        let moveRight = yaw > cfg.strafeThreshold;
        let moveLeft = yaw < -cfg.strafeThreshold;
        let moveForward = values.distanceFlat > cfg.moveInMax && Math.abs(values.differenceY) <= 2.0;
        let moveBack = values.distanceFlat < cfg.moveInMin;

        const isAligned = yaw >= -cfg.stopYawThreshold && yaw <= cfg.stopYawThreshold;
        const inDistanceBand = values.distanceFlat >= 2.5 && values.distanceFlat <= 3.25;
        if (isAligned || inDistanceBand) {
            moveRight = false;
            moveLeft = false;
            moveForward = false;
            moveBack = false;
        }

        Keybind.setKey('d', moveRight);
        Keybind.setKey('a', moveLeft);
        Keybind.setKey('w', moveForward);
        Keybind.setKey('s', moveBack);
        Keybind.setKey('space', false);

        const isMoving = moveRight || moveLeft || moveForward || moveBack;
        const playerFeetY = Player.getY();
        const targetTopY = this.currentTarget.y + 1;
        const dropAmount = playerFeetY - targetTopY;
        const requiresDropToMove = dropAmount > cfg.unsneakDropYThreshold && values.distanceFlat > 0.35;
        const requiresLargeMove = values.distanceFlat > cfg.unsneakLargeMoveThreshold;
        const shouldUnsneak = isMoving && (requiresDropToMove || requiresLargeMove);
        this.setSneak(!shouldUnsneak);
    }

    refreshCurrentTargetAimPoint() {
        if (!this.currentTarget) return false;

        const eyePos = Player.getPlayer().getEyePos();
        const lookVec = Player.asPlayerMP().getLookVector();
        const hit = this.findVisibleAimPoint(
            this.currentTarget.x,
            this.currentTarget.y,
            this.currentTarget.z,
            eyePos,
            lookVec,
            this.faceReach * this.faceReach,
            false
        );

        if (!hit) return false;

        this.currentTarget.aimX = hit.x;
        this.currentTarget.aimY = hit.y;
        this.currentTarget.aimZ = hit.z;
        return true;
    }

    getAimVectorForTarget(target) {
        if (!target) return null;
        const ax = target.aimX != null ? target.aimX : target.x + 0.5;
        const ay = target.aimY != null ? target.aimY : target.y + 0.5;
        const az = target.aimZ != null ? target.aimZ : target.z + 0.5;
        return [ax, ay, az];
    }

    isWithinVisitedBounds(x, y, z, minBx, minBy, minBz, dimX, dimY, dimZ) {
        return x >= minBx && x < minBx + dimX && y >= minBy && y < minBy + dimY && z >= minBz && z < minBz + dimZ;
    }

    setCost(cost) {
        if (cost) {
            this.COSTTYPE = cost;
            return;
        }

        const typeName = Array.isArray(this.TYPE) ? this.TYPE.find((option) => option.enabled)?.name : null;
        if (!typeName) {
            this.COSTTYPE = null;
            return;
        }

        const costPropertyName = typeName.toLowerCase() + 'Costs';
        if (this[costPropertyName]) {
            this.COSTTYPE = this[costPropertyName];
        } else {
            this.message(`&cCould not find cost type for ${typeName}!`);
            this.COSTTYPE = null;
        }
    }

    populateLocations(locations, parentManaged) {
        if (!Array.isArray(locations) || locations.length === 0) return false;
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
        this.toggle(true, parentManaged);

        return true;
    }

    glideDelay() {
        return Math.max(0, 20 + this.ADDITIONAL_LAG_COMP - Math.trunc(ServerInfo.getTPS()));
    }

    onEnable() {
        if (Client.isInGui()) {
            this.message('&cCannot start while GUI is open!');
            this.toggle(false);
            return;
        }

        this.drill = MiningUtils.getDrills()?.drill;
        if (!this.drill) {
            this.message('&cNo drill detected!');
            this.toggle(false);
            return;
        }

        this.loadAbilitySetting();
        this.lastSneakCommand = Player.isSneaking();
        this.movementReevalCooldownUntil = 0;
        this.setCost();
        if (!this.isParentManaged) {
            this.message('&aEnabled');
            Mouse.ungrab();
            this.manualScan = false;
        }
        this.allowScan = true;
        this.FOVPenalty = true;
        this.state = this.STATES.ABILITY;
        this.normalRender.register();
    }

    onDisable() {
        if (!this.isParentManaged) {
            this.message('&cDisabled');
            Mouse.regrab();
        }

        this.state = this.STATES.WAITING;
        Keybind.stopMovement();
        Keybind.setKey('space', false);
        this.setSneak(false, true);
        Keybind.setKey('leftclick', false);
        Keybind.setKey('rightclick', false);
        this.foundLocations = [];
        this.lastBlockPos = null;
        this.lastBlockType = null;
        this.currentTarget = null;
        this.lowestCostBlockIndex = 0;
        this.manualScan = false;
        this.allowScan = false;
        this.scanning = false;
        this.nukedBlock = false;
        this.mineTickCount = 0;
        this.tickCount = 0;
        this.movementReevalCooldownUntil = 0;
        this._movementHumanizer = null;
        this.lastRenderFrameTime = null;
        this.lastRenderPos = null;
        this.lastAimPos = null;
        this.lastNextPos = null;
        Rotations.stopRotation();
        this.normalRender.unregister();
    }

    renderNormal() {
        if (this.DEBUG_MODE) return;

        if (this.foundLocations.length === 0) {
            this.lastRenderPos = null;
            this.lastAimPos = null;
            this.lastNextPos = null;
            this.lastRenderFrameTime = null;
            return;
        }

        const now = Date.now();
        const dtSeconds = this.lastRenderFrameTime ? Math.min((now - this.lastRenderFrameTime) / 1000, 0.2) : 1 / 120;
        this.lastRenderFrameTime = now;

        const baseAlphaAt120 = 0.1;
        const smoothingHz = -Math.log(1 - baseAlphaAt120) / (1 / 120);
        const alpha = 1 - Math.exp(-smoothingHz * dtSeconds);
        const lerp = (s, e) => s + (e - s) * alpha;

        const current = this.currentTarget || this.foundLocations[this.lowestCostBlockIndex] || this.foundLocations[0];
        if (!current) return;

        if (!this.lastRenderPos) {
            this.lastRenderPos = { x: current.x, y: current.y, z: current.z };
        } else {
            this.lastRenderPos.x = lerp(this.lastRenderPos.x, current.x);
            this.lastRenderPos.y = lerp(this.lastRenderPos.y, current.y);
            this.lastRenderPos.z = lerp(this.lastRenderPos.z, current.z);
        }

        if (current.aimX !== undefined) {
            if (!this.lastAimPos) {
                this.lastAimPos = { x: current.aimX, y: current.aimY, z: current.aimZ };
            } else {
                this.lastAimPos.x = lerp(this.lastAimPos.x, current.aimX);
                this.lastAimPos.y = lerp(this.lastAimPos.y, current.aimY);
                this.lastAimPos.z = lerp(this.lastAimPos.z, current.aimZ);
            }
        } else {
            this.lastAimPos = null;
        }

        const candidateLocations = this.foundLocations.filter((loc) => !(loc.x === current.x && loc.y === current.y && loc.z === current.z));

        let nextTarget = null;
        if (candidateLocations.length > 0 && current.aimX !== undefined) {
            const eyePos = Player.getPlayer().getEyePos();
            const simLookX = current.aimX - eyePos.x;
            const simLookY = current.aimY - eyePos.y;
            const simLookZ = current.aimZ - eyePos.z;
            const simLookLen = Math.hypot(simLookX, simLookY, simLookZ);

            if (simLookLen > 0) {
                const normLookX = simLookX / simLookLen;
                const normLookY = simLookY / simLookLen;
                const normLookZ = simLookZ / simLookLen;

                let bestCost = Infinity;
                for (const loc of candidateLocations) {
                    if (loc.aimX === undefined) continue;

                    const dx = loc.aimX - eyePos.x;
                    const dy = loc.aimY - eyePos.y;
                    const dz = loc.aimZ - eyePos.z;
                    const dist = Math.hypot(dx, dy, dz);
                    if (dist === 0) continue;

                    const dot = (dx * normLookX + dy * normLookY + dz * normLookZ) / dist;
                    const block = World.getBlockAt(loc.x, loc.y, loc.z);
                    const blockName = block?.type?.getRegistryName();
                    const baseCost = this.COSTTYPE?.[blockName] ?? 5;
                    const cost = this.calculateBlockCost(baseCost, dist, dot);

                    if (cost < bestCost) {
                        bestCost = cost;
                        nextTarget = loc;
                    }
                }
            }
        } else if (candidateLocations.length > 0) {
            nextTarget = candidateLocations[0];
        }

        if (nextTarget) {
            if (!this.lastNextPos) {
                this.lastNextPos = { x: nextTarget.x, y: nextTarget.y, z: nextTarget.z };
            } else {
                this.lastNextPos.x = lerp(this.lastNextPos.x, nextTarget.x);
                this.lastNextPos.y = lerp(this.lastNextPos.y, nextTarget.y);
                this.lastNextPos.z = lerp(this.lastNextPos.z, nextTarget.z);
            }
        } else {
            this.lastNextPos = null;
        }

        const fakeLookMode = this.getFakeLookMode();
        const isFakelook = fakeLookMode && fakeLookMode !== 'Off';

        const currentFill = isFakelook ? Render.Color(180, 100, 255, 60) : Render.Color(85, 255, 255, 60);
        const currentWire = isFakelook ? Render.Color(180, 100, 255, 255) : Render.Color(85, 255, 255, 255);
        const aimColor = isFakelook ? Render.Color(255, 150, 255, 255) : Render.Color(255, 220, 80, 255);
        const nextFill = isFakelook ? Render.Color(255, 130, 70, 60) : Render.Color(255, 170, 100, 60);
        const nextWire = isFakelook ? Render.Color(255, 130, 70, 255) : Render.Color(255, 170, 100, 255);

        Render.drawStyledBox(new Vec3d(this.lastRenderPos.x, this.lastRenderPos.y, this.lastRenderPos.z), currentFill, currentWire, 6, false);

        if (this.lastAimPos) {
            const d = 0.08;
            const { x, y, z } = this.lastAimPos;
            Render.drawLine(new Vec3d(x - d, y, z), new Vec3d(x + d, y, z), aimColor, 2, false);
            Render.drawLine(new Vec3d(x, y - d, z), new Vec3d(x, y + d, z), aimColor, 2, false);
            Render.drawLine(new Vec3d(x, y, z - d), new Vec3d(x, y, z + d), aimColor, 2, false);
        }

        if (this.lastNextPos) {
            Render.drawStyledBox(new Vec3d(this.lastNextPos.x, this.lastNextPos.y, this.lastNextPos.z), nextFill, nextWire, 6, false);
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

                Render.drawWireFrame(new Vec3d(loc.x, loc.y, loc.z), Render.Color(r * 255, g * 255, b * 255, 255));

                if (loc.aimX !== undefined) {
                    const d = 0.1;
                    const color = Render.Color(r * 255, g * 255, b * 255, 230);
                    Render.drawLine(new Vec3d(loc.aimX - d, loc.aimY, loc.aimZ), new Vec3d(loc.aimX + d, loc.aimY, loc.aimZ), color, 3, false);
                    Render.drawLine(new Vec3d(loc.aimX, loc.aimY - d, loc.aimZ), new Vec3d(loc.aimX, loc.aimY + d, loc.aimZ), color, 3, false);
                    Render.drawLine(new Vec3d(loc.aimX, loc.aimY, loc.aimZ - d), new Vec3d(loc.aimX, loc.aimY, loc.aimZ + d), color, 3, false);
                }
            }
        }
    }
}

export const MiningBot = new Bot();
