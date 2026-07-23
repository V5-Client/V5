import { File, V5ConfigFile, Vec3d } from '../../utils/Constants';
import { getEtherwarpEyeCoords } from '../../utils/Etherwarp';
import { MathUtils } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import { Raytrace, visibilityChecker } from '../../utils/Raytrace';
import { Router } from '../../utils/Router';
import { manager } from '../../utils/SkyblockEvents';
import { TabListUtils } from '../../utils/TabListUtils';
import { Utils } from '../../utils/Utils';
import { v5Command } from '../../utils/V5Commands';
import { EtherwarpPathfinder } from '../../utils/pathfinder/EtherwarpPathfinder';
import { MiningBot } from './MiningBot';
import { Guis } from '../../utils/player/Inventory';
import { Movement } from '../../utils/player/Movement';
import { OreRotations } from '../../utils/player/OreRotations';

const MINE_REACH_SQ = 4.49 * 4.49;
const ETHERWARP_EDGE_INSET = 0.1;
const ETHERWARP_FACE_DEPTH = 0.01;
const ETHERWARP_RAY_CLEARANCE = 0.06;
const DEPLOYABLE_DETECTION_RADIUS = 4;
const DEPLOYABLE_DETECTION_RADIUS_SQ = DEPLOYABLE_DETECTION_RADIUS * DEPLOYABLE_DETECTION_RADIUS;
const DEPLOYABLE_ENTITY_NAMES = ['power orb', 'glacite lantern'];
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
    currentFill: new RenderColor(180, 100, 255, 35),
    currentWire: new RenderColor(180, 100, 255, 255),
    nextFill: new RenderColor(255, 130, 70, 25),
    nextWire: new RenderColor(255, 130, 70, 255),
    teleportFill: new RenderColor(180, 100, 255, 15),
    teleportWire: new RenderColor(180, 100, 255, 125),
    walkFill: new RenderColor(100, 200, 255, 15),
    walkWire: new RenderColor(100, 200, 255, 190),
    deployableFill: new RenderColor(180, 0, 180, 20),
    deployableWire: new RenderColor(180, 0, 180, 220),
    selectedFill: new RenderColor(255, 255, 255, 35),
    selectedWire: new RenderColor(255, 220, 0, 255),
    mineFill: new RenderColor(255, 60, 60, 25),
    mineWire: new RenderColor(200, 0, 0, 200),
    selectedMineFill: new RenderColor(255, 160, 0, 35),
    selectedMineWire: new RenderColor(255, 100, 0, 220),
};

class OreMiner extends ModuleBase {
    constructor() {
        super({
            name: 'Ore Macro',
            subcategory: 'Mining',
            description: 'Builds and mines Tp/Walk ore routes.',
            tooltip: 'Build or load a route with /v5 mining ore, then toggle the macro.',
            theme: '#815bf5',
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
        this.strafeKey = null;
        this.etherwarpStrafeAligned = false;
        this.lastEtherwarpStrafeKey = 'd';
        this.strafedForBlock = false;
        this.currentRenderTarget = null;
        this.nextRenderTarget = null;

        this.oreMineSpeed = 0.12;
        this.oreTeleportSpeed = 0.12;
        this.mineTimeoutTicks = 8;
        this.teleportStrafing = false;
        this.miningStrafing = false;
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

        this.addSeparator('Rotations');
        this.addSlider('Ore Mining Rotation Speed', 1, 100, 12, (value) => (this.oreMineSpeed = value / 100), 'Rotation speed for mining targets.');
        this.addSlider(
            'Ore Etherwarp Rotation Speed',
            1,
            100,
            12,
            (value) => (this.oreTeleportSpeed = value / 100),
            'Rotation speed for etherwarping targets.'
        );
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
        this.addToggle('Route Overlay', (value) => (this.showOverlay = value), 'Draw waypoints and current/next mining targets.', true);

        this.addSeparator('Mining Ability');
        this.addToggle(
            'Mining Ability',
            (value) => (this.miningAbilityEnabled = value),
            'Activates the mining ability when it becomes available, including the configured hotbar rod swap and click.'
        );
        this.addToggle(
            'Ability Drill Swap',
            (value) => (this.abilityDrillSwapEnabled = value),
            'Also swaps to the secondary drill, activates its ability, then returns to the main drill.'
        );
        this.addSlider('Ability Drill Slot', 1, 8, 2, (value) => (this.abilityDrillSlot = Math.round(value) - 1), 'Secondary drill hotbar slot.');

        this.bindToggleKey('Toggle Ore Miner');
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
        this.message('  &fedit add <tp|walk|mine|onetap|ronetap> [waypoint]');
        this.message('  &fedit deployable <waypoint> &7- toggle deployable placement');
        this.message('  &fedit remove <waypoint> [mine block]');
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
            if (['mine', 'onetap', 'ronetap'].includes(type)) return this.addMineBlock(type, args[0]);
            return this.message('&cUsage: /v5 mining ore edit add <tp|walk|mine|onetap|ronetap> [waypoint]');
        } else if (action === 'deployable') {
            return this.toggleDeployable(args[0]);
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

        this.message('&cUsage: /v5 mining ore edit <add|deployable|remove|undo|clear|list|done>');
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
        this.message(`&aAdded ${route[index].type} waypoint [${index}].`);
    }

    addMineBlock(type, indexArg) {
        const route = this.loadedWaypoints;
        const index = indexArg === undefined ? route?.length - 1 : Number.parseInt(indexArg, 10);
        if (!route?.length || !Number.isInteger(index) || index < 0 || index >= route.length) {
            return this.message('&cAdd a waypoint first, or provide a valid waypoint index.');
        }

        const hit = Raytrace.getLookingAt(10);
        const pos = hit?.getPos?.();
        if (!pos) return this.message('&cLook at a block within 10 blocks.');

        this.recordUndo();
        route[index].minableBlocks.push({
            x: pos.getX(),
            y: pos.getY(),
            z: pos.getZ(),
            oneTap: type === 'onetap',
            rOneTap: type === 'ronetap',
        });
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
        this.selectedWaypoint = Math.min(this.selectedWaypoint, this.loadedWaypoints.length - 1);
        this.message('&eUndid the last route edit.');
    }

    saveRoute(name) {
        const cleanName = sanitizeRouteName(name);
        if (!cleanName || !this.loadedWaypoints || !this.loadedWaypoints.length) return this.message('&cUsage: /v5 mining ore save <name>');
        Utils.writeConfigFile(`${ROUTE_DIR_RELATIVE}/${cleanName}.json`, this.loadedWaypoints);
        this.loadedPath = String(new File(ORE_ROUTES_DIR, `${cleanName}.json`).getAbsolutePath());
        this.undoStack = [];
        this.message(`&aSaved ${this.loadedWaypoints.length} waypoints as &f${cleanName}&a.`);
    }

    printRoute() {
        if (!this.loadedWaypoints || !this.loadedWaypoints.length) return this.message('&7No route loaded.');
        this.message(`&bOre route &7(${this.loadedWaypoints.length} waypoints):`);
        this.loadedWaypoints.forEach((waypoint, index) => {
            const deployable = waypoint.isDeployable ? ' &d[DEPLOYABLE]' : '';
            this.message(
                `  &8[${index}] &f${waypoint.type}${deployable} &7@ &e${waypoint.pos.x}, ${waypoint.pos.y}, ${waypoint.pos.z} &7- &f${waypoint.minableBlocks.length} blocks`
            );
        });
    }

    resolveRoutePath(routeRef) {
        const name = sanitizeRouteName(routeRef);
        if (!name) return null;
        const file = new File(ORE_ROUTES_DIR, `${name}.json`);
        return file.exists() && file.isFile() ? { path: String(file.getAbsolutePath()), name } : null;
    }

    listRoutes() {
        const files = Router.getFilesInDir(ROUTE_DIR_RELATIVE);
        this.message(`&bOre Miner Routes &7(${files.length})`);
        files.forEach((name) => this.message(`  &f${name} &7- /v5 mining ore load ${name}`));
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
        if (type !== 'tp' && type !== 'walk') return null;
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
                          isDeployable: !!block.isDeployable,
                      };
                  })
                  .filter(Boolean)
            : [];

        return {
            pos,
            type: type === 'tp' ? 'Tp' : 'Walk',
            minableBlocks,
            isDeployable: !!waypoint.isDeployable,
        };
    }

    normalizePosition(position) {
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
        this.waypointIndex = this.findNearestWaypoint();
        this.enterState(this.isAtWaypoint(this.loadedWaypoints[this.waypointIndex]) ? 'MINE_INIT' : 'WAYPOINT');
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
                if (waypoint.type === 'Walk') {
                    this.updateWalkWaypointLookAhead();
                    this.enterState('WALK');
                } else if (this.isAtWaypoint(waypoint)) {
                    this.enterState('MINE_INIT');
                } else {
                    this.aotvSlot = EtherwarpPathfinder.getEtherwarpSlot();
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
                this.currentRenderTarget = null;
                this.nextRenderTarget = null;
                Client.setKey('leftclick', false);
                if (waypoint.isDeployable && this.deployableWaypointsEnabled && !this.hasNearbyDeployable(waypoint.pos)) this.enterState('DEPLOYABLE');
                else {
                    Guis.setItemSlot(this.drillSlot);
                    Client.setKey('leftclick', true);
                    this.enterState('MINE_NEXT');
                }
                return;

            case 'MINE_NEXT':
                return this.beginNextBlock(waypoint);

            case 'MINE_STRAFE':
                return this.tickMineStrafe(waypoint);

            case 'MINE_WAIT_ROTATION':
                if (!OreRotations.isRotating || ++this.waitTicks >= 60) this.beginMiningAction(waypoint);
                return;

            case 'MINE_ONETAP':
                if (++this.waitTicks >= 2) {
                    Client.setKey('leftclick', true);
                    this.mineIndex++;
                    this.enterState('MINE_NEXT');
                }
                return;

            case 'MINE_HOLD':
                return this.tickMineHold(waypoint);

            case 'ADVANCE':
                this.waypointIndex = (this.waypointIndex + 1) % this.loadedWaypoints.length;
                this.mineIndex = 0;
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
        const dx = Player.getX() - x;
        const dy = Player.getY() - y;
        const dz = Player.getZ() - z;
        if (dx * dx + dz * dz <= 0.6 && Math.abs(dy) <= 2) {
            const hasAction = waypoint.minableBlocks.some((block) => !block.isDeployable) || (waypoint.isDeployable && this.deployableWaypointsEnabled);
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

                Client.stopMovement();
                Client.setKey('shift', false);
                OreRotations.stop();
                this.enterState('WAYPOINT');
                return;
            }

            Client.stopMovement();
            Client.setKey('shift', false);
            OreRotations.stop();
            this.enterState('MINE_INIT');
            return;
        }

        const nearEdge = this.hasEdgeAhead(x, y, z);
        Movement.setKeysForStraightLineCoords(x, y, z, !nearEdge);
        Client.setKey('shift', nearEdge);
        Client.setKey('sprint', !nearEdge && dx * dx + dz * dz > 2);
        this.waitTicks++;
        this.updateWalkWaypointLookAhead();
        if (this.waitTicks >= 300) {
            this.message('&cWalk waypoint timed out.');
            this.toggle(false);
        }
    }

    updateWalkWaypointLookAhead() {
        const target = this.findWalkPreAimTarget();
        if (!target) return false;
        return OreRotations.trackVector(target.vector, target.teleport ? this.oreTeleportSpeed : this.oreMineSpeed);
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

            const block = (waypoint.minableBlocks || []).find((candidate) => !candidate.isDeployable);
            if (block) {
                return {
                    vector: MathUtils.blockCenter(block.x, block.y, block.z),
                    teleport: false,
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
            Client.setKey('leftclick', true);
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

        const blocks = waypoint.minableBlocks;
        while (this.mineIndex < blocks.length && this.shouldSkipBlock(blocks[this.mineIndex])) this.mineIndex++;
        if (this.mineIndex >= blocks.length) {
            Client.setKey('leftclick', false);
            this.enterState('ADVANCE');
            return;
        }

        const block = blocks[this.mineIndex];
        const aim = this.getMineAim(block);
        if (!aim) {
            if (this.miningStrafing) {
                const key = this.findVisibilityStrafe(block.x, block.y, block.z);
                if (key) {
                    this.strafeKey = key;
                    this.strafedForBlock = true;
                    OreRotations.lookAtVector(MathUtils.blockCenter(block.x, block.y, block.z), this.oreMineSpeed);
                    this.enterState('MINE_STRAFE');
                    return;
                }
            }
            this.mineIndex++;
            return;
        }

        this.prepareBlock(block, aim);
    }

    tickMineStrafe(waypoint) {
        if (OreRotations.isRotating) return;
        Client.setKey('shift', true);
        Client.setKey(this.strafeKey, true);
        const block = waypoint.minableBlocks[this.mineIndex];
        const aim = this.getMineAim(block);
        if (aim) {
            this.stopStrafing(false);
            this.prepareBlock(block, aim);
        } else if (++this.waitTicks >= 40) {
            this.stopStrafing();
            this.strafedForBlock = false;
            this.mineIndex++;
            this.enterState('MINE_NEXT');
        }
    }

    prepareBlock(block, aim) {
        this.currentBlockName = this.getBlockName(block);
        this.currentRenderTarget = { x: block.x, y: block.y, z: block.z };
        this.nextRenderTarget = this.findNextMineTarget(this.mineIndex + 1);
        this.mineRetries = 0;
        if (block.oneTap || block.rOneTap) Client.setKey('leftclick', false);
        else Client.setKey('leftclick', true);
        OreRotations.lookAtVector(aim, this.oreMineSpeed);
        this.enterState('MINE_WAIT_ROTATION');
    }

    beginMiningAction(waypoint) {
        const block = waypoint.minableBlocks[this.mineIndex];
        if (!block) return this.enterState('MINE_NEXT');
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
        const block = waypoint.minableBlocks[this.mineIndex];
        const blockName = this.getBlockName(block);
        if (blockName !== this.currentBlockName || MiningBot.isAirOrBedrock(blockName)) {
            if (this.strafedForBlock) {
                Client.setKey('shift', false);
                this.strafedForBlock = false;
            }
            this.mineIndex++;
            this.enterState('MINE_NEXT');
            return;
        }

        Client.setKey('leftclick', true);
        if (++this.waitTicks < this.mineTimeoutTicks) return;

        if (++this.mineRetries > 8) {
            this.message(`&eSkipping stubborn block at ${block.x}, ${block.y}, ${block.z}.`);
            this.mineIndex++;
            this.enterState('MINE_NEXT');
            return;
        }

        const aim = this.getMineAim(block);
        if (!aim) {
            this.mineIndex++;
            this.enterState('MINE_NEXT');
            return;
        }
        OreRotations.lookAtVector(aim, this.oreMineSpeed);
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
        add(() => Client.setKey('leftclick', true), 2);

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

    getMineAim(block) {
        const eyePos = Player.getPlayer()?.getEyePosition?.();
        const verticalAim = this.getVerticalMineAim(block, eyePos);
        if (verticalAim) return verticalAim;

        const lookVec = Player.asPlayerMP()?.getLookVector?.();
        const hit = MiningBot.findVisibleAimPoint(block.x, block.y, block.z, eyePos, lookVec, MINE_REACH_SQ, false);
        return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
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

        const point = [eye.x, faceY, eye.z];
        if (!visibilityChecker.testPointCustom(block.x, block.y, block.z, point, eye)) return null;
        return { x: eye.x, y: faceY, z: eye.z };
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

    findVisibilityStrafe(x, y, z) {
        const eye = visibilityChecker.getPlayerEyePosition();
        if (!eye) return null;
        const center = MathUtils.blockCenter(x, y, z);
        const dx = center.x - eye.x;
        const dz = center.z - eye.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.1) return null;
        const left = { x: dz / length, z: -dx / length };
        for (let distance = 0.5; distance <= 2; distance += 0.5) {
            if (this.hasVisibilityFrom(x, y, z, { x: eye.x + left.x * distance, y: eye.y, z: eye.z + left.z * distance })) return 'a';
            if (this.hasVisibilityFrom(x, y, z, { x: eye.x - left.x * distance, y: eye.y, z: eye.z - left.z * distance })) return 'd';
        }
        return null;
    }

    hasVisibilityFrom(x, y, z, eye) {
        return visibilityChecker.faceOffsets.some((offset) => {
            const point = [x + offset[0], y + offset[1], z + offset[2]];
            return visibilityChecker.testPointCustom(x, y, z, point, eye);
        });
    }

    hasEdgeAhead(targetX, targetY, targetZ) {
        const dx = targetX - Player.getX();
        const dz = targetZ - Player.getZ();
        const distance = Math.hypot(dx, dz);
        if (distance < 0.1) return false;
        const maxDrop = Math.floor(targetY) >= Math.floor(Player.getY()) ? 1 : 3;
        for (let forward = 0.5; forward <= 1.5; forward += 0.5) {
            const x = Math.floor(Player.getX() + (dx / distance) * forward);
            const z = Math.floor(Player.getZ() + (dz / distance) * forward);
            let foundGround = false;
            for (let drop = 1; drop <= maxDrop; drop++) {
                const block = World.getBlockAt(x, Math.floor(Player.getY()) - drop, z);
                if (block && block.type.getID() !== 0) {
                    foundGround = true;
                    break;
                }
            }
            if (!foundGround) return true;
        }
        return false;
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
        return this.waypointDistanceSq(waypoint) <= (waypoint.type === 'Walk' ? 4 : 2);
    }

    shouldSkipBlock(block) {
        const blockName = this.getBlockName(block);
        return block.isDeployable || !blockName || MiningBot.isAirOrBedrock(blockName);
    }

    getBlockName(block) {
        if (!block) return '';
        const worldBlock = World.getBlockAt(block.x, block.y, block.z);
        return worldBlock ? String(worldBlock.type.getRegistryName() || '').toLowerCase() : '';
    }

    findNextMineTarget(fromIndex) {
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

    releaseControls() {
        this.stopStrafing();
        Client.unpressKeys();
    }

    render() {
        if ((!this.enabled && !this.editing) || !this.showOverlay || !this.loadedWaypoints) return;
        this.loadedWaypoints.forEach((waypoint, index) => {
            const colors =
                this.editing && index === this.selectedWaypoint
                    ? [COLORS.selectedFill, COLORS.selectedWire]
                    : waypoint.isDeployable
                      ? [COLORS.deployableFill, COLORS.deployableWire]
                      : waypoint.type === 'Walk'
                        ? [COLORS.walkFill, COLORS.walkWire]
                        : [COLORS.teleportFill, COLORS.teleportWire];
            RenderUtils.drawStyledBox(new Vec3d(waypoint.pos.x, waypoint.pos.y, waypoint.pos.z), colors[0], colors[1], 2, false);
            if (this.editing) {
                waypoint.minableBlocks.forEach((block) => {
                    const mineColors =
                        index === this.selectedWaypoint ? [COLORS.selectedMineFill, COLORS.selectedMineWire] : [COLORS.mineFill, COLORS.mineWire];
                    RenderUtils.drawStyledBox(new Vec3d(block.x, block.y, block.z), mineColors[0], mineColors[1], 2, false);
                });
            }
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
