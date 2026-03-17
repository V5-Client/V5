import { BP, MCHand, Vec3d } from '../../utils/Constants';
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

const FORMATTING_CODE_REGEX = /§[0-9a-fk-or]/gi;
const BFS_DIR_X = [1, -1, 0, 0, 0, 0];
const BFS_DIR_Y = [0, 0, 1, -1, 0, 0];
const BFS_DIR_Z = [0, 0, 0, 0, 1, -1];
const ORTHO_FACE_AXES = {
    x: ['y', 'z'],
    y: ['x', 'z'],
    z: ['x', 'y'],
};
const FACE_FALLBACK_SAMPLES = [0, 0, 0.35, 0, -0.35, 0, 0, 0.35, 0, -0.35, 0.35, 0.35, -0.35, -0.35];
const VISIBILITY_OFFSETS = [0, 0, 0, 0.18, 0, 0, -0.18, 0, 0, 0, 0, 0.18, 0, 0, -0.18];
const VISIBILITY_SAMPLE_COUNT = VISIBILITY_OFFSETS.length / 3;
const AIM_POINT_INSET = 0.48;
const AIM_POINT_FACE_INSET = 0.48;
const AIM_POINT_EDGE_MAG = 0.45;
const AIM_POINT_MID_CAP = 0.3;
const AIM_POINT_LO = 0.02;
const AIM_POINT_HI = 0.98;
const TARGET_MODES = {
    REACHABLE: 'reachable',
    APPROACH: 'approach',
};

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
        this.PRIORITIZE_GRAY_MITHRIL = false;
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
        this.fakeLookModeName = 'Off';
        this.selectedTypeName = 'Mithril';
        this._abilityStatusCache = { expiresAt: 0, value: '' };
        this._renderPalette = {
            normal: {
                currentFill: Render.Color(85, 255, 255, 60),
                currentWire: Render.Color(85, 255, 255, 255),
                aimColor: Render.Color(255, 220, 80, 255),
                nextFill: Render.Color(255, 170, 100, 60),
                nextWire: Render.Color(255, 170, 100, 255),
            },
            fake: {
                currentFill: Render.Color(180, 100, 255, 60),
                currentWire: Render.Color(180, 100, 255, 255),
                aimColor: Render.Color(255, 150, 255, 255),
                nextFill: Render.Color(255, 130, 70, 60),
                nextWire: Render.Color(255, 130, 70, 255),
            },
        };

        this.mineReach = 4.5;
        this.faceReach = this.mineReach;
        this.approachScanReach = 8;
        this.bfsPad = Math.hypot(1, 1, 1) * 0.5;
        this.reachableCandidateEvaluationBudget = 24;
        this.reachableVisibleTargetBudget = 10;
        this.reachableVisibleStopCount = 3;
        this.approachTargetBudget = 10;
        this.movementReevalCooldownUntil = 0;
        this.movementReevalCooldownMs = 300;
        this.lastSneakCommand = false;
        this._scanWorkspace = {
            capacity: 0,
            visitMark: 0,
            visited: null,
            queueX: null,
            queueY: null,
            queueZ: null,
            candidateX: null,
            candidateY: null,
            candidateZ: null,
            candidateTargetCost: null,
            candidateCheapCost: null,
            candidateBlockName: null,
        };
        this._visibilitySampleEye = { x: 0, y: 0, z: 0 };

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
            'minecraft:lime_stained_glass': 4,
            'minecraft:lime_stained_glass_pane': 4,
            'minecraft:green_stained_glass': 4,
            'minecraft:green_stained_glass_pane': 4,
            'minecraft:black_stained_glass': 4,
            'minecraft:black_stained_glass_pane': 4,
            'minecraft:brown_stained_glass': 4,
            'minecraft:brown_stained_glass_pane': 4,
        };

        this.tunnelOreCosts = {
            glacite: {
                'minecraft:packed_ice': 4,
            },
            umber: {
                'minecraft:smooth_red_sandstone': 4,
                'minecraft:terracotta': 4,
                'minecraft:brown_terracotta': 4,
            },
            tungsten: {
                'minecraft:clay': 4,
                'minecraft:infested_cobblestone': 4,
            },
            aquamarine: {
                'minecraft:blue_stained_glass': 4,
                'minecraft:blue_stained_glass_pane': 4,
            },
            peridot: {
                'minecraft:green_stained_glass': 4,
                'minecraft:green_stained_glass_pane': 4,
            },
            onyx: {
                'minecraft:black_stained_glass': 4,
                'minecraft:black_stained_glass_pane': 4,
            },
            citrine: {
                'minecraft:brown_stained_glass': 4,
                'minecraft:brown_stained_glass_pane': 4,
            },
        };
    }

    updateMithrilCosts() {
        const lightBlueCost = this.PRIORITIZE_GRAY_MITHRIL ? 20 : 3;
        const prismarineCost = 10;
        const grayCost = this.PRIORITIZE_GRAY_MITHRIL ? 1 : 20;

        this.mithrilCosts = {
            'minecraft:polished_diorite': this.PRIORITIZE_TITANIUM ? 1 : 30,
            'minecraft:light_blue_wool': lightBlueCost,
            'minecraft:prismarine': prismarineCost,
            'minecraft:prismarine_bricks': prismarineCost,
            'minecraft:dark_prismarine': prismarineCost,
            'minecraft:gray_wool': grayCost,
            'minecraft:cyan_terracotta': grayCost,
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
            if (!this.enabled) return;
            if (Client.isInGui()) {
                Keybind.unpressKeys();
                return;
            }

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
            if (!this.enabled) return;
            this.resetTickCounters();
            this.abilityFromChat = true;
            this.state = this.STATES.ABILITY;
        });

        manager.subscribe('abilityused', () => {
            if (!this.enabled) return;
            if (this.ability === 'SpeedBoost') this.speedBoost = true;
            this.resetTickCounters();
        });

        manager.subscribe('abilitygone', () => {
            if (!this.enabled) return;
            this.speedBoost = false;
            this.lastUse = Date.now();
            this.resetTickCounters();
        });
    }

    resetTickCounters() {
        this.mineTickCount = 0;
        this.tickCount = 0;
    }

    ensureScanWorkspace(requiredCapacity) {
        const workspace = this._scanWorkspace;
        if (workspace.capacity < requiredCapacity) {
            let nextCapacity = workspace.capacity || 256;
            while (nextCapacity < requiredCapacity) nextCapacity *= 2;

            workspace.capacity = nextCapacity;
            workspace.visited = new Int32Array(nextCapacity);
            workspace.queueX = new Int32Array(nextCapacity);
            workspace.queueY = new Int32Array(nextCapacity);
            workspace.queueZ = new Int32Array(nextCapacity);
            workspace.candidateX = new Int32Array(nextCapacity);
            workspace.candidateY = new Int32Array(nextCapacity);
            workspace.candidateZ = new Int32Array(nextCapacity);
            workspace.candidateTargetCost = new Int32Array(nextCapacity);
            workspace.candidateCheapCost = new Float64Array(nextCapacity);
            workspace.candidateBlockName = new Array(nextCapacity);
            workspace.visitMark = 0;
        }

        workspace.visitMark++;
        if (workspace.visitMark >= 2147483647) {
            workspace.visited = new Int32Array(workspace.capacity);
            workspace.visitMark = 1;
        }

        return workspace;
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
        this.addToggle(
            'Prioritise Gray Mithril',
            (value) => {
                this.setPrioritizeGrayMithril(value);
            },
            'Reverses mithril block targeting costs to prioritise gray mithril.'
        );
        this.addMultiToggle(
            'Fakelook',
            ['Off', 'Queued'],
            true,
            (value) => {
                this.FAKELOOK = value;
                this.fakeLookModeName = this.getEnabledOptionName(value, 'Off');
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
                this.selectedTypeName = this.getEnabledOptionName(value, this.selectedTypeName);
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

    setPrioritizeGrayMithril(value) {
        this.PRIORITIZE_GRAY_MITHRIL = value;
        this.updateMithrilCosts();
    }

    getAbilityStatusFromTab() {
        const now = Date.now();
        if (now < this._abilityStatusCache.expiresAt) return this._abilityStatusCache.value;

        const tabNames = TabList.getNames();
        for (const [i, tabName] of tabNames.entries()) {
            const rawLine = tabName.getName().toString();
            const line = rawLine.replace(FORMATTING_CODE_REGEX, '').trim();

            if (line.includes('Pickaxe Ability') && tabNames[i + 1]) {
                const ability = tabNames[i + 1].getName().toString().replace(FORMATTING_CODE_REGEX, '').trim();
                this._abilityStatusCache.expiresAt = now + 200;
                this._abilityStatusCache.value = ability;
                return ability;
            }
        }
        this._abilityStatusCache.expiresAt = now + 200;
        this._abilityStatusCache.value = '';
        return '';
    }

    getFakeLookMode() {
        return this.fakeLookModeName || 'Off';
    }

    getEnabledOptionName(value, fallback = null) {
        if (Array.isArray(value)) {
            const selected = value.find((option) => option?.enabled)?.name;
            return selected ?? fallback;
        }
        if (typeof value === 'string') return value;
        return fallback;
    }

    isAirOrBedrock(blockName = '') {
        return blockName.includes('air') || blockName.includes('bedrock');
    }

    isSolidBlockAt(x, y, z) {
        const block = World.getBlockAt(x, y, z);
        if (!block?.type || block.type.getID() === 0) return false;
        if (block.type.getRegistryName?.() === 'minecraft:snow') return false;

        const world = World.getWorld();
        if (!world) return false;

        const blockPos = new BP(Math.floor(x), Math.floor(y), Math.floor(z));
        return !world.getBlockState(blockPos).getCollisionShape(world, blockPos).isEmpty();
    }

    hasForwardObstacle() {
        const player = Player.getPlayer();
        if (!player) return false;

        const lookVec = Player.asPlayerMP()?.getLookVector();
        if (!lookVec) return false;

        const forwardX = Player.getX() + lookVec.x * 0.8;
        const forwardZ = Player.getZ() + lookVec.z * 0.8;
        const feetY = Math.floor(Player.getY());

        return this.isSolidBlockAt(forwardX, feetY, forwardZ) || this.isSolidBlockAt(forwardX, feetY + 1, forwardZ);
    }

    getTargetMode(target = this.currentTarget) {
        return target?.targetMode || TARGET_MODES.REACHABLE;
    }

    isApproachTarget(target = this.currentTarget) {
        return this.getTargetMode(target) === TARGET_MODES.APPROACH;
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

        const now = Date.now();
        const abilityStatus = this.getAbilityStatusFromTab();
        if (abilityStatus.includes('Available') || this.abilityFromChat || this.lastUse + this.ABILITY_COOLDOWN_MS < now) {
            if (this.ensureDrillEquipped(this.drill)) return;

            const fakeLookMode = this.getFakeLookMode();

            if (Player.getPlayer().handSwinging && fakeLookMode === 'Off') {
                return Keybind.setKey('leftclick', false);
            }

            Keybind.rightClick();

            this.lastUse = now;
            this.abilityFromChat = false;
            this.state = this.STATES.MINING;
            return;
        }

        this.state = this.STATES.MINING;
    }

    handleMiningState() {
        const now = Date.now();
        this.tickCount++;

        if (this.SCAN_ONLY) {
            this.scanForBlock(this.COSTTYPE);
            if (this.MOVEMENT) this.stopMiningControls(true);
            return;
        }

        if (this.ensureDrillEquipped(this.drill)) return;

        if (this.lastUse + this.ABILITY_COOLDOWN_MS < now) return (this.state = this.STATES.ABILITY);

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
        const wasApproachTarget = this.isApproachTarget(this.currentTarget);
        if (wasApproachTarget && !this.MOVEMENT) {
            this.currentTarget = null;
            this.foundLocations = [];
            this.lowestCostBlockIndex = 0;
            this.stopMiningControls(false);
            return;
        }

        const hasFreshAimPoint = this.refreshCurrentTargetAimPoint();
        if (!hasFreshAimPoint) {
            if (wasApproachTarget && this.MOVEMENT) {
                this.allowScan = true;
                this.handleVeinMovement();

                const approachVector = this.getAimVectorForTarget(this.currentTarget);
                if (approachVector) Rotations.rotateToVector(approachVector);
                return;
            }

            this.movementReevalCooldownUntil = Math.max(this.movementReevalCooldownUntil, now + this.movementReevalCooldownMs);
            this.stopMiningControls(true);
            this.scanForBlock(this.COSTTYPE, null, this.currentTarget);
            this.allowScan = false;
        }

        if (this.MOVEMENT && now < this.movementReevalCooldownUntil) {
            this.stopMiningControls(true);
        } else {
            this.handleVeinMovement();
        }

        const fakeLookMode = this.getFakeLookMode();

        this.incrementMiningCountersIfLookingAtCurrent(fakeLookMode);

        if (!this.currentTarget) return;

        const tunnelMode = this.isTunnelMode();
        this.miningspeed = tunnelMode ? MiningUtils.getSpeedWithCold() : MiningUtils.getMiningSpeed();
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

    insertSortedCandidate(list, candidate, maxCount, scoreKey = 'cost') {
        if (!Array.isArray(list) || maxCount <= 0) return;

        const score = candidate?.[scoreKey];
        if (!Number.isFinite(score)) return;

        let insertAt = list.length;
        while (insertAt > 0 && list[insertAt - 1][scoreKey] > score) insertAt--;
        if (insertAt >= maxCount) return;

        list.splice(insertAt, 0, candidate);
        if (list.length > maxCount) list.pop();
    }

    collectScanTargets(
        targetCosts,
        start,
        eyePos,
        lookVec,
        scanReach,
        excludedBlock = null,
        collectReachableCandidates = true,
        collectApproachTargets = false
    ) {
        const reachableCandidateReach = this.mineReach + this.bfsPad;
        const reachableCandidateReachSq = reachableCandidateReach * reachableCandidateReach;
        const approachReachSq = this.approachScanReach * this.approachScanReach;
        const reachableCandidates = {
            count: 0,
            length: 0,
            x: null,
            y: null,
            z: null,
            cheapCost: null,
            blockName: null,
            targetCost: null,
        };
        const approachTargets = [];
        let head = 0;

        const reach = scanReach + this.bfsPad;
        const minBx = Math.floor(eyePos.x - reach) - 1,
            dimX = Math.floor(eyePos.x + reach) + 1 - minBx + 1;
        const minBy = Math.floor(eyePos.y - reach) - 1,
            dimY = Math.floor(eyePos.y + reach) + 1 - minBy + 1;
        const minBz = Math.floor(eyePos.z - reach) - 1,
            dimZ = Math.floor(eyePos.z + reach) + 1 - minBz + 1;
        const maxQueueSize = dimX * dimY * dimZ;
        const workspace = this.ensureScanWorkspace(maxQueueSize);
        const visited = workspace.visited;
        const queueX = workspace.queueX;
        const queueY = workspace.queueY;
        const queueZ = workspace.queueZ;
        const candidateX = workspace.candidateX;
        const candidateY = workspace.candidateY;
        const candidateZ = workspace.candidateZ;
        const candidateTargetCost = workspace.candidateTargetCost;
        const candidateCheapCost = workspace.candidateCheapCost;
        const candidateBlockName = workspace.candidateBlockName;
        const visitMark = workspace.visitMark;
        const eyeX = eyePos.x;
        const eyeY = eyePos.y;
        const eyeZ = eyePos.z;
        const hasLookVec = !!lookVec;
        const lookX = hasLookVec ? lookVec.x : 0;
        const lookY = hasLookVec ? lookVec.y : 0;
        const lookZ = hasLookVec ? lookVec.z : 0;
        let reachableCount = 0;
        let tail = 1;

        if (!this.isWithinVisitedBounds(start.x, start.y, start.z, minBx, minBy, minBz, dimX, dimY, dimZ)) {
            return null;
        }

        queueX[0] = start.x;
        queueY[0] = start.y;
        queueZ[0] = start.z;
        visited[start.x - minBx + dimX * (start.y - minBy + dimY * (start.z - minBz))] = visitMark;

        const bfsReachSq = reach * reach;

        while (head < tail) {
            const x = queueX[head];
            const y = queueY[head];
            const z = queueZ[head];
            head++;

            if (excludedBlock && x === excludedBlock.x && y === excludedBlock.y && z === excludedBlock.z) continue;

            const block = World.getBlockAt(x, y, z);
            if (!block || !block.type) continue;

            const blockName = block.type.getRegistryName();
            const targetCost = blockName ? targetCosts[blockName] : undefined;
            if (blockName && targetCost !== undefined && targetCost !== null) {
                const dx = x + 0.5 - eyeX;
                const dy = y + 0.5 - eyeY;
                const dz = z + 0.5 - eyeZ;
                const distToCenterSq = dx * dx + dy * dy + dz * dz;

                if (collectReachableCandidates && distToCenterSq <= reachableCandidateReachSq) {
                    const distToCenter = Math.sqrt(distToCenterSq);
                    const dotToCenter = hasLookVec && distToCenter > 0 ? (dx * lookX + dy * lookY + dz * lookZ) / distToCenter : 1;
                    candidateX[reachableCount] = x;
                    candidateY[reachableCount] = y;
                    candidateZ[reachableCount] = z;
                    candidateCheapCost[reachableCount] = this.calculateBlockCost(targetCost, distToCenter, dotToCenter);
                    candidateBlockName[reachableCount] = blockName;
                    candidateTargetCost[reachableCount] = targetCost;
                    reachableCount++;
                }

                if (collectApproachTargets && distToCenterSq <= approachReachSq) {
                    const distToCenter = Math.sqrt(distToCenterSq);
                    this.insertSortedCandidate(
                        approachTargets,
                        {
                            x,
                            y,
                            z,
                            cost: this.calculateApproachCost(targetCost, distToCenter),
                            blockName,
                            dist: distToCenter,
                            targetMode: TARGET_MODES.APPROACH,
                        },
                        this.approachTargetBudget
                    );
                }
            }

            for (let i = 0; i < 6; i++) {
                const nx = x + BFS_DIR_X[i],
                    ny = y + BFS_DIR_Y[i],
                    nz = z + BFS_DIR_Z[i];

                if (!this.isWithinVisitedBounds(nx, ny, nz, minBx, minBy, minBz, dimX, dimY, dimZ)) continue;

                const vIdx = nx - minBx + dimX * (ny - minBy + dimY * (nz - minBz));
                if (visited[vIdx] !== visitMark) {
                    const ddx = nx + 0.5 - eyeX;
                    const ddy = ny + 0.5 - eyeY;
                    const ddz = nz + 0.5 - eyeZ;
                    if (ddx * ddx + ddy * ddy + ddz * ddz <= bfsReachSq) {
                        visited[vIdx] = visitMark;
                        queueX[tail] = nx;
                        queueY[tail] = ny;
                        queueZ[tail] = nz;
                        tail++;
                    }
                }
            }
        }

        reachableCandidates.count = reachableCount;
        reachableCandidates.length = reachableCount;
        reachableCandidates.x = candidateX;
        reachableCandidates.y = candidateY;
        reachableCandidates.z = candidateZ;
        reachableCandidates.cheapCost = candidateCheapCost;
        reachableCandidates.blockName = candidateBlockName;
        reachableCandidates.targetCost = candidateTargetCost;

        return {
            reachableCandidates,
            approachTargets,
            visitedCount: head,
        };
    }

    evaluateReachableCandidates(candidates, eyePos, lookVec, maxReachSq) {
        if (!candidates) return [];

        let sortedCandidates = candidates;
        if (Array.isArray(candidates)) {
            if (candidates.length === 0) return [];
        } else {
            const count = candidates.count || candidates.length || 0;
            if (count === 0) return [];

            sortedCandidates = new Array(count);
            for (let i = 0; i < count; i++) {
                sortedCandidates[i] = {
                    x: candidates.x[i],
                    y: candidates.y[i],
                    z: candidates.z[i],
                    cheapCost: candidates.cheapCost[i],
                    blockName: candidates.blockName[i],
                    targetCost: candidates.targetCost[i],
                };
            }
        }

        sortedCandidates.sort((a, b) => a.cheapCost - b.cheapCost);

        const visibleTargets = [];
        let evaluatedCount = 0;

        for (let i = 0; i < sortedCandidates.length; i++) {
            if (evaluatedCount >= this.reachableCandidateEvaluationBudget && visibleTargets.length >= this.reachableVisibleStopCount) {
                break;
            }

            evaluatedCount++;

            const candidate = sortedCandidates[i];
            const aimData = this.findVisibleAimPoint(candidate.x, candidate.y, candidate.z, eyePos, lookVec, maxReachSq, this.FOVPenalty);
            if (!aimData) continue;

            const baseCost = this.calculateBlockCost(candidate.targetCost, aimData.dist, aimData.dot);
            const visibilityStability = this.calculateVisibilityStability(candidate.x, candidate.y, candidate.z, eyePos, maxReachSq, 1);
            const cost = baseCost + (1 - visibilityStability) * 18;

            this.insertSortedCandidate(
                visibleTargets,
                {
                    x: candidate.x,
                    y: candidate.y,
                    z: candidate.z,
                    cost,
                    blockName: candidate.blockName,
                    aimX: aimData.x,
                    aimY: aimData.y,
                    aimZ: aimData.z,
                    visibilityStability,
                    targetMode: TARGET_MODES.REACHABLE,
                },
                this.reachableVisibleTargetBudget
            );
        }

        return visibleTargets;
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
        const allowApproachTargets = this.MOVEMENT && !this.manualScan && this.approachScanReach > this.mineReach;
        const mineReachSq = this.mineReach * this.mineReach;
        const reachableScan = this.collectScanTargets(targetCosts, start, eyePos, lookVec, this.mineReach, excludedBlock, true, false);
        if (!reachableScan) {
            this.scanning = false;
            this.currentTarget = null;
            this.foundLocations = [];
            this.lowestCostBlockIndex = 0;
            return;
        }

        let found = this.evaluateReachableCandidates(reachableScan.reachableCandidates, eyePos, lookVec, mineReachSq);
        if (found.length === 0 && allowApproachTargets) {
            const approachScan = this.collectScanTargets(targetCosts, start, eyePos, lookVec, this.approachScanReach, excludedBlock, false, true);
            found = approachScan?.approachTargets || [];
        }

        if (found.length > 0) {
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
        const eyeX = eyePos.x,
            eyeY = eyePos.y,
            eyeZ = eyePos.z;
        const vx = cx - eyeX,
            vy = cy - eyeY,
            vz = cz - eyeZ;
        const vLenSq = vx * vx + vy * vy + vz * vz;
        if (vLenSq === 0) return null;

        if (checkFov && lookVec) {
            const vLen = Math.sqrt(vLenSq);
            const dotToCenter = (vx * lookVec.x + vy * lookVec.y + vz * lookVec.z) / vLen;
            if (dotToCenter < -0.05) return null;
        }

        const invX = vx === 0 ? Infinity : 1 / vx,
            invY = vy === 0 ? Infinity : 1 / vy,
            invZ = vz === 0 ? Infinity : 1 / vz;
        const tx1 = (x - eyeX) * invX,
            tx2 = (x + 1 - eyeX) * invX;
        const ty1 = (y - eyeY) * invY,
            ty2 = (y + 1 - eyeY) * invY;
        const tz1 = (z - eyeZ) * invZ,
            tz2 = (z + 1 - eyeZ) * invZ;

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

        let resultX = 0;
        let resultY = 0;
        let resultZ = 0;
        let found = false;
        let axis = faceAxis;
        let pass = 0;

        while (!found && pass < 3) {
            if (pass === 1) axis = ORTHO_FACE_AXES[faceAxis][0];
            else if (pass === 2) axis = ORTHO_FACE_AXES[faceAxis][1];

            const isPrimaryAxis = pass === 0;
            const isX = axis === 'x';
            const isY = axis === 'y';
            let localS = s;
            if (!isPrimaryAxis) {
                if (isX) localS = eyeX >= cx ? 1 : -1;
                else if (isY) localS = eyeY >= cy ? 1 : -1;
                else localS = eyeZ >= cz ? 1 : -1;
            }

            if (isPrimaryAxis) {
                let uSource = isX ? eyeY : eyeX;
                let vSource = isY ? eyeZ : eyeY;
                let uBase = (isX ? y : x) + AIM_POINT_LO;
                let vBase = (isY ? z : y) + AIM_POINT_LO;
                let uLimit = (isX ? y : x) + AIM_POINT_HI;
                let vLimit = (isY ? z : y) + AIM_POINT_HI;

                let uRaw = uSource < uBase ? uBase : uSource;
                if (uRaw > uLimit) uRaw = uLimit;
                uRaw -= isX ? cy : cx;

                let vRaw = vSource < vBase ? vBase : vSource;
                if (vRaw > vLimit) vRaw = vLimit;
                vRaw -= isY ? cz : cy;

                let uMid = uRaw;
                if (uMid < -AIM_POINT_MID_CAP) uMid = -AIM_POINT_MID_CAP;
                else if (uMid > AIM_POINT_MID_CAP) uMid = AIM_POINT_MID_CAP;

                let vMid = vRaw;
                if (vMid < -AIM_POINT_MID_CAP) vMid = -AIM_POINT_MID_CAP;
                else if (vMid > AIM_POINT_MID_CAP) vMid = AIM_POINT_MID_CAP;

                const uEdge = uRaw >= 0 ? AIM_POINT_EDGE_MAG : -AIM_POINT_EDGE_MAG;
                const vEdge = vRaw >= 0 ? AIM_POINT_EDGE_MAG : -AIM_POINT_EDGE_MAG;

                for (let sampleIndex = 0; sampleIndex < 4 && !found; sampleIndex++) {
                    let u = 0;
                    let v = 0;
                    if (sampleIndex === 0) {
                        u = uMid;
                        v = vMid;
                    } else if (sampleIndex === 2) {
                        u = uEdge;
                    } else if (sampleIndex === 3) {
                        v = vEdge;
                    }
                    let tx;
                    let ty;
                    let tz;
                    let fx;
                    let fy;
                    let fz;

                    if (isX) {
                        tx = cx + localS * AIM_POINT_INSET;
                        ty = cy + u;
                        tz = cz + v;
                        fx = cx + localS * AIM_POINT_FACE_INSET;
                        fy = ty;
                        fz = tz;
                        if (ty < y + AIM_POINT_LO) ty = y + AIM_POINT_LO;
                        else if (ty > y + AIM_POINT_HI) ty = y + AIM_POINT_HI;
                        if (tz < z + AIM_POINT_LO) tz = z + AIM_POINT_LO;
                        else if (tz > z + AIM_POINT_HI) tz = z + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else if (isY) {
                        tx = cx + u;
                        ty = cy + localS * AIM_POINT_INSET;
                        tz = cz + v;
                        fx = tx;
                        fy = cy + localS * AIM_POINT_FACE_INSET;
                        fz = tz;
                        if (tx < x + AIM_POINT_LO) tx = x + AIM_POINT_LO;
                        else if (tx > x + AIM_POINT_HI) tx = x + AIM_POINT_HI;
                        if (tz < z + AIM_POINT_LO) tz = z + AIM_POINT_LO;
                        else if (tz > z + AIM_POINT_HI) tz = z + AIM_POINT_HI;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else {
                        tx = cx + u;
                        ty = cy + v;
                        tz = cz + localS * AIM_POINT_INSET;
                        fx = tx;
                        fy = ty;
                        fz = cz + localS * AIM_POINT_FACE_INSET;
                        if (tx < x + AIM_POINT_LO) tx = x + AIM_POINT_LO;
                        else if (tx > x + AIM_POINT_HI) tx = x + AIM_POINT_HI;
                        if (ty < y + AIM_POINT_LO) ty = y + AIM_POINT_LO;
                        else if (ty > y + AIM_POINT_HI) ty = y + AIM_POINT_HI;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                    }

                    if (Raytrace.isLineClear(eyeX, eyeY, eyeZ, tx, ty, tz, x, y, z)) {
                        resultX = fx;
                        resultY = fy;
                        resultZ = fz;
                        found = true;
                    }
                }
            } else {
                for (let sampleIndex = 0; sampleIndex < FACE_FALLBACK_SAMPLES.length && !found; sampleIndex += 2) {
                    const u = FACE_FALLBACK_SAMPLES[sampleIndex];
                    const v = FACE_FALLBACK_SAMPLES[sampleIndex + 1];
                    let tx;
                    let ty;
                    let tz;
                    let fx;
                    let fy;
                    let fz;

                    if (isX) {
                        tx = cx + localS * AIM_POINT_INSET;
                        ty = cy + u;
                        tz = cz + v;
                        fx = cx + localS * AIM_POINT_FACE_INSET;
                        fy = cy + u;
                        fz = cz + v;
                        if (ty < y + AIM_POINT_LO) ty = y + AIM_POINT_LO;
                        else if (ty > y + AIM_POINT_HI) ty = y + AIM_POINT_HI;
                        if (tz < z + AIM_POINT_LO) tz = z + AIM_POINT_LO;
                        else if (tz > z + AIM_POINT_HI) tz = z + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else if (isY) {
                        ty = cy + localS * AIM_POINT_INSET;
                        tx = cx + u;
                        tz = cz + v;
                        fy = cy + localS * AIM_POINT_FACE_INSET;
                        fx = cx + u;
                        fz = cz + v;
                        if (tx < x + AIM_POINT_LO) tx = x + AIM_POINT_LO;
                        else if (tx > x + AIM_POINT_HI) tx = x + AIM_POINT_HI;
                        if (tz < z + AIM_POINT_LO) tz = z + AIM_POINT_LO;
                        else if (tz > z + AIM_POINT_HI) tz = z + AIM_POINT_HI;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else {
                        tz = cz + localS * AIM_POINT_INSET;
                        tx = cx + u;
                        ty = cy + v;
                        fz = cz + localS * AIM_POINT_FACE_INSET;
                        fx = cx + u;
                        fy = cy + v;
                        if (tx < x + AIM_POINT_LO) tx = x + AIM_POINT_LO;
                        else if (tx > x + AIM_POINT_HI) tx = x + AIM_POINT_HI;
                        if (ty < y + AIM_POINT_LO) ty = y + AIM_POINT_LO;
                        else if (ty > y + AIM_POINT_HI) ty = y + AIM_POINT_HI;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                    }

                    if (Raytrace.isLineClear(eyeX, eyeY, eyeZ, tx, ty, tz, x, y, z)) {
                        resultX = fx;
                        resultY = fy;
                        resultZ = fz;
                        found = true;
                    }
                }
            }

            pass++;
        }

        if (!found) return null;

        const dX = resultX - eyeX,
            dY = resultY - eyeY,
            dZ = resultZ - eyeZ;
        const distSq = dX * dX + dY * dY + dZ * dZ;

        if (distSq > maxReachSq) return null;

        const dist = Math.sqrt(distSq);
        const dot = lookVec && dist > 0 ? (dX * lookVec.x + dY * lookVec.y + dZ * lookVec.z) / dist : 1;

        return { x: resultX, y: resultY, z: resultZ, dist, dot };
    }

    calculateBlockCost(baseCost, distance, dotProduct) {
        return baseCost + distance * 2 - dotProduct * 50;
    }

    calculateApproachCost(baseCost, distance) {
        return baseCost + distance * 2;
    }

    calculateVisibilityStability(x, y, z, eyePos, maxReachSq, confirmedVisibleSamples = 0) {
        let visibleSamples = confirmedVisibleSamples;
        const sampleEye = this._visibilitySampleEye;
        sampleEye.y = eyePos.y;

        for (let i = confirmedVisibleSamples > 0 ? 3 : 0; i < VISIBILITY_OFFSETS.length; i += 3) {
            sampleEye.x = eyePos.x + VISIBILITY_OFFSETS[i];
            sampleEye.z = eyePos.z + VISIBILITY_OFFSETS[i + 2];

            if (this.findVisibleAimPoint(x, y, z, sampleEye, null, maxReachSq, false)) {
                visibleSamples++;
            }
        }

        return visibleSamples / VISIBILITY_SAMPLE_COUNT;
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
                strafeThreshold: 15,
                stopYawThreshold: 10,
                moveInMin: 1.5,
                moveInMax: 3.0,
                moveOutThreshold: 3.75,
                unsneakLargeMoveThreshold: 5.5,
                unsneakDropYThreshold: 0.5,
                jumpReachPadding: 0.2,
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
        let moveForward = values.distanceFlat > cfg.moveInMax;
        let moveBack = values.distanceFlat < cfg.moveInMin;

        const isAligned = yaw >= -cfg.stopYawThreshold && yaw <= cfg.stopYawThreshold && values.distance <= 4;
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

        const isMoving = moveRight || moveLeft || moveForward || moveBack;
        const playerFeetY = Player.getY();
        const targetTopY = this.currentTarget.y + 1;
        const dropAmount = playerFeetY - targetTopY;
        const requiresDropToMove = dropAmount > cfg.unsneakDropYThreshold && values.distanceFlat > 0.35;
        const requiresLargeMove = values.distanceFlat > cfg.unsneakLargeMoveThreshold;
        const justOutOfReach = true; //values.distance > this.mineReach && values.distance <= this.mineReach + cfg.jumpReachPadding;
        const blockedForward = moveForward && this.hasForwardObstacle();
        const shouldJump = Player.getPlayer()?.isOnGround() && justOutOfReach && blockedForward;
        const shouldUnsneak = isMoving && (requiresDropToMove || requiresLargeMove);
        this.setSneak(!shouldUnsneak);
        Keybind.setKey('space', shouldJump);
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
        this.currentTarget.dist = hit.dist;
        this.currentTarget.targetMode = TARGET_MODES.REACHABLE;
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

        const typeName = this.selectedTypeName || this.getEnabledOptionName(this.TYPE);
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

    getTunnelCostsForOres(ores) {
        const oreList = Array.isArray(ores) ? ores : [ores];
        const mergedCosts = {};

        oreList.forEach((ore) => {
            const oreCosts = this.tunnelOreCosts?.[String(ore).toLowerCase()];
            if (!oreCosts) return;
            Object.assign(mergedCosts, oreCosts);
        });

        return Object.keys(mergedCosts).length ? mergedCosts : this.tunnelCosts;
    }

    populateLocations(locations, parentManaged) {
        if (!Array.isArray(locations) || locations.length === 0) return false;
        this.manualScan = true;

        const eyePos = Player.getPlayer().getEyePos();
        const maxReachSq = this.mineReach * this.mineReach;

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
                    targetMode: TARGET_MODES.REACHABLE,
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
        this.drill = MiningUtils.getDrills()?.drill;
        if (!this.drill) {
            this.message('&cNo drill detected!');
            this.toggle(false);
            return;
        }

        this.loadAbilitySetting();
        this.fakeLookModeName = this.getEnabledOptionName(this.FAKELOOK, 'Off');
        this.selectedTypeName = this.getEnabledOptionName(this.TYPE, this.selectedTypeName);
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

        let nextTarget = null;
        if (this.foundLocations.length > 1 && current.aimX !== undefined) {
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
                for (const loc of this.foundLocations) {
                    if (loc.x === current.x && loc.y === current.y && loc.z === current.z) continue;
                    if (loc.aimX === undefined) continue;

                    const dx = loc.aimX - eyePos.x;
                    const dy = loc.aimY - eyePos.y;
                    const dz = loc.aimZ - eyePos.z;
                    const dist = Math.hypot(dx, dy, dz);
                    if (dist === 0) continue;

                    const dot = (dx * normLookX + dy * normLookY + dz * normLookZ) / dist;
                    const baseCost = this.COSTTYPE?.[loc.blockName] ?? 5;
                    const cost = this.calculateBlockCost(baseCost, dist, dot);

                    if (cost < bestCost) {
                        bestCost = cost;
                        nextTarget = loc;
                    }
                }
            }
        } else if (this.foundLocations.length > 1) {
            for (let i = 0; i < this.foundLocations.length; i++) {
                const loc = this.foundLocations[i];
                if (loc.x === current.x && loc.y === current.y && loc.z === current.z) continue;
                nextTarget = loc;
                break;
            }
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
        const palette = isFakelook ? this._renderPalette.fake : this._renderPalette.normal;

        Render.drawStyledBox(new Vec3d(this.lastRenderPos.x, this.lastRenderPos.y, this.lastRenderPos.z), palette.currentFill, palette.currentWire, 6, false);

        if (this.lastAimPos) {
            const d = 0.08;
            const { x, y, z } = this.lastAimPos;
            Render.drawLine(new Vec3d(x - d, y, z), new Vec3d(x + d, y, z), palette.aimColor, 2, false);
            Render.drawLine(new Vec3d(x, y - d, z), new Vec3d(x, y + d, z), palette.aimColor, 2, false);
            Render.drawLine(new Vec3d(x, y, z - d), new Vec3d(x, y, z + d), palette.aimColor, 2, false);
        }

        if (this.lastNextPos) {
            Render.drawStyledBox(new Vec3d(this.lastNextPos.x, this.lastNextPos.y, this.lastNextPos.z), palette.nextFill, palette.nextWire, 6, false);
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
