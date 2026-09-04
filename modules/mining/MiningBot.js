import { BP, ClipContext, CritParticle, HappyVillagerParticle, MCHand, Vec3d } from '../../utils/Constants';
import { MathUtils } from '../../utils/Math';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { NukerUtils } from '../../utils/NukerUtils';
import { ClientboundLevelParticlesPacket } from '../../utils/Packets';
import { Raytrace, visibilityChecker } from '../../utils/Raytrace';
import { manager } from '../../utils/SkyblockEvents';
import { Utils } from '../../utils/Utils';
import { Guis } from '../../utils/player/Inventory';
import { OreRotations } from '../../utils/player/OreRotations';
import { ServerInfo } from '../../utils/player/ServerInfo';
import { TabListUtils } from '../../utils/TabListUtils';
import { Mouse } from '../../utils/Ungrab';

const ORTHO_FACE_AXES = {
    x: ['y', 'z'],
    y: ['x', 'z'],
    z: ['x', 'y'],
};
const FACE_FALLBACK_SAMPLES = [0, 0, 0.35, 0, -0.35, 0, 0, 0.35, 0, -0.35, 0.35, 0.35, -0.35, -0.35];
const VISIBILITY_OFFSETS = [0, 0, 0, 0.18, 0, 0, -0.18, 0, 0, 0, 0, 0.18, 0, 0, -0.18];
const VISIBILITY_SAMPLE_COUNT = VISIBILITY_OFFSETS.length / 3;
const AIM_POINT_FACE_INSET = 0.48;
const AIM_POINT_EDGE_MAG = 0.4;
const AIM_POINT_MID_CAP = 0.3;
const AIM_POINT_LO = 0.02;
const AIM_POINT_HI = 0.98;
const AIM_RETRY_MIN_DELTA_SQ = 0.0025;
const VISIBLE_RAY_OFFSETS = [0.15, 0.5, 0.85];
const TARGET_MODES = {
    REACHABLE: 'reachable',
    APPROACH: 'approach',
};
const PRECISION_MINER_PARTICLE_LIFETIME_MS = 500;

class Bot extends ModuleBase {
    constructor() {
        super({
            name: 'Mining Bot',
            subcategory: 'Mining',
            description: 'Universal settings for Mining & block miner',
            tooltip: 'Automatically mines.',
            theme: '#5a7cbb',
            isMacro: true,
        });

        this.foundLocations = [];
        this.lowestCostBlockIndex = 0;

        this.PRIORITIZE_TITANIUM = true;
        this.PRIORITIZE_GRAY_MITHRIL = false;
        this.PRECISION_MINER = true;
        this.TICKGLIDE = true;
        this.FAKELOOK = false;
        this.MOVEMENT = false;
        this.SCAN_ONLY = false;
        this.DEBUG_MODE = false;
        this.ADDITIONAL_LAG_COMP = 0;
        this.rotationSpeed = 0.48;
        this.sneakWhileMining = true;
        this.minimumVisibleRays = 0;

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
        this.refreshingMiningStats = false;
        this.miningStatsRefreshToken = 0;
        this.FOVPenalty = true;
        this.abilityFromChat = false;
        this.lastUse = Date.now();
        this.ABILITY_COOLDOWN_MS = 200000;
        this._pendingAbilityActivation = false;
        this.fakeLookModeName = 'Off';
        this.selectedTypeName = 'Mithril';
        this._renderPalette = {
            normal: {
                currentFill: new RenderColor(85, 255, 255, 60),
                currentWire: new RenderColor(85, 255, 255, 255),
                aimColor: new RenderColor(255, 220, 80, 255),
                nextFill: new RenderColor(255, 170, 100, 60),
                nextWire: new RenderColor(255, 170, 100, 255),
            },
            fake: {
                currentFill: new RenderColor(180, 100, 255, 60),
                currentWire: new RenderColor(180, 100, 255, 255),
                aimColor: new RenderColor(255, 150, 255, 255),
                nextFill: new RenderColor(255, 130, 70, 60),
                nextWire: new RenderColor(255, 130, 70, 255),
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
        this.initCosts();
        this.bindToggleKey();
        this.initEventHandlers();
        this.initSettings();

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
        this.debug = register('postRenderWorld', () => this.renderDebug()).unregister();
        this.normalRender = register('postRenderWorld', () => this.renderNormal()).unregister();

        this.on('packetReceived', (packet) => this.onPrecisionMinerParticle(packet)).setFilteredClass(ClientboundLevelParticlesPacket);
        this.on('tick', () => {
            if (!this.enabled) return;
            if (this.refreshingMiningStats) {
                this.stopMiningControls(true);
                OreRotations.stop();
                return;
            }
            if (Client.isInGui()) {
                Client.unpressKeys();
                OreRotations.stop();
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
            if (!this.enabled || this.refreshingMiningStats) return;
            this.resetTickCounters();
            this.abilityFromChat = true;
            this.state = this.STATES.ABILITY;
            if (this.DEBUG_MODE) this.message(`&a[DEBUG] abilityready → state=ABILITY, abilityFromChat=true`);
        });

        manager.subscribe('abilityused', () => {
            if (!this.enabled) return;
            if (this.ability === 'SpeedBoost') this.speedBoost = true;
            this.abilityFromChat = false;
            this.lastUse = Date.now();
            this.resetTickCounters();
            if (this.DEBUG_MODE) this.message(`&e[DEBUG] abilityused → abilityFromChat=false, lastUse=${this.lastUse}`);
        });

        manager.subscribe('abilitygone', () => {
            if (!this.enabled) return;
            this.speedBoost = false;
            this.abilityFromChat = false;
            this.lastUse = Date.now();
            this.resetTickCounters();
            if (this.DEBUG_MODE) this.message(`&e[DEBUG] abilitygone → abilityFromChat=false, lastUse=${this.lastUse}`);
        });

        manager.subscribe('abilitycooldown', () => {
            if (!this.enabled) return;
            this.lastUse = Date.now();
            this.state = this.STATES.MINING;
            if (this.DEBUG_MODE) this.message(`&c[DEBUG] abilitycooldown → lastUse=${this.lastUse}, state=MINING`);
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
                if (!value) {
                    Client.stopMovement();
                    Client.setKey('space', false);
                    Client.setKey('shift', false);
                    this.lastSneakCommand = false;
                }
            },
            'Moves toward visible ore only while it is outside normal mining reach.',
            true
        );
        this.addSlider(
            'Block Reach',
            3,
            10,
            8,
            (value) => (this.approachScanReach = value),
            'Maximum distance at which Movement can select an out-of-reach block to approach.'
        );
        this.addToggle(
            'Sneak While Mining',
            (value) => {
                this.sneakWhileMining = value;
                if (!value && this.enabled) {
                    Client.setKey('shift', false);
                    this.lastSneakCommand = false;
                }
            },
            'Sneak while actively mining a block.',
            true
        );
        this.addSlider(
            'Minimum Visible Rays',
            0,
            9,
            0,
            (value) => (this.minimumVisibleRays = Math.round(value)),
            'Minimum number of nine face samples that must raycast to the block. Zero accepts any visible amount.'
        );
        let additionalLagCompensation;
        this.addToggle(
            'Tick Gliding',
            (value) => {
                this.TICKGLIDE = value;
                additionalLagCompensation.visible = value;
            },
            'Predicts when blocks are broken to begin mining the next block early.',
            true
        );
        additionalLagCompensation = this.addSlider(
            'Additional lag compensation',
            0,
            5,
            1,
            (value) => {
                this.ADDITIONAL_LAG_COMP = value;
            },
            'Adds extra ticks to glide delay on top of TPS compensation. (Tick Gliding)'
        );
        additionalLagCompensation.visible = this.TICKGLIDE;
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
        this.addToggle(
            'Precision Miner',
            (value) => {
                this.PRECISION_MINER = value;
                if (!value) this.precisionMinerAim = null;
            },
            'Aims at the Precision Miner particle, speeds up mining mithril.',
            true
        );
        this.addSlider('Mining Rotation Speed', 1, 100, 48, (value) => (this.rotationSpeed = value / 100), 'Rotation speed for mining targets.');
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
        // this.addToggle(
        //     'Debug Mode',
        //     (value) => {
        //         this.DEBUG_MODE = value;
        //         value ? this.debug.register() : this.debug.unregister();
        //     },
        //     'Debugging - not recommended for average use.'
        // );
        // this.addToggle(
        //     'Scan Mode',
        //     (value) => {
        //         this.SCAN_ONLY = value;
        //     },
        //     'Continuously scans for targets every tick.'
        // );
    }

    setPrioritizeTitanium(value) {
        this.PRIORITIZE_TITANIUM = value;
        this.updateMithrilCosts();
    }

    setPrioritizeGrayMithril(value) {
        this.PRIORITIZE_GRAY_MITHRIL = value;
        this.updateMithrilCosts();
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
        return !blockName || blockName.endsWith(':air') || blockName.endsWith('_air') || blockName.includes('bedrock');
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

        const forwardX = Player.getX() + lookVec.x() * 0.8;
        const forwardZ = Player.getZ() + lookVec.z() * 0.8;
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
                Client.setKey('leftclick', false);
                this.lastBlockType = blockName;
                this.resetTickCounters();
                this.handleRotationOrScan(false);
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
            Player.getPlayer().swing(MCHand.MAIN_HAND);
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
            Client.stopMovement();
            Client.setKey('space', false);
            this.setSneak(false);
        }
        Client.setKey('leftclick', false);
    }

    handleBreaking(blockName, fakeLookMode) {
        if (fakeLookMode === 'Off') {
            Client.setKey('leftclick', true);
        } else {
            Client.setKey('leftclick', false);
            if (this.isAirOrBedrock(blockName)) {
                this.lowestCostBlockIndex++;
                if (this.lowestCostBlockIndex >= this.foundLocations.length) this.allowScan = true;
            }
            if (this.currentTarget && !this.nukedBlock) {
                const pos = [this.currentTarget.x, this.currentTarget.y, this.currentTarget.z];
                if (fakeLookMode === 'Instant') {
                    // Instant nuker might be bad dont use it
                    //NukerUtils.nuke(pos, this.totalTicks);
                } else if (fakeLookMode === 'Queued') NukerUtils.nukeQueueAdd(pos, this.totalTicks);
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

        this.scanForBlock(this.COSTTYPE, this.currentTarget);
        this.allowScan = false;
    }

    isTunnelMode() {
        if (this.COSTTYPE === this.tunnelCosts) return true;
        if (this.selectedTypeName === 'Tunnel') return true;
        const selectedType = Array.isArray(this.TYPE) ? this.TYPE.find((option) => option.enabled)?.name : null;
        return selectedType === 'Tunnel';
    }

    handleAbilityState() {
        if (this.SCAN_ONLY) return (this.state = this.STATES.MINING);

        this.stopMiningControls(true);
        OreRotations.stop();

        const now = Date.now();
        const abilityStatus = TabListUtils.getPickaxeAbilityStatus();

        if (this.DEBUG_MODE) {
            this.message(
                `&7[DEBUG] handleAbilityState status="${abilityStatus}" chat=${this.abilityFromChat} lastUse=${this.lastUse} pending=${this._pendingAbilityActivation} handSwinging=${Player.getPlayer().handSwinging}`
            );
        }

        if (this._pendingAbilityActivation) {
            this._pendingAbilityActivation = false;
            Client.rightClick();
            if (this.DEBUG_MODE) this.message(`&a[DEBUG] RIGHT-CLICKED status="${abilityStatus}"`);
            this.lastUse = now;
            this.abilityFromChat = false;
            this.state = this.STATES.MINING;
            return;
        }

        if (abilityStatus.includes('Available') || this.abilityFromChat || this.lastUse + this.ABILITY_COOLDOWN_MS < now) {
            if (this.ensureDrillEquipped(this.drill)) return;

            Client.setKey('leftclick', false);
            this._pendingAbilityActivation = true;
            if (this.DEBUG_MODE) this.message(`&e[DEBUG] Released left-click, will right-click next tick (swing=${Player.getPlayer().handSwinging})`);
            return;
        }

        if (this.DEBUG_MODE) this.message(`&c[DEBUG] No condition met, going MINING`);
        this.state = this.STATES.MINING;
    }

    handleMiningState() {
        const now = Date.now();
        this.tickCount++;

        if (this.SCAN_ONLY) {
            this.scanForBlock(this.COSTTYPE);
            this.stopMiningControls(this.MOVEMENT);
            OreRotations.stop();
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
            this.setSneak(false);
            OreRotations.stop();
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
            this.setSneak(false);
            OreRotations.stop();
            return;
        }

        const hasFreshAimPoint = this.refreshCurrentTargetAimPoint();
        if (!hasFreshAimPoint) {
            if (wasApproachTarget && this.MOVEMENT) {
                this.handleVeinMovement();

                const approachVector = this.getAimVectorForTarget(this.currentTarget);
                if (approachVector) OreRotations.trackVector(approachVector, this.rotationSpeed);
                return;
            }

            this.movementReevalCooldownUntil = Math.max(this.movementReevalCooldownUntil, now + this.movementReevalCooldownMs);
            this.stopMiningControls(true);
            OreRotations.stop();
            this.scanForBlock(this.COSTTYPE, this.currentTarget);
            this.allowScan = false;
            return;
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
        const precisionMinerAim = this.getPrecisionMinerAim();
        this.miningspeed = ((tunnelMode ? MiningUtils.getSpeedWithCold() : MiningUtils.getMiningSpeed()) || 1) * (precisionMinerAim?.boosted ? 1.3 : 1);
        this.totalTicks = MiningUtils.getMineTime(this.currentTarget, this.miningspeed, this.speedBoost) + this.glideDelay();

        this.handleBreaking(blockName, fakeLookMode);

        const timedOut = this.tickCount > this.totalTicks * 2;
        const shouldGlide = this.shouldGlideToNextBlock(blockName);
        if (timedOut && !this.isAirOrBedrock(blockName)) {
            const failedAim = {
                x: this.currentTarget.aimX,
                y: this.currentTarget.aimY,
                z: this.currentTarget.aimZ,
            };
            this.resetTickCounters();
            this.precisionMinerAim = null;
            this.currentTarget.aimX = this.currentTarget.aimY = this.currentTarget.aimZ = null;
            if (!this.refreshCurrentTargetAimPoint(failedAim)) this.handleRotationOrScan(false);
        } else if (shouldGlide) {
            this.resetTickCounters();
            this.handleRotationOrScan(false);
        }

        const targetVector = this.getPrecisionMinerAim() || this.getAimVectorForTarget(this.currentTarget);
        if (this.currentTarget && targetVector) {
            OreRotations.trackVector(targetVector, this.rotationSpeed);
        }
    }

    onPrecisionMinerParticle(packet) {
        if (!this.PRECISION_MINER) return;
        const particle = packet.getParticle();
        const type = particle?.getType?.() ?? particle;
        if (
            (type !== CritParticle && type !== HappyVillagerParticle) ||
            packet.getCount() !== 1 ||
            packet.getXDist() !== 0 ||
            packet.getYDist() !== 0 ||
            packet.getZDist() !== 0 ||
            packet.getMaxSpeed() !== 0
        )
            return;

        const target = this.currentTarget;
        if (!target) return;
        const aim = {
            x: packet.getX(),
            y: packet.getY(),
            z: packet.getZ(),
            targetX: target.x,
            targetY: target.y,
            targetZ: target.z,
            boosted: type === HappyVillagerParticle,
            expiresAt: Date.now() + PRECISION_MINER_PARTICLE_LIFETIME_MS,
        };
        if (this.isPrecisionMinerAimValid(aim)) this.precisionMinerAim = aim;
    }

    getPrecisionMinerAim() {
        if (!this.PRECISION_MINER) return null;
        if (!this.precisionMinerAim || this.precisionMinerAim.expiresAt < Date.now()) return null;
        return this.isPrecisionMinerAimValid(this.precisionMinerAim) ? this.precisionMinerAim : null;
    }

    isPrecisionMinerAimValid(aim) {
        const target = this.currentTarget;
        const blockName = target && World.getBlockAt(target.x, target.y, target.z)?.type?.getRegistryName();
        if (!target || aim.targetX !== target.x || aim.targetY !== target.y || aim.targetZ !== target.z || !this.mithrilCosts[blockName]) return false;

        const player = Player.getPlayer();
        const world = World.getWorld();
        const eye = player?.getEyePosition();
        if (!player || !world || !eye) return false;

        const dx = aim.x - eye.x();
        const dy = aim.y - eye.y();
        const dz = aim.z - eye.z();
        const distance = Math.hypot(dx, dy, dz);
        if (!distance || distance > this.faceReach) return false;

        const end = new Vec3d(
            eye.x() + (dx / distance) * this.faceReach,
            eye.y() + (dy / distance) * this.faceReach,
            eye.z() + (dz / distance) * this.faceReach
        );
        const hit = world.clip(new ClipContext(eye, end, ClipContext.Block.OUTLINE, ClipContext.Fluid.NONE, player));
        if (String(hit?.getType?.()) !== 'BLOCK') return false;
        const hitPos = hit?.getBlockPos?.();
        if (!hitPos || hitPos.getX() !== target.x || hitPos.getY() !== target.y || hitPos.getZ() !== target.z) return false;

        const hitPoint = hit.getLocation();
        return Math.hypot(hitPoint.x() - eye.x(), hitPoint.y() - eye.y(), hitPoint.z() - eye.z()) >= distance;
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

    collectScanTargets(targetCosts, eyePos, lookVec, scanReach, excludedBlock = null, collectReachableCandidates = true, collectApproachTargets = false) {
        const reachableCandidateReach = this.mineReach + this.bfsPad;
        const reachableCandidateReachSq = reachableCandidateReach * reachableCandidateReach;
        const approachReachSq = this.approachScanReach * this.approachScanReach;
        const approachTargets = [];

        const reach = scanReach + this.bfsPad;
        const minX = Math.floor(eyePos.x() - reach) - 1;
        const minY = Math.floor(eyePos.y() - reach) - 1;
        const minZ = Math.floor(eyePos.z() - reach) - 1;
        const maxX = Math.floor(eyePos.x() + reach) + 1;
        const maxY = Math.floor(eyePos.y() + reach) + 1;
        const maxZ = Math.floor(eyePos.z() + reach) + 1;

        const blockTypes = Object.keys(targetCosts).map((name) => new BlockType(name));
        const blocks = World.getBlocksInBox(minX, minY, minZ, maxX, maxY, maxZ, blockTypes);

        const eyeX = eyePos.x();
        const eyeY = eyePos.y();
        const eyeZ = eyePos.z();
        const hasLookVec = !!lookVec;
        const lookX = hasLookVec ? lookVec.x() : 0;
        const lookY = hasLookVec ? lookVec.y() : 0;
        const lookZ = hasLookVec ? lookVec.z() : 0;
        const scanReachSq = reach * reach;

        const reachableCandidates = [];

        for (const block of blocks) {
            const x = block.x;
            const y = block.y;
            const z = block.z;

            if (excludedBlock && x === excludedBlock.x && y === excludedBlock.y && z === excludedBlock.z) continue;

            const blockName = block.type.getRegistryName();
            const targetCost = blockName ? targetCosts[blockName] : undefined;
            if (targetCost === undefined || targetCost === null) continue;

            const dx = x + 0.5 - eyeX;
            const dy = y + 0.5 - eyeY;
            const dz = z + 0.5 - eyeZ;
            const distToCenterSq = dx * dx + dy * dy + dz * dz;

            if (distToCenterSq > scanReachSq) continue;

            if (collectReachableCandidates && distToCenterSq <= reachableCandidateReachSq) {
                const distToCenter = Math.sqrt(distToCenterSq);
                const dotToCenter = hasLookVec && distToCenter > 0 ? (dx * lookX + dy * lookY + dz * lookZ) / distToCenter : 1;
                reachableCandidates.push({
                    x,
                    y,
                    z,
                    cheapCost: this.calculateBlockCost(targetCost, distToCenter, dotToCenter),
                    blockName,
                    targetCost,
                });
            }

            if (collectApproachTargets && distToCenterSq <= approachReachSq) {
                const distToCenter = Math.sqrt(distToCenterSq);
                this.insertSortedCandidate(
                    approachTargets,
                    { x, y, z, cost: this.calculateApproachCost(targetCost, distToCenter), blockName, dist: distToCenter, targetMode: TARGET_MODES.APPROACH },
                    this.approachTargetBudget
                );
            }
        }

        return { reachableCandidates, approachTargets };
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
        const checkFov = this.FOVPenalty && !this.isTunnelMode();
        let evaluatedCount = 0;

        for (const candidate of sortedCandidates) {
            if (
                evaluatedCount >= this.reachableCandidateEvaluationBudget &&
                (visibleTargets.length >= this.reachableVisibleStopCount || evaluatedCount >= this.reachableCandidateEvaluationBudget * 3)
            )
                break;

            evaluatedCount++;

            const aimData = this.findVisibleAimPoint(candidate.x, candidate.y, candidate.z, eyePos, lookVec, maxReachSq, checkFov);
            if (!aimData || !this.hasMinimumVisibleRays(candidate, aimData, eyePos)) continue;

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

    scanForBlock(targetCosts, excludedBlock = null) {
        if (!targetCosts) return this.message('No target specified, is cost type set?');

        this.scanning = true;

        const eyePos = Player.getPlayer().getEyePosition();
        const lookVec = Player.asPlayerMP().getLookVector();
        const allowApproachTargets = this.MOVEMENT && !this.manualScan && !this.isTunnelMode() && this.approachScanReach > this.mineReach;
        const mineReachSq = this.mineReach * this.mineReach;

        const scanned = this.collectScanTargets(targetCosts, eyePos, lookVec, this.mineReach, excludedBlock, true, false);

        let found = this.evaluateReachableCandidates(scanned.reachableCandidates, eyePos, lookVec, mineReachSq);
        if (found.length === 0 && allowApproachTargets) {
            found = this.collectScanTargets(targetCosts, eyePos, lookVec, this.approachScanReach, excludedBlock, false, true)
                .approachTargets.map((candidate) => {
                    const aim = this.findVisibleAimPoint(candidate.x, candidate.y, candidate.z, eyePos, lookVec, this.approachScanReach ** 2, false);
                    if (!aim) return null;

                    const visibleRays = this.minimumVisibleRays > 0 ? this.countVisibleRays(candidate, aim, eyePos) : 9;
                    return {
                        ...candidate,
                        aimX: aim.x,
                        aimY: aim.y,
                        aimZ: aim.z,
                        dist: aim.dist,
                        visibleRays,
                    };
                })
                .filter(Boolean);

            const approachTarget = found[0];
            if (approachTarget && approachTarget.visibleRays < this.minimumVisibleRays) {
                approachTarget.visibilityStrafeKey = this.findVisibilityStrafeKey(approachTarget, eyePos, approachTarget.visibleRays);
            }
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

    findVisibleAimPoint(x, y, z, eyePos, lookVec, maxReachSq, checkFov = true, excludedAim = null) {
        if (!eyePos || !Number.isFinite(maxReachSq) || maxReachSq <= 0) return null;

        const cx = x + 0.5,
            cy = y + 0.5,
            cz = z + 0.5;
        const eyeX = eyePos.x(),
            eyeY = eyePos.y(),
            eyeZ = eyePos.z();
        const rayEye = { x: eyeX, y: eyeY, z: eyeZ };
        const hasExcludedAim = excludedAim && [excludedAim.x, excludedAim.y, excludedAim.z].every(Number.isFinite);
        const isExcludedAim = (pointX, pointY, pointZ) =>
            hasExcludedAim && (pointX - excludedAim.x) ** 2 + (pointY - excludedAim.y) ** 2 + (pointZ - excludedAim.z) ** 2 < AIM_RETRY_MIN_DELTA_SQ;
        const vx = cx - eyeX,
            vy = cy - eyeY,
            vz = cz - eyeZ;
        const vLenSq = vx * vx + vy * vy + vz * vz;
        if (vLenSq === 0) return null;

        if (checkFov && lookVec) {
            const vLen = Math.sqrt(vLenSq);
            const dotToCenter = (vx * lookVec.x() + vy * lookVec.y() + vz * lookVec.z()) / vLen;
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
                    let fx;
                    let fy;
                    let fz;

                    if (isX) {
                        fx = cx + localS * AIM_POINT_FACE_INSET;
                        fy = cy + u;
                        fz = cz + v;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else if (isY) {
                        fx = cx + u;
                        fy = cy + localS * AIM_POINT_FACE_INSET;
                        fz = cz + v;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else {
                        fx = cx + u;
                        fy = cy + v;
                        fz = cz + localS * AIM_POINT_FACE_INSET;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                    }

                    if (
                        !isExcludedAim(fx, fy, fz) &&
                        Raytrace.isLineClear(eyeX, eyeY, eyeZ, fx, fy, fz, x, y, z) &&
                        visibilityChecker.testPointNative(x, y, z, [fx, fy, fz], rayEye)
                    ) {
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
                    let fx;
                    let fy;
                    let fz;

                    if (isX) {
                        fx = cx + localS * AIM_POINT_FACE_INSET;
                        fy = cy + u;
                        fz = cz + v;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else if (isY) {
                        fy = cy + localS * AIM_POINT_FACE_INSET;
                        fx = cx + u;
                        fz = cz + v;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fz < z + AIM_POINT_LO) fz = z + AIM_POINT_LO;
                        else if (fz > z + AIM_POINT_HI) fz = z + AIM_POINT_HI;
                    } else {
                        fz = cz + localS * AIM_POINT_FACE_INSET;
                        fx = cx + u;
                        fy = cy + v;
                        if (fx < x + AIM_POINT_LO) fx = x + AIM_POINT_LO;
                        else if (fx > x + AIM_POINT_HI) fx = x + AIM_POINT_HI;
                        if (fy < y + AIM_POINT_LO) fy = y + AIM_POINT_LO;
                        else if (fy > y + AIM_POINT_HI) fy = y + AIM_POINT_HI;
                    }

                    if (
                        !isExcludedAim(fx, fy, fz) &&
                        Raytrace.isLineClear(eyeX, eyeY, eyeZ, fx, fy, fz, x, y, z) &&
                        visibilityChecker.testPointNative(x, y, z, [fx, fy, fz], rayEye)
                    ) {
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
        const dot = lookVec && dist > 0 ? (dX * lookVec.x() + dY * lookVec.y() + dZ * lookVec.z()) / dist : 1;

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
        const eyeX = typeof eyePos?.x === 'function' ? eyePos.x() : eyePos?.x;
        const eyeY = typeof eyePos?.y === 'function' ? eyePos.y() : eyePos?.y;
        const eyeZ = typeof eyePos?.z === 'function' ? eyePos.z() : eyePos?.z;
        if (![eyeX, eyeY, eyeZ].every(Number.isFinite)) return visibleSamples / VISIBILITY_SAMPLE_COUNT;

        for (let i = confirmedVisibleSamples > 0 ? 3 : 0; i < VISIBILITY_OFFSETS.length; i += 3) {
            const sampleEye = new Vec3d(eyeX + VISIBILITY_OFFSETS[i], eyeY, eyeZ + VISIBILITY_OFFSETS[i + 2]);

            if (this.findVisibleAimPoint(x, y, z, sampleEye, null, maxReachSq, false)) {
                visibleSamples++;
            }
        }

        return visibleSamples / VISIBILITY_SAMPLE_COUNT;
    }

    countVisibleRays(block, aim, eyePosition, stopAt = Infinity) {
        const eye = { x: eyePosition.x(), y: eyePosition.y(), z: eyePosition.z() };
        const origin = [block.x, block.y, block.z];
        const local = [aim.x - block.x, aim.y - block.y, aim.z - block.z];
        const edgeDistances = local.map((value) => Math.min(value, 1 - value));
        const faceAxis = edgeDistances.indexOf(Math.min(...edgeDistances));
        const faceOffset = local[faceAxis] < 0.5 ? AIM_POINT_LO : AIM_POINT_HI;
        const sampleAxes = [0, 1, 2].filter((axis) => axis !== faceAxis);
        let visibleRays = 0;

        for (const firstOffset of VISIBLE_RAY_OFFSETS) {
            for (const secondOffset of VISIBLE_RAY_OFFSETS) {
                const point = [block.x + 0.5, block.y + 0.5, block.z + 0.5];
                point[faceAxis] = origin[faceAxis] + faceOffset;
                point[sampleAxes[0]] = origin[sampleAxes[0]] + firstOffset;
                point[sampleAxes[1]] = origin[sampleAxes[1]] + secondOffset;
                if (visibilityChecker.testPointCustom(block.x, block.y, block.z, point, eye) && ++visibleRays >= stopAt) return visibleRays;
            }
        }
        return visibleRays;
    }

    hasMinimumVisibleRays(block, aim, eyePosition) {
        return this.minimumVisibleRays <= 0 || this.countVisibleRays(block, aim, eyePosition, this.minimumVisibleRays) >= this.minimumVisibleRays;
    }

    findVisibilityStrafeKey(block, eyePosition, currentRays) {
        const dx = block.x + 0.5 - eyePosition.x();
        const dz = block.z + 0.5 - eyePosition.z();
        const distance = Math.hypot(dx, dz);
        if (distance < 0.001) return null;

        const leftX = dz / distance;
        const leftZ = -dx / distance;
        let bestKey = null;
        let bestRays = currentRays;

        for (const [key, direction] of [
            ['a', 1],
            ['d', -1],
        ]) {
            const candidateEye = new Vec3d(eyePosition.x() + leftX * direction * 0.75, eyePosition.y(), eyePosition.z() + leftZ * direction * 0.75);
            const aim = this.findVisibleAimPoint(block.x, block.y, block.z, candidateEye, null, this.approachScanReach ** 2, false);
            if (!aim) continue;

            const visibleRays = this.countVisibleRays(block, aim, candidateEye);
            if (visibleRays > bestRays) {
                bestKey = key;
                bestRays = visibleRays;
            }
        }

        return bestKey;
    }

    setSneak(shouldSneak, force = false) {
        if (force || this.lastSneakCommand !== shouldSneak || Player.isSneaking() !== shouldSneak) {
            Client.setKey('shift', shouldSneak);
            this.lastSneakCommand = shouldSneak;
        }
    }

    handleVeinMovement() {
        if (!this.currentTarget) {
            Client.stopMovement();
            Client.setKey('space', false);
            this.setSneak(false);
            return;
        }

        if (!this.MOVEMENT) {
            Client.stopMovement();
            Client.setKey('space', false);
            this.setSneak(this.sneakWhileMining);
            return;
        }

        const targetPoint = {
            x: this.currentTarget.aimX ?? this.currentTarget.x + 0.5,
            y: this.currentTarget.aimY ?? this.currentTarget.y + 0.5,
            z: this.currentTarget.aimZ ?? this.currentTarget.z + 0.5,
        };

        const values = MathUtils.getDistanceToPlayerEyes(targetPoint);
        const aligned = Math.abs(MathUtils.calculateAngles(targetPoint).yaw) <= 18;

        if (!this.isApproachTarget()) {
            Client.stopMovement();
            Client.setKey('space', false);
            this.setSneak(this.sneakWhileMining);
            return;
        }

        const visibilityStrafeKey = this.currentTarget.visibilityStrafeKey;
        if (visibilityStrafeKey && values.distance <= this.mineReach) {
            const strafeTicks = this.currentTarget.visibilityStrafeTicks ?? 0;
            Client.setKey('a', aligned && strafeTicks < 20 && visibilityStrafeKey === 'a');
            Client.setKey('d', aligned && strafeTicks < 20 && visibilityStrafeKey === 'd');
            Client.setKey('w', false);
            Client.setKey('s', false);
            Client.setKey('space', false);
            this.setSneak(this.sneakWhileMining);
            if (!aligned) return;
            if (strafeTicks < 20) {
                this.currentTarget.visibilityStrafeTicks = strafeTicks + 1;
                return;
            }
            this.currentTarget.visibilityStrafeKey = null;
        }

        Client.setKey('a', false);
        Client.setKey('d', false);
        Client.setKey('w', aligned);
        Client.setKey('s', false);

        const blockedForward = aligned && this.hasForwardObstacle();
        const shouldJump = Player.getPlayer()?.onGround() && blockedForward && this.currentTarget.y >= Math.floor(Player.getY());
        this.setSneak(this.sneakWhileMining);
        Client.setKey('space', shouldJump);
    }

    refreshCurrentTargetAimPoint(excludedAim = null) {
        if (!this.currentTarget) return false;

        const eyePos = Player.getPlayer().getEyePosition();
        if (
            !excludedAim &&
            this.isCurrentAimPointVisible(eyePos) &&
            (!this.isApproachTarget() ||
                this.hasMinimumVisibleRays(this.currentTarget, { x: this.currentTarget.aimX, y: this.currentTarget.aimY, z: this.currentTarget.aimZ }, eyePos))
        ) {
            const dx = this.currentTarget.aimX - eyePos.x();
            const dy = this.currentTarget.aimY - eyePos.y();
            const dz = this.currentTarget.aimZ - eyePos.z();
            this.currentTarget.dist = Math.hypot(dx, dy, dz);
            this.currentTarget.targetMode = TARGET_MODES.REACHABLE;
            return true;
        }

        const lookVec = Player.asPlayerMP().getLookVector();
        const hit = this.findVisibleAimPoint(
            this.currentTarget.x,
            this.currentTarget.y,
            this.currentTarget.z,
            eyePos,
            lookVec,
            this.faceReach * this.faceReach,
            false,
            excludedAim
        );

        if (!hit || !this.hasMinimumVisibleRays(this.currentTarget, hit, eyePos)) return false;

        this.currentTarget.aimX = hit.x;
        this.currentTarget.aimY = hit.y;
        this.currentTarget.aimZ = hit.z;
        this.currentTarget.dist = hit.dist;
        this.currentTarget.targetMode = TARGET_MODES.REACHABLE;
        return true;
    }

    isCurrentAimPointVisible(eyePos) {
        const target = this.currentTarget;
        if (!target || !eyePos || ![target.aimX, target.aimY, target.aimZ].every(Number.isFinite)) return false;

        const dx = target.aimX - eyePos.x();
        const dy = target.aimY - eyePos.y();
        const dz = target.aimZ - eyePos.z();
        if (dx * dx + dy * dy + dz * dz > this.faceReach * this.faceReach) return false;

        return visibilityChecker.testPointNative(target.x, target.y, target.z, [target.aimX, target.aimY, target.aimZ], {
            x: eyePos.x(),
            y: eyePos.y(),
            z: eyePos.z(),
        });
    }

    getAimVectorForTarget(target) {
        if (!target) return null;
        const ax = target.aimX != null ? target.aimX : target.x + 0.5;
        const ay = target.aimY != null ? target.aimY : target.y + 0.5;
        const az = target.aimZ != null ? target.aimZ : target.z + 0.5;
        return [ax, ay, az];
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

        const eyePos = Player.getPlayer().getEyePosition();
        const lookVec = Player.asPlayerMP().getLookVector();
        const maxReachSq = this.mineReach * this.mineReach;

        this.foundLocations = locations
            .map((loc) => {
                const hit = this.findVisibleAimPoint(loc.x, loc.y, loc.z, eyePos, lookVec, maxReachSq, false);

                if (!hit || !this.hasMinimumVisibleRays(loc, hit, eyePos)) return null;

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

        this.refreshingMiningStats = true;
        const refreshToken = ++this.miningStatsRefreshToken;
        this.state = this.STATES.WAITING;
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
        MiningUtils.refreshMiningStatsIfNeeded(() => {
            if (!this.enabled || refreshToken !== this.miningStatsRefreshToken) return;
            this.loadAbilitySetting();
            this.refreshingMiningStats = false;
            this.state = this.STATES.ABILITY;
        });
        this.normalRender.register();
    }

    onDisable() {
        if (!this.isParentManaged) {
            this.message('&cDisabled');
            Mouse.regrab();
        }

        this.state = this.STATES.WAITING;
        this._pendingAbilityActivation = false;
        Client.stopMovement();
        Client.setKey('space', false);
        this.setSneak(false, true);
        Client.setKey('leftclick', false);
        this.foundLocations = [];
        this.lastBlockPos = null;
        this.lastBlockType = null;
        this.currentTarget = null;
        this.lowestCostBlockIndex = 0;
        this.manualScan = false;
        this.allowScan = false;
        this.scanning = false;
        this.refreshingMiningStats = false;
        this.miningStatsRefreshToken++;
        this.nukedBlock = false;
        this.mineTickCount = 0;
        this.tickCount = 0;
        this.movementReevalCooldownUntil = 0;
        this.lastRenderFrameTime = null;
        this.lastRenderPos = null;
        this.lastAimPos = null;
        this.lastNextPos = null;
        this.precisionMinerAim = null;
        OreRotations.stop();
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

        const isLiveTarget = (target) => {
            const blockName = World.getBlockAt(target.x, target.y, target.z)?.type?.getRegistryName() || '';
            return !this.isAirOrBedrock(blockName);
        };
        let nextTarget = null;
        if (this.foundLocations.length > 1 && current.aimX !== undefined) {
            const eyePos = Player.getPlayer().getEyePosition();
            const simLookX = current.aimX - eyePos.x();
            const simLookY = current.aimY - eyePos.y();
            const simLookZ = current.aimZ - eyePos.z();
            const simLookLen = Math.hypot(simLookX, simLookY, simLookZ);

            if (simLookLen > 0) {
                const normLookX = simLookX / simLookLen;
                const normLookY = simLookY / simLookLen;
                const normLookZ = simLookZ / simLookLen;

                let bestCost = Infinity;
                for (const loc of this.foundLocations) {
                    if (loc.x === current.x && loc.y === current.y && loc.z === current.z) continue;
                    if (loc.aimX === undefined) continue;
                    if (!isLiveTarget(loc)) continue;

                    const dx = loc.aimX - eyePos.x();
                    const dy = loc.aimY - eyePos.y();
                    const dz = loc.aimZ - eyePos.z();
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
            nextTarget =
                this.foundLocations.find((loc) => {
                    if (loc.x === current.x && loc.y === current.y && loc.z === current.z) return false;
                    return isLiveTarget(loc);
                }) || null;
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

        RenderUtils.drawStyledBox(
            new Vec3d(this.lastRenderPos.x, this.lastRenderPos.y, this.lastRenderPos.z),
            palette.currentFill,
            palette.currentWire,
            6,
            false
        );

        if (this.lastAimPos) {
            const d = 0.08;
            const { x, y, z } = this.lastAimPos;
            RenderUtils.drawLine(new Vec3d(x - d, y, z), new Vec3d(x + d, y, z), palette.aimColor, 2, false);
            RenderUtils.drawLine(new Vec3d(x, y - d, z), new Vec3d(x, y + d, z), palette.aimColor, 2, false);
            RenderUtils.drawLine(new Vec3d(x, y, z - d), new Vec3d(x, y, z + d), palette.aimColor, 2, false);
        }

        if (this.lastNextPos) {
            RenderUtils.drawStyledBox(new Vec3d(this.lastNextPos.x, this.lastNextPos.y, this.lastNextPos.z), palette.nextFill, palette.nextWire, 6, false);
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

                RenderUtils.drawWireFrameBox(new Vec3d(loc.x, loc.y, loc.z), new RenderColor(r * 255, g * 255, b * 255, 255));

                if (loc.aimX !== undefined) {
                    const d = 0.1;
                    const color = new RenderColor(r * 255, g * 255, b * 255, 230);
                    RenderUtils.drawLine(new Vec3d(loc.aimX - d, loc.aimY, loc.aimZ), new Vec3d(loc.aimX + d, loc.aimY, loc.aimZ), color, 3, false);
                    RenderUtils.drawLine(new Vec3d(loc.aimX, loc.aimY - d, loc.aimZ), new Vec3d(loc.aimX, loc.aimY + d, loc.aimZ), color, 3, false);
                    RenderUtils.drawLine(new Vec3d(loc.aimX, loc.aimY, loc.aimZ - d), new Vec3d(loc.aimX, loc.aimY, loc.aimZ + d), color, 3, false);
                }
            }
        }
    }
}

export const MiningBot = new Bot();
