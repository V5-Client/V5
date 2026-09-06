import { File, V5ConfigFile, Vec3d } from '../../utils/Constants';
import { getEtherwarpEyeCoords, isAtEtherwarpLanding } from '../../utils/Etherwarp';
import { MathUtils } from '../../utils/Math';
import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { Raytrace, visibilityChecker } from '../../utils/Raytrace';
import { Router } from '../../utils/Router';
import { manager } from '../../utils/SkyblockEvents';
import { TabListUtils } from '../../utils/TabListUtils';
import { Utils } from '../../utils/Utils';
import { v5Command } from '../../utils/V5Commands';
import { FastEtherwarp } from '../../utils/FastEtherwarp';
import { RoutePathWalker } from '../../utils/pathfinder/OreRoutePathWalker';
import { MiningBot } from './MiningBot';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { OreRotations } from '../../utils/player/OreRotations';
import { ServerInfo } from '../../utils/player/ServerInfo';
import { oreRouteEditor } from '../../gui/OreRouteEditor';

const MINE_REACH_SQ = 4.49 * 4.49;
const MINE_AIM_EDGE_INSET = 0.08;
const ETHERWARP_EDGE_INSET = 0.1;
const ETHERWARP_FACE_DEPTH = 0.01;
const ETHERWARP_RAY_CLEARANCE = 0.06;
const DEPLOYABLE_DETECTION_RADIUS = 4;
const DEPLOYABLE_DETECTION_RADIUS_SQ = DEPLOYABLE_DETECTION_RADIUS * DEPLOYABLE_DETECTION_RADIUS;
const WALK_PREAIM_WEIGHT = 0.65;
const DEPLOYABLE_ENTITY_NAMES = ['power orb', 'glacite lantern', "will-o'-wisp", 'mithril lantern', 'dwarven lantern', 'titanium lantern', "will o' wisp"];
const ROUTE_DIR_RELATIVE = 'OreRoutes';
const ORE_ROUTES_DIR = new File(V5ConfigFile.getParentFile(), ROUTE_DIR_RELATIVE);

function sanitizeRouteName(name) {
    return String(name || '')
        .trim()
        .replace(/\.json$/i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
}

const ETHERWARP_FACE_OFFSETS = (() => {
    const offsets = [];
    const samples = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, ETHERWARP_EDGE_INSET, 1 - ETHERWARP_EDGE_INSET];
    const faces = [
        { axis: 0, value: ETHERWARP_FACE_DEPTH, tangents: [1, 2] },
        { axis: 0, value: 1 - ETHERWARP_FACE_DEPTH, tangents: [1, 2] },
        { axis: 1, value: ETHERWARP_FACE_DEPTH, tangents: [0, 2] },
        { axis: 1, value: 1 - ETHERWARP_FACE_DEPTH, tangents: [0, 2] },
        { axis: 2, value: ETHERWARP_FACE_DEPTH, tangents: [0, 1] },
        { axis: 2, value: 1 - ETHERWARP_FACE_DEPTH, tangents: [0, 1] },
    ];

    for (const first of samples) {
        for (const second of samples) {
            for (const face of faces) {
                const point = [0.5, 0.5, 0.5];
                point[face.axis] = face.value;
                point[face.tangents[0]] = first;
                point[face.tangents[1]] = second;
                offsets.push(point);
            }
        }
    }
    return offsets;
})();

const COLORS = {
    currentFill: new RenderColor(0, 150, 199, 35),
    currentWire: new RenderColor(0, 150, 199, 255),
    nextFill: new RenderColor(72, 202, 228, 25),
    nextWire: new RenderColor(72, 202, 228, 255),
    teleportFill: new RenderColor(2, 62, 138, 15),
    teleportWire: new RenderColor(2, 62, 138, 190),
    walkFill: new RenderColor(0, 119, 182, 15),
    walkWire: new RenderColor(0, 119, 182, 220),
    warpFill: new RenderColor(144, 224, 239, 20),
    warpWire: new RenderColor(144, 224, 239, 230),
    deployableFill: new RenderColor(173, 232, 244, 20),
    deployableWire: new RenderColor(173, 232, 244, 230),
    selectedFill: new RenderColor(202, 240, 248, 35),
    selectedWire: new RenderColor(202, 240, 248, 255),
    mineFill: new RenderColor(0, 180, 216, 25),
    mineWire: new RenderColor(0, 180, 216, 220),
    oneTapFill: new RenderColor(72, 202, 228, 30),
    oneTapWire: new RenderColor(72, 202, 228, 240),
    rOneTapFill: new RenderColor(202, 240, 248, 35),
    rOneTapWire: new RenderColor(202, 240, 248, 255),
};

class OreMiner extends ModuleBase {
    constructor() {
        super({
            name: 'Ore Macro',
            subcategory: 'Mining',
            description: 'Builds and mines Tp/Walk ore routes.',
            tooltip: 'Build or load a route with /v5 mining ore, then toggle the macro.',
            theme: '#0096c7',
            isMacro: true,
        });

        this.loadedPath = '';
        this.loadedWaypoints = null;
        this.routeActive = false;
        this.state = 'IDLE';
        this.waypointIndex = 0;
        this.mineIndex = 0;
        this.waitTicks = 0;
        this.teleportRetries = 0;
        this.retryDelay = 0;
        this.teleportAimCandidates = [];
        this.teleportAimIndex = 0;
        this.etherwarpRayCursor = 0;
        this.mineRetries = 0;
        this.currentBlockName = '';
        this.currentMineAim = null;
        this.strafeKey = null;
        this.mineStrafeTarget = null;
        this.etherwarpStrafeAligned = false;
        this.lastEtherwarpStrafeKey = 'd';
        this.currentRenderTarget = null;
        this.nextRenderTarget = null;
        this.typeMineEnabled = false;
        this.typeMineName = 'Mithril';
        this.typeMineMinVisibleRays = 0;
        this.typeMineFov = 120;
        this.typeMinePriority = 'Nearest';
        this.typeMineBlock = null;
        this.typeMineNextBlock = null;
        this.typeMineIgnored = {};
        this.typeMineCosts = {
            Mithril: { ...MiningBot.mithrilCosts },
            Gemstone: { ...MiningBot.gemstoneCosts },
            Ore: { ...MiningBot.oreCosts },
            Tunnel: { ...MiningBot.tunnelCosts },
        };

        this.oreMineSpeed = 0.48;
        this.oreTeleportSpeed = 0.48;
        this.mineTimeoutTicks = 8;
        this.tickGliding = true;
        this.glideLagCompensation = 1;
        this.glideMineTicks = 0;
        this.glideTotalTicks = 0;
        this.teleportStrafing = false;
        this.miningStrafing = false;
        this.sneakWhileMining = true;
        this.showOverlay = true;
        this.drillSlot = 0;
        this.deployableSlot = 4;
        this.deployableWaypointsEnabled = true;
        this.miningAbilityEnabled = false;
        this.abilityDrillSwapEnabled = false;
        this.abilityDrillSlot = 1;
        this.abilityFromChat = false;
        this.abilityAvailabilityConsumed = false;
        this.abilityTabWasAvailable = false;
        this.abilityUseReadyAt = 0;
        this.abilitySteps = [];
        this.abilityTotalTicks = 0;
        this.undoStack = [];
        this.selectedWaypoint = -1;
        this.editing = false;

        this.addSlider('Drill Slot', 1, 8, 1, (value) => (this.drillSlot = Math.round(value) - 1), 'Mining tool hotbar slot.');
        this.addSlider(
            'Mining Deployable Slot',
            1,
            8,
            5,
            (value) => (this.deployableSlot = Math.round(value) - 1),
            'Mining Deployable hotbar slot for deployable waypoints.'
        );
        this.addToggle(
            'Use Mining Deployable Waypoints',
            (value) => (this.deployableWaypointsEnabled = value),
            'Place the configured Mining Deployable at route waypoints marked as deployable. Disable this to skip placement.',
            true
        );

        this.addSeparator('Type Mine');
        this.addToggle(
            'Type Mine',
            (value) => (this.typeMineEnabled = value),
            'Ignore route mining blocks and mine the selected Mining Bot block type at each Walk/Tp waypoint.'
        );
        this.addMultiToggle(
            'Type Mine Type',
            ['Mithril', 'Gemstone', 'Ore', 'Tunnel'],
            true,
            (value) => (this.typeMineName = MiningBot.getEnabledOptionName(value, this.typeMineName)),
            'Block type mined at each route waypoint while Type Mine is enabled.',
            'Mithril'
        );
        this.addSlider(
            'Minimum Visible Rays',
            0,
            9,
            0,
            (value) => (this.typeMineMinVisibleRays = Math.round(value)),
            'Minimum number of nine face samples that must raycast to the block. Zero accepts any visible amount.'
        );
        this.addSlider(
            'Type Mine FOV',
            30,
            360,
            120,
            (value) => (this.typeMineFov = value),
            'Horizontal field of view used to select Type Mine targets. 360 allows blocks behind you.'
        );
        this.addMultiToggle(
            'Type Mine Priority',
            ['Nearest', 'High', 'Low'],
            true,
            (value) => (this.typeMinePriority = MiningBot.getEnabledOptionName(value, this.typeMinePriority)),
            'Mine nearest targets normally, or prefer higher/lower targets first.',
            'Nearest'
        );
        this.addSeparator('Rotations');
        this.addSlider('Ore Mining Rotation Speed', 1, 100, 48, (value) => (this.oreMineSpeed = value / 100), 'Rotation speed for mining targets.');
        this.addSlider(
            'Ore Etherwarp Rotation Speed',
            1,
            100,
            48,
            (value) => (this.oreTeleportSpeed = value / 100),
            'Rotation speed for etherwarping targets.'
        );
        let glideLagCompensationSetting;
        this.addToggle(
            'Tick Gliding',
            (value) => {
                this.tickGliding = value;
                if (glideLagCompensationSetting) glideLagCompensationSetting.visible = value;
                if (!value) this.resetTickGlide();
            },
            'Predicts when blocks are broken to begin mining the next block early.',
            true
        );
        glideLagCompensationSetting = this.addSlider(
            'Tick Glide Lag Compensation',
            0,
            5,
            1,
            (value) => (this.glideLagCompensation = value),
            'Adds extra ticks to the predicted break time on top of TPS compensation.'
        );
        glideLagCompensationSetting.visible = this.tickGliding;
        this.addSeparator('Recovery');
        this.addSlider(
            'Mining Retry Delay',
            2,
            100,
            8,
            (value) => (this.mineTimeoutTicks = Math.round(value)),
            'Ticks before refreshing the aim point on an unbroken block.'
        );
        this.addToggle('Etherwarp Strafing', (value) => (this.teleportStrafing = value), 'Strafe when the Tp target has no visible face.');
        this.addToggle('Mining Strafing', (value) => (this.miningStrafing = value), 'Strafe when a route block is just out of sight.');
        this.addToggle(
            'Sneak While Mining',
            (value) => {
                this.sneakWhileMining = value;
                if (!value && this.state.startsWith('MINE') && this.state !== 'MINE_STRAFE') Client.setKey('shift', false);
            },
            'Sneak while mining.',
            true
        );
        this.addToggle('Route Overlay', (value) => (this.showOverlay = value), 'Draw waypoints and current/next mining targets.', true);

        this.addSeparator('Mining Ability');
        this.addToggle(
            'Mining Ability',
            (value) => (this.miningAbilityEnabled = value),
            'Activates the mining ability when it becomes available. (Automatically does rod swap for autopet rules.)'
        );
        this.addToggle(
            'Ability Drill Swap',
            (value) => (this.abilityDrillSwapEnabled = value),
            'Also swaps to the secondary drill, activates its ability, then returns to the main drill.'
        );
        this.addSlider('Ability Drill Slot', 1, 8, 2, (value) => (this.abilityDrillSlot = Math.round(value) - 1), 'Secondary drill hotbar slot.');

        this.bindToggleKey('Toggle Ore Miner');
        const editorKeyName = 'Open Ore Route Editor';
        const editorKeyCode = (Utils.getConfigFile('keybinds.json') || {})[editorKeyName] || Keyboard.KEY_NONE;
        this.editorKey = new KeyBind(editorKeyName, editorKeyCode, 'v5_mining');
        this.editorKey.registerKeyPress(() => oreRouteEditor.open(this));
        register('gameUnload', () => this._saveKey(editorKeyName, this.editorKey.getKeyCode()));
        this.on('tick', () => this.tick());
        register('postRenderWorld', () => this.render());

        manager.subscribe('abilityready', () => {
            if (!this.routeActive) return;
            this.abilityFromChat = true;
            this.abilityAvailabilityConsumed = false;
            this.scheduleAbilityUseDelay();
        });

        manager.subscribe('abilityused', () => {
            if (!this.routeActive) return;
            this.abilityFromChat = false;
            this.abilityAvailabilityConsumed = true;
            this.abilityUseReadyAt = 0;
        });

        manager.subscribe('abilitygone', () => {
            if (!this.routeActive) return;
            this.abilityFromChat = false;
            this.abilityAvailabilityConsumed = true;
            this.abilityUseReadyAt = 0;
        });

        v5Command('mining ore', () => this.printHelp());
        v5Command('mining ore list', () => this.listRoutes());
        v5Command('mining ore load', (...parts) => this.loadRoute(parts.join(' '), this.enabled), ['greedyString']);
        v5Command('mining ore save', (...parts) => this.saveRoute(parts.join(' ')), ['greedyString']);
        v5Command('mining ore start', () => (this.enabled ? this.startRoute() : this.toggle(true, false, 'user')));
        v5Command('mining ore stop', () => this.toggle(false));
        v5Command('mining ore status', () => this.printStatus());
        v5Command('mining ore editor', () => oreRouteEditor.open(this));
        v5Command('mining ore edit', (...parts) => this.editRoute(parts), ['greedyString']);
    }

    onEnable() {
        if (!this.startRoute()) this.toggle(false);
    }

    onDisable() {
        this.stopRoute();
    }

    printHelp() {
        this.message('&b/v5 mining ore &7- Ore Miner');
        this.message('  &fload <name> &7- load a route');
        this.message('  &fsave <name> &7- save the current route');
        this.message('  &flist | start | stop | status');
        this.message('  &feditor &7- open the visual route editor');
        this.message('  &fedit add <tp|walk> [index] &7- append, or insert and shift later waypoints');
        this.message('  &fedit add warp <destination> [index] &7- append, or insert and shift later waypoints');
        this.message('  &fedit add <mine|onetap|ronetap> [waypoint] &7- add the block under your crosshair');
        this.message('  &fedit deployable <waypoint> &7- toggle deployable placement');
        this.message('  &fedit remove <waypoint> &7- remove a waypoint');
        this.message('  &fedit removemine <waypoint> <mine> &7- remove a mining block');
        this.message('  &fedit undo | clear | list | done');
    }

    editRoute(parts) {
        if (this.routeActive) return this.message('&cStop Ore Miner before editing its route.');
        const args = parts.length === 1 && String(parts[0]).includes(' ') ? String(parts[0]).trim().split(/\s+/) : parts.map(String);
        const action = String(args.shift() || '').toLowerCase();
        this.editing = action !== 'done';

        if (action === 'add') {
            const type = String(args.shift() || '').toLowerCase();
            if (type === 'tp' || type === 'walk') return this.addWaypoint(type, args[0]);
            if (type === 'warp') return this.addWarpWaypoint(args);
            if (['mine', 'onetap', 'ronetap'].includes(type)) return this.addMineBlock(type, args[0]);
            return this.message('&cUsage: /v5 mining ore edit add <tp|walk|warp|mine|onetap|ronetap> [waypoint]');
        } else if (action === 'deployable') {
            return this.toggleDeployable(args[0]);
        } else if (action === 'removemine') {
            if (args[1] === undefined) return this.message('&cUsage: /v5 mining ore edit removemine <waypoint> <mine>');
            return this.removeRoutePoint(args[0], args[1]);
        } else if (action === 'remove') {
            return this.removeRoutePoint(args[0], args[1]);
        } else if (action === 'undo') {
            return this.undoRouteEdit();
        } else if (action === 'clear') {
            this.recordUndo();
            this.loadedWaypoints = [];
            this.selectedWaypoint = -1;
            return this.message('&eRoute cleared.');
        } else if (action === 'list') {
            return this.printRoute();
        } else if (action === 'done') {
            return this.message('&7Route editing finished.');
        }

        this.message('&cUsage: /v5 mining ore edit <add|deployable|remove|removemine|undo|clear|list|done>');
    }

    addWaypoint(type, indexArg) {
        const route = this.loadedWaypoints || (this.loadedWaypoints = []);
        const index = indexArg === undefined ? route.length : Number.parseInt(indexArg, 10);
        if (!Number.isInteger(index) || index < 0 || index > route.length) {
            return this.message(`&cInvalid waypoint index. Valid range: 0-${route.length}`);
        }

        this.recordUndo();
        route.splice(index, 0, {
            pos: { x: Math.floor(Player.getX()), y: Math.floor(Player.getY()) - 1, z: Math.floor(Player.getZ()) },
            type: type === 'tp' ? 'Tp' : 'Walk',
            minableBlocks: [],
            isDeployable: false,
        });
        this.selectedWaypoint = index;
        const inserted = index < route.length - 1;
        this.message(`&a${inserted ? 'Inserted' : 'Added'} ${route[index].type} waypoint [${index}].`);
        if (inserted) this.message(`&7Existing waypoint indexes ${index} and later were shifted forward.`);
    }

    addWarpWaypoint(args, requireDestination = true) {
        const route = this.loadedWaypoints || (this.loadedWaypoints = []);
        const warpCommand = String(args[0] || '').trim();
        const index = args[1] === undefined ? route.length : Number.parseInt(args[1], 10);
        if ((requireDestination && !warpCommand) || args.length > 2) return this.message('&cUsage: /v5 mining ore edit add warp <destination> [index]');
        if (!Number.isInteger(index) || index < 0 || index > route.length) {
            return this.message(`&cInvalid waypoint index. Valid range: 0-${route.length}`);
        }

        this.recordUndo();
        route.splice(index, 0, {
            pos: { x: Math.floor(Player.getX()), y: Math.floor(Player.getY()) - 1, z: Math.floor(Player.getZ()) },
            type: 'Warp',
            warpCommand,
            minableBlocks: [],
            isDeployable: false,
        });
        this.selectedWaypoint = index;
        const inserted = index < route.length - 1;
        this.message(`&a${inserted ? 'Inserted' : 'Added'} Warp waypoint [${index}] with command: &f/warp ${warpCommand}`);
        if (inserted) this.message(`&7Existing waypoint indexes ${index} and later were shifted forward.`);
    }

    addMineBlock(type, indexArg) {
        const route = this.loadedWaypoints;
        const defaultIndex = this.selectedWaypoint ?? (route?.length ? route.length - 1 : -1);
        const index = indexArg === undefined ? defaultIndex : Number.parseInt(indexArg, 10);

        if (!route?.length || !Number.isInteger(index) || index < 0 || index >= route.length) {
            return this.message('&cAdd a waypoint first, or provide a valid waypoint index.');
        }

        const hit = Raytrace.getLookingAt(10);
        const pos = hit?.getPos?.();
        if (!pos) return this.message('&cLook at a block within 10 blocks.');

        this.recordUndo();

        const blockData = {
            x: pos.getX(),
            y: pos.getY(),
            z: pos.getZ(),
        };

        if (type === 'onetap') blockData.oneTap = true;
        if (type === 'ronetap') blockData.rOneTap = true;

        route[index].minableBlocks.push(blockData);
        this.selectedWaypoint = index;
        this.message(`&aAdded ${type} block to waypoint [${index}].`);
    }

    toggleDeployable(indexArg) {
        const index = Number.parseInt(indexArg, 10);
        if (!this.loadedWaypoints?.[index]) return this.message('&cProvide a valid waypoint index.');

        this.recordUndo();
        this.loadedWaypoints[index].isDeployable = !this.loadedWaypoints[index].isDeployable;
        this.selectedWaypoint = index;
        this.message(`&aWaypoint [${index}] deployable: &f${this.loadedWaypoints[index].isDeployable}`);
    }

    removeRoutePoint(waypointArg, mineArg) {
        const waypoint = Number.parseInt(waypointArg, 10);
        if (!this.loadedWaypoints?.[waypoint]) return this.message('&cProvide a valid waypoint index.');

        this.recordUndo();
        if (mineArg === undefined) {
            this.loadedWaypoints.splice(waypoint, 1);
            this.selectedWaypoint = Math.min(waypoint, this.loadedWaypoints.length - 1);
            return this.message(`&eRemoved waypoint [${waypoint}].`);
        }

        const mine = Number.parseInt(mineArg, 10);
        if (!Number.isInteger(mine) || !this.loadedWaypoints[waypoint].minableBlocks[mine]) {
            this.undoStack.pop();
            return this.message('&cProvide a valid mine block index.');
        }
        this.loadedWaypoints[waypoint].minableBlocks.splice(mine, 1);
        this.selectedWaypoint = waypoint;
        this.message(`&eRemoved mine block [${waypoint}][${mine}].`);
    }

    recordUndo() {
        this.undoStack.push(JSON.stringify(this.loadedWaypoints || []));
    }

    undoRouteEdit() {
        if (!this.undoStack.length) return this.message('&cNothing to undo.');
        this.loadedWaypoints = JSON.parse(this.undoStack.pop());
        this.selectedWaypoint = Math.min(Math.max(0, this.selectedWaypoint), this.loadedWaypoints.length - 1);
        this.message('&eUndid the last route edit.');
    }

    saveRoute(name) {
        const cleanName = sanitizeRouteName(name);
        if (!cleanName || !this.loadedWaypoints || !this.loadedWaypoints.length) {
            this.message('&cUsage: /v5 mining ore save <name>');
            return false;
        }
        const invalidWarp = this.loadedWaypoints.findIndex((waypoint) => waypoint.type === 'Warp' && !String(waypoint.warpCommand || '').trim());
        if (invalidWarp !== -1) {
            this.message(`&cWarp waypoint [${invalidWarp}] needs a destination before saving.`);
            return false;
        }
        if (!Utils.writeConfigFile(`${ROUTE_DIR_RELATIVE}/${cleanName}.json`, this.loadedWaypoints)) return false;
        const selectedWaypoint = this.selectedWaypoint;
        this.loadedPath = String(new File(ORE_ROUTES_DIR, `${cleanName}.json`).getAbsolutePath());
        this.undoStack = [];
        if (!this.routeActive && !this.loadRoute(cleanName)) {
            this.message(`&cSaved ${cleanName}, but failed to reload it.`);
            return false;
        }
        this.selectedWaypoint = Math.min(Math.max(0, selectedWaypoint), this.loadedWaypoints.length - 1);
        this.message(`&aSaved ${this.loadedWaypoints.length} waypoints as &f${cleanName}&a.`);
        return true;
    }

    printRoute() {
        if (!this.loadedWaypoints || !this.loadedWaypoints.length) return this.message('&7No route loaded.');
        this.message(`&bOre route &7(${this.loadedWaypoints.length} waypoints):`);
        this.loadedWaypoints.forEach((waypoint, index) => {
            const deployable = waypoint.isDeployable ? ' &d[DEPLOYABLE]' : '';
            const warpInfo = waypoint.type === 'Warp' ? ` &e/warp ${waypoint.warpCommand}` : '';
            this.message(
                `  &8[${index}] &f${waypoint.type}${deployable}${warpInfo} &7@ &e${waypoint.pos.x}, ${waypoint.pos.y}, ${waypoint.pos.z} &7- &f${waypoint.minableBlocks.length} blocks`
            );
            waypoint.minableBlocks.forEach((block, mineIndex) => {
                const oneTap = block.oneTap ? ' &6[ONE-TAP]' : block.rOneTap ? ' &b[R-ONE-TAP]' : '';
                this.message(`      &8[mine ${mineIndex}]${oneTap} &c${block.x}, ${block.y}, ${block.z}`);
            });
        });
    }

    resolveRoutePath(routeRef) {
        const name = sanitizeRouteName(routeRef);
        if (!name) return null;
        const file = new File(ORE_ROUTES_DIR, `${name}.json`);
        return file.exists() && file.isFile() ? { path: String(file.getAbsolutePath()), name } : null;
    }

    listRoutes() {
        const files = this.getRouteNames();
        this.message(`&bOre Miner Routes &7(${files.length})`);
        files.forEach((name) => this.message(`  &f${name} &7- /v5 mining ore load ${name}`));
    }

    getRouteNames() {
        return Router.getFilesInDir(ROUTE_DIR_RELATIVE);
    }

    loadRoute(path, startAfterLoad = false) {
        const routeRef = String(path || '').trim();
        const resolved = this.resolveRoutePath(routeRef);
        if (!resolved) {
            this.message(`&cCould not find route: &f${routeRef}`);
            this.listRoutes();
            return false;
        }

        const data = Utils.getConfigFile(`${ROUTE_DIR_RELATIVE}/${resolved.name}.json`);
        if (!data) {
            this.message(`&cCould not read route: &f${resolved.path}`);
            return false;
        }

        const rawWaypoints = Array.isArray(data) ? data : data.waypoints;
        if (!Array.isArray(rawWaypoints)) {
            this.message('&cRoute JSON must be an array or contain a waypoints array.');
            return false;
        }

        const waypoints = rawWaypoints.map((waypoint) => this.normalizeWaypoint(waypoint)).filter(Boolean);
        if (!waypoints.length) {
            this.message('&cThe route has no valid Tp or Walk waypoints.');
            return false;
        }

        if (this.routeActive) this.stopRoute();
        this.loadedWaypoints = waypoints;
        this.loadedPath = resolved.path;
        this.editing = true;
        this.selectedWaypoint = waypoints.length - 1;
        this.undoStack = [];
        this.message(`&aLoaded &f${waypoints.length} &awaypoints from &f${resolved.name}&a.`);
        if (startAfterLoad) this.startRoute();
        return true;
    }

    normalizeWaypoint(waypoint) {
        if (!waypoint || !waypoint.pos) return null;
        const type = String(waypoint.type || '').toLowerCase();
        if (type !== 'tp' && type !== 'walk' && type !== 'warp') return null;
        const pos = this.normalizePosition(waypoint.pos);
        if (!pos) return null;

        const minableBlocks = Array.isArray(waypoint.minableBlocks)
            ? waypoint.minableBlocks
                  .map((block) => {
                      const normalized = this.normalizePosition(block);
                      if (!normalized) return null;
                      return {
                          ...normalized,
                          oneTap: !!block.oneTap,
                          rOneTap: !!block.rOneTap,
                      };
                  })
                  .filter(Boolean)
            : [];

        return {
            pos,
            type: type === 'tp' ? 'Tp' : type === 'walk' ? 'Walk' : 'Warp',
            warpCommand: type === 'warp' ? String(waypoint.warpCommand || '') : undefined,
            minableBlocks,
            isDeployable: !!waypoint.isDeployable,
        };
    }

    normalizePosition(position) {
        if (!position) return null;
        const x = Number(position.x);
        const y = Number(position.y);
        const z = Number(position.z);
        return [x, y, z].every(Number.isFinite) ? { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) } : null;
    }

    startRoute() {
        if (!this.enabled) {
            this.toggle(true, false, 'user');
            return this.enabled;
        }
        if (!this.loadedWaypoints || !this.loadedWaypoints.length) {
            this.message('&cNo route loaded. Use &f/v5 mining ore load <name>&c first.');
            this.toggle(false);
            return false;
        }

        this.stopRoute();
        this.routeActive = true;
        this.editing = false;
        this.mineIndex = 0;
        this.teleportRetries = 0;
        this.retryDelay = 0;
        this.teleportAimCandidates = [];
        this.teleportAimIndex = 0;
        this.etherwarpRayCursor = 0;
        this.mineRetries = 0;
        this.abilityFromChat = false;
        this.abilityAvailabilityConsumed = false;
        this.abilityTabWasAvailable = false;
        this.abilityUseReadyAt = 0;
        this.currentRenderTarget = null;
        this.nextRenderTarget = null;
        this.currentMineAim = null;
        this.typeMineBlock = null;
        this.typeMineNextBlock = null;
        this.typeMineIgnored = {};
        this.waypointIndex = this.findNearestWaypoint();
        this.enterState('WAYPOINT');
        this.message(`&aRoute started at waypoint &f${this.waypointIndex + 1}/${this.loadedWaypoints.length}&a.`);
        return true;
    }

    stopRoute() {
        this.routeActive = false;
        this.state = 'IDLE';
        this.releaseControls();
        OreRotations.stop();
        this.currentRenderTarget = null;
        this.nextRenderTarget = null;
        this.currentMineAim = null;
        this.typeMineBlock = null;
        this.typeMineNextBlock = null;
        this.typeMineIgnored = {};
        this.abilityUseReadyAt = 0;
    }

    printStatus() {
        if (!this.loadedWaypoints) return this.message('&7Ore Miner: no route loaded.');
        this.message(`&7Ore Miner: ${this.routeActive ? '&aRUNNING' : '&eREADY'} &7| ` + `&f${this.loadedWaypoints.length} &7waypoints | &f${this.loadedPath}`);
    }

    tick() {
        if (!this.routeActive || !this.loadedWaypoints || !this.loadedWaypoints.length) return;
        try {
            this.tickState();
        } catch (error) {
            console.error('[OreMiner] State error:', this.state, error);
            this.message(`&cOre Miner stopped after an error in state &f${this.state}&c. Check the CT console.`);
            this.toggle(false);
        }
    }

    tickState() {
        const waypoint = this.loadedWaypoints[this.waypointIndex];

        switch (this.state) {
            case 'WAYPOINT':
                if (waypoint.type === 'Warp') {
                    this.enterState('WARP');
                } else if (waypoint.type === 'Walk') {
                    Client.setKey('shift', false);
                    this.updateWalkWaypointLookAhead();
                    this.enterState('WALK');
                } else if (this.isAtWaypoint(waypoint)) {
                    this.enterState('MINE_INIT');
                } else {
                    this.aotvSlot = FastEtherwarp.getEtherwarpSlot();
                    if (this.aotvSlot < 0) {
                        this.message('&cNo Aspect of the Void/End found in your hotbar.');
                        return this.toggle(false);
                    }
                    Guis.setItemSlot(this.aotvSlot);
                    this.ensureShiftHeld();
                    this.teleportRetries = 0;
                    this.teleportAimCandidates = [];
                    this.teleportAimIndex = 0;
                    this.enterState('TP_ROTATE');
                }
                return;

            case 'WARP':
                if (this.waitTicks === 0) {
                    this.warpStartPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
                    ChatLib.command(`warp ${waypoint.warpCommand}`);
                }
                if (++this.waitTicks >= 40) {
                    const movedDistance = Math.hypot(
                        Player.getX() - this.warpStartPos.x,
                        Player.getY() - this.warpStartPos.y,
                        Player.getZ() - this.warpStartPos.z
                    );
                    if (movedDistance < 5) {
                        this.message(`&cWarp failed: ${waypoint.warpCommand}`);
                        this.toggle(false);
                        return;
                    }
                    this.enterState('ADVANCE');
                }
                return;

            case 'TP_ROTATE':
                return this.beginTeleportRotation(waypoint);

            case 'TP_STRAFE':
                return this.tickTeleportStrafe(waypoint);

            case 'TP_WAIT_ROTATION':
                if (OreRotations.isRotating && ++this.waitTicks < 60) return;
                OreRotations.stop();
                if (this.isLookingAtWaypoint(waypoint)) this.enterState('TP_CLICK');
                else this.retryTeleportAim(waypoint);
                return;

            case 'TP_CLICK':
                if (Player.getHeldItemIndex() !== this.aotvSlot) {
                    Guis.setItemSlot(this.aotvSlot);
                    this.waitTicks = 0;
                    return;
                }
                if (!this.isLookingAtWaypoint(waypoint)) {
                    this.retryTeleportAim(waypoint);
                    return;
                }
                Client.rightClick();
                this.enterState('TP_LAND');
                return;

            case 'TP_LAND':
                if (this.isAtWaypoint(waypoint)) {
                    Client.setKey('shift', false);
                    this.enterState('MINE_INIT');
                } else if (++this.waitTicks >= 30) {
                    if (++this.teleportRetries >= 5) {
                        this.message('&cEtherwarp failed five times.');
                        this.toggle(false);
                    } else {
                        this.retryDelay = 20 + Math.floor(Math.random() * 21);
                        this.enterState('TP_RETRY_DELAY');
                    }
                }
                return;

            case 'TP_RETRY_DELAY':
                if (++this.waitTicks >= this.retryDelay) {
                    Guis.setItemSlot(this.aotvSlot);
                    this.teleportAimCandidates = [];
                    this.teleportAimIndex = 0;
                    this.enterState('TP_ROTATE');
                }
                return;

            case 'WALK':
                return this.tickWalk(waypoint);

            case 'DEPLOYABLE':
                return this.tickDeployable();

            case 'ABILITY':
                return this.tickAbilitySequence();

            case 'MINE_INIT':
                this.mineIndex = 0;
                this.mineRetries = 0;
                this.resetTickGlide();
                this.currentRenderTarget = null;
                this.nextRenderTarget = null;
                this.typeMineBlock = null;
                this.typeMineNextBlock = null;
                this.typeMineIgnored = {};
                Client.setKey('leftclick', false);
                if (waypoint.isDeployable && this.deployableWaypointsEnabled && !this.hasNearbyDeployable(waypoint.pos)) {
                    this.enterState('DEPLOYABLE');
                } else {
                    Guis.setItemSlot(this.drillSlot);
                    this.enterState('MINE_NEXT');
                }
                return;

            case 'MINE_NEXT':
                return this.beginNextBlock(waypoint);

            case 'MINE_STRAFE':
                return this.tickMineStrafe(waypoint);

            case 'MINE_WAIT_ROTATION': {
                const block = this.getCurrentMineBlock(waypoint);
                if (!block || this.shouldSkipBlock(block)) {
                    this.enterState('MINE_NEXT');
                    return;
                }
                if (this.trackCurrentMineBlock(waypoint, this.waitTicks % 3 === 0)) {
                    this.beginMiningAction(waypoint);
                } else if (++this.waitTicks >= 60) {
                    if (++this.mineRetries > 8) {
                        this.message(`&eSkipping stubborn block at ${block.x}, ${block.y}, ${block.z}.`);
                        this.finishMineBlock(true);
                        this.enterState('MINE_NEXT');
                        return;
                    }
                    this.currentMineAim = null;
                    const aim = this.getMineAim(block, true);
                    if (aim) {
                        this.currentMineAim = aim;
                        OreRotations.trackVector(aim, this.oreMineSpeed);
                        this.waitTicks = 0;
                    } else if (!this.handleUnreachableBlock(block)) {
                        this.finishMineBlock(true);
                        this.enterState('MINE_NEXT');
                    }
                }
                return;
            }

            case 'MINE_ONETAP':
                if (++this.waitTicks >= 2) {
                    this.finishMineBlock();
                    this.enterState('MINE_NEXT');
                }
                return;

            case 'MINE_HOLD':
                return this.tickMineHold(waypoint);

            case 'MINE_RELEASE':
                Client.setKey('leftclick', false);
                if (++this.waitTicks >= 1) this.enterState('ADVANCE');
                return;

            case 'ADVANCE':
                this.waypointIndex = (this.waypointIndex + 1) % this.loadedWaypoints.length;
                this.mineIndex = 0;
                this.typeMineBlock = null;
                this.typeMineNextBlock = null;
                this.typeMineIgnored = {};
                this.currentMineAim = null;
                Client.setKey('leftclick', false);
                Client.stopMovement();
                this.enterState('WAYPOINT');
                return;
        }
    }

    beginTeleportRotation(waypoint) {
        const { x, y, z } = waypoint.pos;
        const visible = this.getEtherwarpVisiblePoints(x, y, z);
        if (!visible.length && ++this.waitTicks < Math.ceil(ETHERWARP_FACE_OFFSETS.length / 96)) return;

        if (!visible.length && this.teleportStrafing) {
            if (this.startEtherwarpStrafe(waypoint)) return;
        }

        if (!visible.length) {
            this.failTeleportAim();
            return;
        }

        this.teleportAimCandidates = this.orderTeleportAimPoints(visible);
        this.teleportAimIndex = 0;
        OreRotations.lookAtVector(this.teleportAimCandidates[0], this.oreTeleportSpeed);
        this.enterState('TP_WAIT_ROTATION');
    }

    tickTeleportStrafe(waypoint) {
        this.ensureShiftHeld();
        if (!this.etherwarpStrafeAligned) {
            Client.setKey('a', false);
            Client.setKey('d', false);
            if (OreRotations.isRotating && ++this.waitTicks < 60) return;
            OreRotations.stop();
            this.etherwarpStrafeAligned = true;
            this.waitTicks = 0;
        }

        Client.setKey(this.strafeKey, true);
        this.waitTicks++;
        if (this.waitTicks >= 40) {
            this.stopStrafing(false);
            this.failTeleportAim();
            return;
        }
        if (this.waitTicks % 2 !== 0) return;

        const { x, y, z } = waypoint.pos;
        const visible = this.getEtherwarpVisiblePoints(x, y, z);
        if (visible.length) {
            this.stopStrafing(false);
            this.teleportAimCandidates = this.orderTeleportAimPoints(visible);
            this.teleportAimIndex = 0;
            OreRotations.lookAtVector(this.teleportAimCandidates[0], this.oreTeleportSpeed);
            this.enterState('TP_WAIT_ROTATION');
        }
    }

    orderTeleportAimPoints(visible) {
        const points = visible.map((entry) => entry.point);
        for (let index = points.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [points[index], points[swapIndex]] = [points[swapIndex], points[index]];
        }
        return points;
    }

    retryTeleportAim(waypoint) {
        const nextIndex = this.teleportAimIndex + 1;
        if (nextIndex < Math.min(this.teleportAimCandidates.length, 12)) {
            this.teleportAimIndex = nextIndex;
            OreRotations.lookAtVector(this.teleportAimCandidates[nextIndex], this.oreTeleportSpeed);
            this.enterState('TP_WAIT_ROTATION');
            return;
        }

        if (this.teleportStrafing) {
            if (this.startEtherwarpStrafe(waypoint)) return;
        }

        this.failTeleportAim();
    }

    failTeleportAim() {
        if (++this.teleportRetries >= 5) {
            this.message('&cCould not place the crosshair on the etherwarp waypoint after five attempts.');
            this.toggle(false);
            return;
        }
        this.retryDelay = 10 + Math.floor(Math.random() * 11);
        this.enterState('TP_RETRY_DELAY');
    }

    isLookingAtWaypoint(waypoint) {
        try {
            const player = Player.getPlayer();
            if (!player) return false;
            const eyes = player.getEyePosition();
            const { x, y, z } = waypoint.pos;
            const eye = { x: eyes.x(), y: eyes.y(), z: eyes.z() };
            const aimPoint = this.teleportAimCandidates[this.teleportAimIndex];
            if (aimPoint && !this.hasEtherwarpRayClearance(x, y, z, [aimPoint.x, aimPoint.y, aimPoint.z], eye)) return false;
            const center = MathUtils.blockCenter(x, y, z);
            const distance = Math.min(61, Math.hypot(center.x - eyes.x(), center.y - eyes.y(), center.z - eyes.z()) + 0.25);
            const pos = Raytrace.getLookingAt(distance)?.getPos?.();
            return !!pos && pos.getX() === x && pos.getY() === y && pos.getZ() === z;
        } catch (error) {
            return false;
        }
    }

    getStrafeAimPoint(waypoint) {
        const { x, y, z } = waypoint.pos;
        const eye = visibilityChecker.getPlayerEyePosition();
        if (!eye) return { x: x + 0.5, y: y + 0.5, z: z + ETHERWARP_FACE_DEPTH };

        const dx = eye.x - (x + 0.5);
        const dz = eye.z - (z + 0.5);
        if (Math.abs(dx) > Math.abs(dz)) {
            return {
                x: x + (dx > 0 ? 1 - ETHERWARP_FACE_DEPTH : ETHERWARP_FACE_DEPTH),
                y: y + 0.5,
                z: z + 0.5,
            };
        }
        return {
            x: x + 0.5,
            y: y + 0.5,
            z: z + (dz > 0 ? 1 - ETHERWARP_FACE_DEPTH : ETHERWARP_FACE_DEPTH),
        };
    }

    tickWalk(waypoint) {
        const { x, y, z } = waypoint.pos;
        const walkState = RoutePathWalker.tick({ x, y, z }, this.sneakWhileMining);

        if (walkState === 'COMPLETE') {
            const hasAction = this.typeMineEnabled || waypoint.minableBlocks.length > 0 || (waypoint.isDeployable && this.deployableWaypointsEnabled);
            if (!hasAction) {
                const nextIndex = (this.waypointIndex + 1) % this.loadedWaypoints.length;
                const nextWaypoint = this.loadedWaypoints[nextIndex];
                this.waypointIndex = nextIndex;
                this.mineIndex = 0;
                this.waitTicks = 0;

                if (nextWaypoint?.type === 'Walk') {
                    this.updateWalkWaypointLookAhead();
                    return;
                }

                Keybind.stopMovement();
                Keybind.setKey('shift', false);
                OreRotations.stop();
                this.enterState('WAYPOINT');
                return;
            }

            Keybind.stopMovement();
            Keybind.setKey('shift', this.sneakWhileMining);
            this.enterState('MINE_INIT');
            return;
        }

        if (walkState === 'FAILED') {
            this.message(`&cCould not find a walking path to ${x}, ${y}, ${z}.`);
            this.toggle(false);
            return;
        }

        this.waitTicks++;
        this.updateWalkWaypointLookAhead();
        if (this.waitTicks >= 300) {
            this.message('&cWalk waypoint timed out.');
            this.toggle(false);
        }
    }

    updateWalkWaypointLookAhead(target = this.findWalkPreAimTarget()) {
        if (!target) {
            Client.setKey('leftclick', false);
            OreRotations.stop();
            return false;
        }

        if (target.walkGuide) {
            Client.setKey('leftclick', false);
            const distance = MathUtils.distanceToPlayerPoint(target.vector);
            const looseTolerance = Math.min(10, (Math.atan2(0.5, Math.max(1, distance)) * 180) / Math.PI);
            if (MathUtils.angleToPlayer(target.vector).distance <= looseTolerance) {
                OreRotations.stop();
                return true;
            }
            return OreRotations.trackVector(target.vector, this.oreMineSpeed);
        }

        const distance = MathUtils.distanceToPlayerPoint(target.vector);
        if (target.block) {
            const aim = this.getWalkPreAim(target.block, target.vector);
            this.currentMineAim = aim;
            const canHoldMine = distance <= 5 && !target.block.oneTap && !target.block.rOneTap;
            if (canHoldMine && Player.getHeldItemIndex() !== this.drillSlot) Guis.setItemSlot(this.drillSlot);
            Client.setKey('leftclick', canHoldMine && this.isCrosshairOnBlock(target.block));
            return OreRotations.trackVector(aim, this.oreMineSpeed);
        }

        Client.setKey('leftclick', false);
        const looseTolerance = Math.min(10, (Math.atan2(0.5, Math.max(1, distance)) * 180) / Math.PI);
        if (MathUtils.angleToPlayer(target.vector).distance <= looseTolerance) {
            OreRotations.stop();
            return true;
        }
        return OreRotations.trackVector(target.vector, target.teleport ? this.oreTeleportSpeed : this.oreMineSpeed);
    }

    getWalkPreAim(block, fallback) {
        const eye = Player.getPlayer()?.getEyePosition?.();
        if (!eye) return fallback;

        const center = MathUtils.blockCenter(block.x, block.y, block.z);
        const dx = center.x - eye.x();
        const dy = center.y - eye.y();
        const dz = center.z - eye.z();
        const distanceSq = dx * dx + dy * dy + dz * dz;
        const visibleAim =
            distanceSq <= 144 ? MiningBot.findVisibleAimPoint(block.x, block.y, block.z, eye, null, Math.max(MINE_REACH_SQ, distanceSq + 3), false) : null;
        let aim = visibleAim || fallback;
        const horizontalDistance = Math.hypot(aim.x - Player.getX(), aim.z - Player.getZ());
        if (horizontalDistance < 0.2) {
            const yaw = (Player.getYaw() * Math.PI) / 180;
            aim = {
                x: Player.getX() - Math.sin(yaw) * 0.2,
                y: aim.y,
                z: Player.getZ() + Math.cos(yaw) * 0.2,
            };
        }

        const walkAim = RoutePathWalker.getLookTarget();
        if (!walkAim) return aim;
        const mineDirection = { x: aim.x - eye.x(), y: aim.y - eye.y(), z: aim.z - eye.z() };
        const walkDirection = { x: walkAim.x - eye.x(), y: walkAim.y - eye.y(), z: walkAim.z - eye.z() };
        const mineLength = Math.hypot(mineDirection.x, mineDirection.y, mineDirection.z);
        const walkLength = Math.hypot(walkDirection.x, walkDirection.y, walkDirection.z);
        if (mineLength < 0.001 || walkLength < 0.001) return aim;
        const goalDistance = RoutePathWalker.getGoalDistance();
        const preAimWeight = WALK_PREAIM_WEIGHT + (1 - WALK_PREAIM_WEIGHT) * (1 - Math.min(1, goalDistance / 2));

        return {
            x: eye.x() + (mineDirection.x / mineLength) * preAimWeight + (walkDirection.x / walkLength) * (1 - preAimWeight),
            y: eye.y() + (mineDirection.y / mineLength) * preAimWeight + (walkDirection.y / walkLength) * (1 - preAimWeight),
            z: eye.z() + (mineDirection.z / mineLength) * preAimWeight + (walkDirection.z / walkLength) * (1 - preAimWeight),
        };
    }

    findWalkPreAimTarget() {
        const count = this.loadedWaypoints ? this.loadedWaypoints.length : 0;
        if (!count) return null;

        for (let offset = 0; offset < count; offset++) {
            const waypoint = this.loadedWaypoints[(this.waypointIndex + offset) % count];
            if (!waypoint) continue;

            if (waypoint.type === 'Tp') {
                return {
                    vector: MathUtils.blockCenter(waypoint.pos.x, waypoint.pos.y, waypoint.pos.z),
                    teleport: true,
                };
            }

            if (this.typeMineEnabled) {
                return {
                    vector: MathUtils.blockCenter(waypoint.pos.x, waypoint.pos.y, waypoint.pos.z),
                    walkGuide: true,
                };
            }

            const block = (waypoint.minableBlocks || []).find((candidate) => !this.shouldSkipBlock(candidate));
            const deepDrop = Player.getY() - waypoint.pos.y >= 5;
            if (offset === 0 && deepDrop && block?.y < waypoint.pos.y) {
                return {
                    vector: MathUtils.blockCenter(waypoint.pos.x, waypoint.pos.y, waypoint.pos.z),
                    walkGuide: true,
                };
            }
            if (block) {
                return {
                    block,
                    vector: MathUtils.blockCenter(block.x, block.y, block.z),
                };
            }
        }

        return null;
    }

    tickDeployable() {
        if (this.waitTicks === 0) Guis.setItemSlot(this.deployableSlot);
        if (this.waitTicks === 2) Client.rightClick();
        if (++this.waitTicks >= 4) {
            Guis.setItemSlot(this.drillSlot);
            Client.setKey('leftclick', false);
            this.enterState('MINE_NEXT');
        }
    }

    hasNearbyDeployable(origin) {
        if (!origin) return false;
        return World.getAllEntities().some((entity) => {
            if (!entity || entity.isDead?.()) return false;
            const name = ChatLib.removeFormatting(String(entity.getName?.() || ''))
                .trim()
                .toLowerCase();
            if (!DEPLOYABLE_ENTITY_NAMES.some((target) => name.includes(target))) return false;

            const dx = entity.getX() - origin.x;
            const dy = entity.getY() - origin.y;
            const dz = entity.getZ() - origin.z;
            return dx * dx + dy * dy + dz * dz <= DEPLOYABLE_DETECTION_RADIUS_SQ;
        });
    }

    beginNextBlock(waypoint) {
        if ((this.miningAbilityEnabled || this.abilityDrillSwapEnabled) && this.isMiningAbilityReady()) {
            this.startAbilitySequence();
            return;
        }

        const blocks = this.typeMineEnabled ? this.findTypeMineBlocks() : waypoint.minableBlocks;
        if (this.typeMineEnabled) {
            this.typeMineBlock = blocks[0] || null;
            this.typeMineNextBlock = blocks[1] || null;
        } else {
            while (this.mineIndex < blocks.length && this.shouldSkipBlock(blocks[this.mineIndex])) this.mineIndex++;
        }
        if ((this.typeMineEnabled && !this.typeMineBlock) || (!this.typeMineEnabled && this.mineIndex >= blocks.length)) {
            Client.setKey('leftclick', false);
            this.enterState('MINE_RELEASE');
            return;
        }

        const block = this.typeMineEnabled ? this.typeMineBlock : blocks[this.mineIndex];
        if (this.shouldSneakForMineBlock(block)) {
            this.ensureShiftHeld();
            if (!Player.isSneaking()) return;
        }
        const aim = this.getMineAim(block, true);
        if (!aim) {
            if (this.handleUnreachableBlock(block)) return;
            this.finishMineBlock(true);
            return;
        }

        this.prepareBlock(block, aim);
    }

    tickMineStrafe(waypoint) {
        const block = this.getCurrentMineBlock(waypoint);
        if (!block || this.shouldSkipBlock(block)) {
            this.stopMiningStrafe();
            this.finishMineBlock();
            this.enterState('MINE_NEXT');
            return;
        }

        this.ensureShiftHeld();
        if (!Player.isSneaking()) return;
        const aim = this.getMineAim(block, this.waitTicks % 3 === 0);
        if (aim) {
            this.stopMiningStrafe(false, false);
            this.prepareBlock(block, aim);
            return;
        }
        if (!this.mineStrafeTarget) {
            OreRotations.stop();
            this.mineStrafeTarget = this.findMiningStrafeTarget(block.x, block.y, block.z);
            if (!this.mineStrafeTarget) {
                this.message(`&eCould not find a reachable strafe position for block at ${block.x}, ${block.y}, ${block.z}; skipping it.`);
                this.stopMiningStrafe();
                this.finishMineBlock(true);
                this.enterState('MINE_NEXT');
                return;
            }
        }
        OreRotations.trackVector(this.mineStrafeTarget.aim, this.oreMineSpeed);

        if (++this.waitTicks >= 80) {
            this.stopMiningStrafe();
            if (++this.mineRetries > 3) {
                this.message(`&cCould not strafe into reach of block at ${block.x}, ${block.y}, ${block.z}.`);
                this.toggle(false);
                return;
            }
            this.enterState('MINE_NEXT');
            return;
        }

        Keybind.setKeysForStraightLineCoords(this.mineStrafeTarget.x, Player.getY(), this.mineStrafeTarget.z, false);
        this.ensureShiftHeld();
    }

    handleUnreachableBlock(block) {
        if (!this.miningStrafing) return false;
        Client.setKey('leftclick', !block.oneTap && !block.rOneTap);
        this.mineStrafeTarget = null;
        this.ensureShiftHeld();
        this.enterState('MINE_STRAFE');
        return true;
    }

    prepareBlock(block, aim) {
        this.resetTickGlide();
        this.currentBlockName = this.getBlockName(block);
        this.currentRenderTarget = { x: block.x, y: block.y, z: block.z };
        this.nextRenderTarget = this.findNextMineTarget(this.mineIndex + 1);
        this.mineRetries = 0;
        this.currentMineAim = aim;
        Client.setKey('leftclick', !block.oneTap && !block.rOneTap);
        OreRotations.trackVector(aim, this.oreMineSpeed);
        this.enterState('MINE_WAIT_ROTATION');
    }

    beginMiningAction(waypoint) {
        const block = this.getCurrentMineBlock(waypoint);
        if (!block) return this.enterState('MINE_NEXT');
        if (this.shouldSneakForMineBlock(block) && !Player.isSneaking()) {
            this.ensureShiftHeld();
            this.enterState('MINE_WAIT_ROTATION');
            return;
        }
        if (block.oneTap) {
            Client.setKey('leftclick', false);
            Client.leftClick();
        } else if (block.rOneTap) {
            Client.setKey('leftclick', false);
            Client.rightClick();
        } else {
            Client.setKey('leftclick', true);
            this.enterState('MINE_HOLD');
            return;
        }
        this.enterState('MINE_ONETAP');
    }

    tickMineHold(waypoint) {
        const block = this.getCurrentMineBlock(waypoint);
        if (!block) return this.enterState('MINE_NEXT');
        if (this.shouldSneakForMineBlock(block) && !Player.isSneaking()) {
            this.ensureShiftHeld();
            Client.setKey('leftclick', false);
            return;
        }
        const blockName = this.getBlockName(block);
        if (blockName !== this.currentBlockName || MiningBot.isAirOrBedrock(blockName)) {
            this.finishMineBlock();
            this.enterState('MINE_NEXT');
            return;
        }

        const miningCurrentBlock = this.trackCurrentMineBlock(waypoint, this.waitTicks % 3 === 0);
        Client.setKey('leftclick', miningCurrentBlock);
        if (this.tickGliding && miningCurrentBlock) {
            this.glideMineTicks++;
            const miningSpeed = MiningUtils.getMiningSpeed();
            if (miningSpeed) {
                this.glideTotalTicks = MiningUtils.getMineTime(block, miningSpeed, false) + this.tickGlideDelay();
                if (this.glideMineTicks >= this.glideTotalTicks) {
                    this.finishMineBlock(this.typeMineEnabled, true);
                    this.enterState('MINE_NEXT');
                    return;
                }
            }
        }
        if (++this.waitTicks < this.mineTimeoutTicks) return;

        if (++this.mineRetries > 8) {
            this.message(`&eSkipping stubborn block at ${block.x}, ${block.y}, ${block.z}.`);
            this.finishMineBlock(true);
            this.enterState('MINE_NEXT');
            return;
        }

        const aim = this.getMineAim(block, true);
        if (!aim) {
            if (this.handleUnreachableBlock(block)) return;
            this.finishMineBlock(true);
            this.enterState('MINE_NEXT');
            return;
        }
        this.currentMineAim = aim;
        OreRotations.trackVector(aim, this.oreMineSpeed);
        this.enterState('MINE_WAIT_ROTATION');
    }

    startAbilitySequence() {
        this.abilityFromChat = false;
        this.abilityAvailabilityConsumed = true;
        this.abilityUseReadyAt = 0;
        Client.setKey('leftclick', false);
        this.abilitySteps = this.buildAbilitySteps();
        this.enterState('ABILITY');
    }

    buildAbilitySteps() {
        const steps = [];
        let tick = 0;
        const add = (action, delayAfter = 1) => {
            steps.push({ tick, action });
            tick += delayAfter;
        };

        if (this.miningAbilityEnabled || this.abilityDrillSwapEnabled) {
            const rodSlot = Guis.findItemInHotbar('rod');
            if (rodSlot >= 0) {
                add(() => Guis.setItemSlot(rodSlot), 2);
                add(() => Client.rightClick(), 4);
            }

            add(() => Guis.setItemSlot(this.abilityDrillSwapEnabled ? this.abilityDrillSlot : this.drillSlot), 2);
            add(() => Client.rightClick(), 4);
        }

        add(() => {
            Client.setKey('leftclick', false);
            Guis.setItemSlot(this.drillSlot);
        }, 2);

        this.abilityTotalTicks = tick;
        return steps;
    }

    tickAbilitySequence() {
        this.abilitySteps.forEach((step) => {
            if (step.tick === this.waitTicks) step.action();
        });
        if (++this.waitTicks >= this.abilityTotalTicks) this.enterState('MINE_NEXT');
    }

    isMiningAbilityReady() {
        const tabAvailable = TabListUtils.getPickaxeAbilityStatus().includes('Available');
        if (tabAvailable && !this.abilityTabWasAvailable) {
            this.abilityAvailabilityConsumed = false;
            this.scheduleAbilityUseDelay();
        }
        this.abilityTabWasAvailable = tabAvailable;

        const available = tabAvailable || this.abilityFromChat;
        if (this.abilityAvailabilityConsumed || !available) {
            if (!available) this.abilityUseReadyAt = 0;
            return false;
        }

        if (!this.abilityUseReadyAt) this.scheduleAbilityUseDelay();
        return Date.now() >= this.abilityUseReadyAt;
    }

    scheduleAbilityUseDelay() {
        if (this.abilityUseReadyAt) return;
        this.abilityUseReadyAt = Date.now() + 1000 + Math.floor(Math.random() * 1001);
    }

    getMineAim(block, thorough = false, eyeOverride = null) {
        const eyePos = eyeOverride || Player.getPlayer()?.getEyePosition?.();
        if (!block || !eyePos) return null;

        const verticalAim = this.getVerticalMineAim(block, eyePos);
        if (verticalAim) return verticalAim;

        const lookVec = Player.asPlayerMP()?.getLookVector?.();
        let excludedAim = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            const hit = MiningBot.findVisibleAimPoint(block.x, block.y, block.z, eyePos, lookVec, MINE_REACH_SQ, false, excludedAim);
            if (!hit) break;
            const insetHit = this.insetMineAim(block, hit, eyePos);
            if (insetHit) return insetHit;
            excludedAim = hit;
        }
        if (!thorough) return null;

        const point = Raytrace.getVisiblePoint(block.x, block.y, block.z, true);
        if (!point) return null;
        return this.insetMineAim(block, { x: point[0], y: point[1], z: point[2] }, eyePos);
    }

    insetMineAim(block, aim, eyePosition) {
        const local = [aim.x - block.x, aim.y - block.y, aim.z - block.z];
        if (!local.every(Number.isFinite)) return null;
        const faceDistances = local.map((value) => Math.min(Math.abs(value), Math.abs(1 - value)));
        const faceAxis = faceDistances.indexOf(Math.min(...faceDistances));
        const point = [aim.x, aim.y, aim.z];
        for (let axis = 0; axis < 3; axis++) {
            if (axis === faceAxis) continue;
            const origin = axis === 0 ? block.x : axis === 1 ? block.y : block.z;
            point[axis] = Math.max(origin + MINE_AIM_EDGE_INSET, Math.min(origin + 1 - MINE_AIM_EDGE_INSET, point[axis]));
        }
        const inset = { x: point[0], y: point[1], z: point[2] };
        return this.isMineAimVisible(block, inset, eyePosition.x(), eyePosition.y(), eyePosition.z()) ? inset : null;
    }

    getVerticalMineAim(block, eyePosition) {
        if (!block || !eyePosition) return null;
        const eye = { x: Number(eyePosition.x()), y: Number(eyePosition.y()), z: Number(eyePosition.z()) };
        if (![eye.x, eye.y, eye.z].every(Number.isFinite)) return null;

        const edgeInset = 0.08;
        if (eye.x < block.x + edgeInset || eye.x > block.x + 1 - edgeInset || eye.z < block.z + edgeInset || eye.z > block.z + 1 - edgeInset) return null;

        const blockCenterY = block.y + 0.5;
        if (Math.abs(blockCenterY - eye.y) < 0.75) return null;
        const faceY = blockCenterY < eye.y ? block.y + 0.98 : block.y + 0.02;
        const distance = Math.abs(faceY - eye.y);
        if (distance * distance > MINE_REACH_SQ) return null;

        const aim = { x: eye.x, y: faceY, z: eye.z };
        return this.isMineAimVisible(block, aim, eye.x, eye.y, eye.z) ? aim : null;
    }

    isMineAimVisible(block, aim, eyeX, eyeY, eyeZ) {
        return (
            (aim.x - eyeX) ** 2 + (aim.y - eyeY) ** 2 + (aim.z - eyeZ) ** 2 <= MINE_REACH_SQ &&
            Raytrace.isLineClear(eyeX, eyeY, eyeZ, aim.x, aim.y, aim.z, block.x, block.y, block.z) &&
            visibilityChecker.testPointNative(block.x, block.y, block.z, [aim.x, aim.y, aim.z], { x: eyeX, y: eyeY, z: eyeZ })
        );
    }

    getEtherwarpVisiblePoints(x, y, z) {
        const eyeCoords = getEtherwarpEyeCoords(true);
        const crouchedEye = eyeCoords ? { x: eyeCoords[0], y: eyeCoords[1], z: eyeCoords[2] } : null;
        const visible = this.raytraceVisiblePoints(x, y, z, crouchedEye, 12, 96, this.etherwarpRayCursor);
        this.etherwarpRayCursor = (this.etherwarpRayCursor + 96) % ETHERWARP_FACE_OFFSETS.length;
        return visible;
    }

    raytraceVisiblePoints(x, y, z, eyeOverride = null, maxResults = Infinity, maxChecks = Infinity, startIndex = 0) {
        const eye = eyeOverride || visibilityChecker.getPlayerEyePosition();
        if (!eye) return [];
        const visible = [];
        const checks = Math.min(ETHERWARP_FACE_OFFSETS.length, maxChecks);
        for (let checked = 0; checked < checks; checked++) {
            const offset = ETHERWARP_FACE_OFFSETS[(startIndex + checked) % ETHERWARP_FACE_OFFSETS.length];
            const point = [x + offset[0], y + offset[1], z + offset[2]];
            if (!visibilityChecker.testPointCustom(x, y, z, point, eye)) continue;
            if (!this.hasEtherwarpRayClearance(x, y, z, point, eye)) continue;
            visible.push({ point: { x: point[0], y: point[1], z: point[2] } });
            if (visible.length >= maxResults) break;
        }
        return visible;
    }

    hasEtherwarpRayClearance(x, y, z, point, eye) {
        const local = [point[0] - x, point[1] - y, point[2] - z];
        let faceAxis = 0;
        let closestFaceDistance = Math.min(local[0], 1 - local[0]);
        for (let axis = 1; axis < 3; axis++) {
            const faceDistance = Math.min(local[axis], 1 - local[axis]);
            if (faceDistance < closestFaceDistance) {
                faceAxis = axis;
                closestFaceDistance = faceDistance;
            }
        }

        for (let axis = 0; axis < 3; axis++) {
            if (axis === faceAxis) continue;
            for (const direction of [-1, 1]) {
                const shifted = [...point];
                shifted[axis] += direction * ETHERWARP_RAY_CLEARANCE;
                const shiftedLocal = shifted[axis] - [x, y, z][axis];
                if (shiftedLocal < ETHERWARP_EDGE_INSET || shiftedLocal > 1 - ETHERWARP_EDGE_INSET) return false;
                if (!visibilityChecker.testPointCustom(x, y, z, shifted, eye)) return false;
            }
        }
        return true;
    }

    startEtherwarpStrafe(waypoint) {
        const key = this.chooseEtherwarpStrafeKey(waypoint);
        if (!key) return false;

        Client.setKey('a', false);
        Client.setKey('d', false);
        this.strafeKey = key;
        this.etherwarpStrafeAligned = false;
        this.ensureShiftHeld();
        OreRotations.lookAtVector(this.getStrafeAimPoint(waypoint), this.oreTeleportSpeed);
        this.enterState('TP_STRAFE');
        return true;
    }

    chooseEtherwarpStrafeKey(waypoint) {
        const eyeCoords = getEtherwarpEyeCoords(true);
        if (!eyeCoords || !waypoint?.pos) return null;

        const eye = { x: eyeCoords[0], y: eyeCoords[1], z: eyeCoords[2] };
        const { x, y, z } = waypoint.pos;
        const center = MathUtils.blockCenter(x, y, z);
        const dx = center.x - eye.x;
        const dz = center.z - eye.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.1) return null;

        const left = { x: dz / length, z: -dx / length };
        for (let distance = 0.5; distance <= 2.5; distance += 0.5) {
            const leftEye = { x: eye.x + left.x * distance, y: eye.y, z: eye.z + left.z * distance };
            const rightEye = { x: eye.x - left.x * distance, y: eye.y, z: eye.z - left.z * distance };
            const leftVisibility = this.raytraceVisiblePoints(x, y, z, leftEye, 4, 96, 0).length;
            const rightVisibility = this.raytraceVisiblePoints(x, y, z, rightEye, 4, 96, 0).length;

            if (leftVisibility > rightVisibility) return 'a';
            if (rightVisibility > leftVisibility) return 'd';
            if (leftVisibility > 0) break;
        }

        this.lastEtherwarpStrafeKey = this.lastEtherwarpStrafeKey === 'a' ? 'd' : 'a';
        return this.lastEtherwarpStrafeKey;
    }

    findMiningStrafeTarget(x, y, z) {
        const playerEye = Player.getPlayer()?.getEyePosition?.();
        const eye = playerEye ? { x: playerEye.x(), y: playerEye.y(), z: playerEye.z() } : visibilityChecker.getPlayerEyePosition();
        if (!eye) return null;
        const center = MathUtils.blockCenter(x, y, z);
        const dx = center.x - eye.x;
        const dz = center.z - eye.z;
        const length = Math.hypot(dx, dz);
        const yaw = (Player.getYaw() * Math.PI) / 180;
        const forward = length < 0.1 ? { x: -Math.sin(yaw), z: Math.cos(yaw) } : { x: dx / length, z: dz / length };
        const left = { x: forward.z, z: -forward.x };
        const directions = [];
        for (let index = 0; index < 8; index++) {
            const angle = (index * Math.PI) / 4;
            directions.push({
                x: forward.x * Math.cos(angle) + left.x * Math.sin(angle),
                z: forward.z * Math.cos(angle) + left.z * Math.sin(angle),
            });
        }

        for (let distance = 0.5; distance < Math.sqrt(MINE_REACH_SQ); distance += 0.5) {
            for (const direction of directions) {
                const candidateEye = new Vec3d(eye.x + direction.x * distance, eye.y, eye.z + direction.z * distance);
                const aim = MiningBot.findVisibleAimPoint(x, y, z, candidateEye, null, MINE_REACH_SQ, false);
                const targetX = Player.getX() + direction.x * distance;
                const targetZ = Player.getZ() + direction.z * distance;
                if (
                    aim &&
                    this.canStrafeTo(targetX, targetZ) &&
                    this.isMineAimVisible({ x, y, z }, aim, candidateEye.x(), candidateEye.y(), candidateEye.z())
                ) {
                    return {
                        x: targetX,
                        z: targetZ,
                        aim,
                    };
                }
            }
        }
        return null;
    }

    canStrafeTo(targetX, targetZ) {
        const startX = Player.getX();
        const startZ = Player.getZ();
        const steps = Math.ceil(Math.hypot(targetX - startX, targetZ - startZ) / 0.25);
        const y = Math.floor(Player.getY());
        for (let step = 1; step <= steps; step++) {
            const x = startX + ((targetX - startX) * step) / steps;
            const z = startZ + ((targetZ - startZ) * step) / steps;
            for (const offsetX of [-0.29, 0.29]) {
                for (const offsetZ of [-0.29, 0.29]) {
                    if (MiningBot.isSolidBlockAt(x + offsetX, y, z + offsetZ) || MiningBot.isSolidBlockAt(x + offsetX, y + 1, z + offsetZ)) return false;
                }
            }
        }
        return true;
    }

    findNearestWaypoint() {
        let bestIndex = 0;
        let bestDistance = Infinity;
        this.loadedWaypoints.forEach((waypoint, index) => {
            const distance = this.waypointDistanceSq(waypoint);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        });
        return bestIndex;
    }

    waypointDistanceSq(waypoint) {
        const dx = Player.getX() - waypoint.pos.x;
        const dy = Player.getY() - waypoint.pos.y;
        const dz = Player.getZ() - waypoint.pos.z;
        return dx * dx + dy * dy + dz * dz;
    }

    isAtWaypoint(waypoint) {
        return isAtEtherwarpLanding(waypoint.pos);
    }

    findTypeMineBlocks() {
        const costs = this.typeMineCosts[this.typeMineName];
        const eyePos = Player.getPlayer()?.getEyePosition?.();
        if (!costs || !eyePos) return [];

        const lookVec = Player.asPlayerMP()?.getLookVector?.();
        const candidates = MiningBot.collectScanTargets(costs, eyePos, lookVec, MiningBot.mineReach, null, true, false).reachableCandidates;
        const heightCostPerBlock = this.typeMinePriority === 'High' ? -10 : this.typeMinePriority === 'Low' ? 10 : 0;
        candidates.sort((a, b) => a.cheapCost - b.cheapCost + (a.y - b.y) * heightCostPerBlock);
        const targets = [];
        const lookLength = lookVec ? Math.hypot(lookVec.x(), lookVec.z()) : 0;
        const minimumFovDot = Math.cos((this.typeMineFov * Math.PI) / 360);
        for (const candidate of candidates) {
            if (this.typeMineIgnored[this.mineBlockKey(candidate)]) continue;

            const dx = candidate.x + 0.5 - eyePos.x();
            const dz = candidate.z + 0.5 - eyePos.z();
            const horizontalDistance = Math.hypot(dx, dz);
            const lookDot = lookLength && horizontalDistance ? (dx * lookVec.x() + dz * lookVec.z()) / (horizontalDistance * lookLength) : 1;
            if (this.typeMineFov < 360 && lookDot < minimumFovDot) continue;
            const aim = this.getMineAim(candidate);
            if (!aim || !this.hasMinimumTypeMineVisibility(candidate, aim, eyePos)) continue;
            targets.push(candidate);
            if (targets.length >= 3) break;
        }
        return targets;
    }

    hasMinimumTypeMineVisibility(block, aim, eyePosition) {
        return (
            this.typeMineMinVisibleRays <= 0 || MiningBot.countVisibleRays(block, aim, eyePosition, this.typeMineMinVisibleRays) >= this.typeMineMinVisibleRays
        );
    }

    getCurrentMineBlock(waypoint) {
        return this.typeMineEnabled ? this.typeMineBlock : waypoint.minableBlocks[this.mineIndex];
    }

    trackCurrentMineBlock(waypoint, thorough = false) {
        const block = this.getCurrentMineBlock(waypoint);
        if (!block || this.shouldSkipBlock(block)) return false;

        const eye = Player.getPlayer()?.getEyePosition?.();
        if (!eye) return false;
        if (!this.currentMineAim || (thorough && !this.isMineAimVisible(block, this.currentMineAim, eye.x(), eye.y(), eye.z()))) {
            this.currentMineAim = this.getMineAim(block, thorough);
        }
        if (this.currentMineAim) OreRotations.trackVector(this.currentMineAim, this.oreMineSpeed);
        else OreRotations.stop();
        return !!this.currentMineAim && this.isCrosshairOnBlock(block);
    }

    finishMineBlock(ignore = false, keepMining = false) {
        if (!keepMining) Client.setKey('leftclick', false);
        this.resetTickGlide();
        if (!this.typeMineEnabled) {
            this.mineIndex++;
            return;
        }
        if (ignore && this.typeMineBlock) this.typeMineIgnored[this.mineBlockKey(this.typeMineBlock)] = true;
        this.typeMineBlock = null;
        this.typeMineNextBlock = null;
    }

    resetTickGlide() {
        this.glideMineTicks = 0;
        this.glideTotalTicks = 0;
    }

    tickGlideDelay() {
        return Math.max(0, 20 + this.glideLagCompensation - Math.trunc(ServerInfo.getTPS()));
    }

    mineBlockKey(block) {
        return `${block.x},${block.y},${block.z}`;
    }

    isCrosshairOnBlock(block) {
        const pos = block && Raytrace.getLookingAt(5)?.getPos?.();
        return !!pos && pos.getX() === block.x && pos.getY() === block.y && pos.getZ() === block.z;
    }

    shouldSneakForMineBlock(block) {
        return this.sneakWhileMining && !!block;
    }

    shouldSkipBlock(block) {
        const blockName = this.getBlockName(block);
        return !blockName || MiningBot.isAirOrBedrock(blockName);
    }

    getBlockName(block) {
        if (!block) return '';
        const worldBlock = World.getBlockAt(block.x, block.y, block.z);
        return worldBlock ? String(worldBlock.type.getRegistryName() || '').toLowerCase() : '';
    }

    findNextMineTarget(fromIndex) {
        if (this.typeMineEnabled) return this.typeMineNextBlock;
        const blocks = this.loadedWaypoints[this.waypointIndex]?.minableBlocks || [];
        for (let index = fromIndex; index < blocks.length; index++) {
            if (!this.shouldSkipBlock(blocks[index])) return blocks[index];
        }
        return null;
    }

    enterState(state) {
        this.state = state;
        this.waitTicks = 0;
    }

    ensureShiftHeld() {
        if (!Client.isKeyDown('shift')) Client.setKey('shift', true);
    }

    stopStrafing(releaseSneak = true) {
        if (this.strafeKey) Client.setKey(this.strafeKey, false);
        if (releaseSneak) Client.setKey('shift', false);
        this.strafeKey = null;
        this.etherwarpStrafeAligned = false;
    }

    stopMiningStrafe(releaseSneak = true, stopRotation = true) {
        Keybind.stopMovement();
        if (releaseSneak) Keybind.setKey('shift', false);
        this.mineStrafeTarget = null;
        if (stopRotation) OreRotations.stop();
    }

    releaseControls() {
        RoutePathWalker.stop();
        this.stopMiningStrafe();
        this.stopStrafing();
        Client.unpressKeys();
    }

    render() {
        if (!this.showOverlay || !this.loadedWaypoints) return;
        const closestWaypoint = this.loadedWaypoints.length ? this.findNearestWaypoint() : -1;
        this.loadedWaypoints.forEach((waypoint, index) => {
            const colors =
                this.editing && index === this.selectedWaypoint
                    ? [COLORS.selectedFill, COLORS.selectedWire]
                    : waypoint.isDeployable
                      ? [COLORS.deployableFill, COLORS.deployableWire]
                      : waypoint.type === 'Warp'
                        ? [COLORS.warpFill, COLORS.warpWire]
                        : waypoint.type === 'Walk'
                          ? [COLORS.walkFill, COLORS.walkWire]
                          : [COLORS.teleportFill, COLORS.teleportWire];
            RenderUtils.drawStyledBox(new Vec3d(waypoint.pos.x, waypoint.pos.y, waypoint.pos.z), colors[0], colors[1], 2, false);
            RenderUtils.drawText(`[${index}]`, new Vec3d(waypoint.pos.x + 0.5, waypoint.pos.y + 1.3, waypoint.pos.z + 0.5), 1.2, true, false, false);
            if (index === closestWaypoint) {
                waypoint.minableBlocks.forEach((block, mineIndex) => {
                    const type = block.oneTap ? '1T' : block.rOneTap ? 'RT' : 'M';
                    RenderUtils.drawText(`${type}[${mineIndex}]`, new Vec3d(block.x + 0.5, block.y + 1.1, block.z + 0.5), 1, true, false, true);
                });
            }
            waypoint.minableBlocks.forEach((block) => {
                const mineColors = block.oneTap
                    ? [COLORS.oneTapFill, COLORS.oneTapWire]
                    : block.rOneTap
                      ? [COLORS.rOneTapFill, COLORS.rOneTapWire]
                      : [COLORS.mineFill, COLORS.mineWire];
                RenderUtils.drawStyledBox(
                    new Vec3d(block.x, block.y, block.z),
                    mineColors[0],
                    mineColors[1],
                    index === this.selectedWaypoint ? 3 : 2,
                    false
                );
            });
        });
        if (this.currentRenderTarget) {
            const { x, y, z } = this.currentRenderTarget;
            RenderUtils.drawStyledBox(new Vec3d(x, y, z), COLORS.currentFill, COLORS.currentWire, 3, false);
        }
        if (this.nextRenderTarget) {
            const { x, y, z } = this.nextRenderTarget;
            RenderUtils.drawStyledBox(new Vec3d(x, y, z), COLORS.nextFill, COLORS.nextWire, 3, false);
        }
    }
}

export default new OreMiner();
