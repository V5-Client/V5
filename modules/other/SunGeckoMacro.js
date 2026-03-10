import { Chat } from '../../utils/Chat';
import { OverlayManager } from '../../gui/OverlayUtils';
import { CombatBot } from '../combat/CombatBot';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Mouse } from '../../utils/Ungrab';

// this module was completely ai coded
// good luck anyone trying to maintain it in the future
// it consists of entirely random magic numbers that somehow make a functioning macro (tbh thats the same as all v5 macros)

const States = {
    WAITING: 0,
    DETERMIN: 4,
    COMBAT: 5,
};

const Points = [
    { name: 'Rift Spawn', x: -45, y: 121, z: 69 },
    { name: 'Rift Spawn Exit', x: -45, y: 110, z: 69 },
    { name: 'Eye Teleporter', x: -50, y: 104, z: 71 },
    { name: 'Mountain Top', x: 48, y: 168, z: 38 },
    { name: 'Boss Path', x: 39, y: 86, z: 4 },
    { name: 'Boss Enter', x: 38, y: 88, z: 23 },
    { name: 'Boss Combat', x: -188, y: 17, z: 181.7 },
    { name: 'Hub Tower', x: 44, y: 118, z: 93 },
];

const EYE_TELEPORTER = {
    name: 'Zombie',
    x: -50,
    y: 104,
    z: 71,
    menuItem: 'The 7th Sin',
};

const ORUO = {
    name: 'Oruo The Almighty',
    x: 38.5,
    y: 89.02,
    z: 18.5,
    menuItem: 'Enter...',
};

const BOSS_PATH_WAYPOINT = {
    x: 39,
    y: 86,
    z: 4,
};

const HUB_TOWER_WAYPOINT = {
    x: 44,
    y: 118,
    z: 97,
};

const RIFT_SPAWN_LADDER_WAYPOINT = {
    x: -43.5,
    y: 121,
    z: 72.5,
};

const RIFT_SPAWN_LADDER_AIM_POINT = {
    x: RIFT_SPAWN_LADDER_WAYPOINT.x,
    y: RIFT_SPAWN_LADDER_WAYPOINT.y + 1,
    z: RIFT_SPAWN_LADDER_WAYPOINT.z,
};

const RIFT_SPAWN_EXIT_WAYPOINT = {
    x: -45,
    y: 110,
    z: 69,
};

const SUN_GECKO_TARGET_CONFIG = {
    names: ['Sun Gecko'],
    checkVisibility: false,
    boundaryCheck: () => true,
};

const SUN_GECKO_COMBAT_ORIGIN = {
    x: -188,
    y: 17,
    z: 181.7,
};

const WARP_WIZARD_DELAY_TICKS = 40;

class SunGecko extends ModuleBase {
    constructor() {
        super({
            name: 'SunGecko',
            subcategory: 'Other',
            description: 'Automatically does the rift sun gecko',
            tooltip: 'Automatically does the rift sun gecko',
            showEnabledToggle: false,
            isMacro: true,
        });
        this.bindToggleKey();
        this.state = States.WAITING;
        this.pathRequestActive = false;
        this.rotationPending = false;
        this.rotationToken = 0;
        this.actionCooldownUntil = 0;
        this.terracottaClickCooldownUntil = 0;

        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        State: () => this.getStateName(),
                        Kills: () => this.formatNumber(OverlayManager.getTrackedValue(this.oid, 'kills', 0)),
                        'Kills/hr': () => this.formatHourlyRate(OverlayManager.getTrackedValue(this.oid, 'kills', 0)),
                        Essence: () => this.formatNumber(OverlayManager.getTrackedValue(this.oid, 'essence', 0)),
                        'Essence/hr': () => this.formatHourlyRate(OverlayManager.getTrackedValue(this.oid, 'essence', 0)),
                    },
                },
            ],
            {
                sessionTrackedValues: {
                    kills: 0,
                    essence: 0,
                },
            }
        );

        this.on('tick', () => {
            switch (this.state) {
                case States.WAITING:
                    break;
                case States.DETERMIN:
                    this.handleDetermin();
                    break;
                case States.COMBAT:
                    this.handleCombat();
                    break;
            }
        });

        this.on('chat', (event) => this.handleChatTracker(event));
    }

    handleChatTracker(event) {
        const message = event?.message?.getUnformattedText?.() ?? event?.message?.getString?.() ?? '';
        if (!message) return;

        if (message.includes('SUN GECKO DOWN!')) {
            OverlayManager.incrementTrackedValue(this.oid, 'kills');
        }

        const essenceMatch = message.match(/\+([\d,]+)\s+Sun Gecko Essence/i);
        if (!essenceMatch) return;

        const essenceAmount = Number(essenceMatch[1].replace(/,/g, ''));
        if (!Number.isFinite(essenceAmount) || essenceAmount <= 0) return;

        OverlayManager.incrementTrackedValue(this.oid, 'essence', essenceAmount);
    }

    countNearbyBlocks(registryName) {
        const baseX = Math.floor(Player.getX());
        const baseY = Math.floor(Player.getY());
        const baseZ = Math.floor(Player.getZ());
        const radius = 5;
        let total = 0;

        for (let x = baseX - radius; x <= baseX + radius; x++) {
            for (let y = baseY - radius; y <= baseY + radius; y++) {
                for (let z = baseZ - radius; z <= baseZ + radius; z++) {
                    const block = World.getBlockAt(x, y, z);
                    if (block?.type?.getRegistryName?.() !== registryName) continue;
                    total++;
                }
            }
        }

        return total;
    }

    scheduleState(nextState, delay = 1) {
        this.setState(States.WAITING);
        ScheduleTask(delay, () => {
            this.setState(nextState);
        });
    }

    buildPathGoals(x, y, z) {
        const goalX = Math.floor(x);
        const goalY = Math.floor(y);
        const goalZ = Math.floor(z);

        return [
            [goalX, goalY - 1, goalZ],
            [goalX, goalY, goalZ],
            [goalX, goalY + 1, goalZ],
        ];
    }

    startPathfind(goals) {
        if (this.pathRequestActive || Pathfinder.isPathing()) return;

        this.pathRequestActive = true;
        this.setState(States.WAITING);
        Pathfinder.resetPath();
        Pathfinder.findPath(goals, () => {
            this.pathRequestActive = false;
            if (!this.enabled) return;
            this.scheduleState(States.DETERMIN, 5);
        });
    }

    clickMenuItem(itemName, nextDelay = 10, nextState = States.DETERMIN) {
        const container = Player.getContainer();
        if (!container) return false;

        for (let i = 0; i < container.getSize(); i++) {
            const item = container.getStackInSlot(i);
            if (!item) continue;

            const name = ChatLib.removeFormatting(String(item.getName())).trim();
            if (!name.includes(itemName)) continue;

            container.click(i, false, 'LEFT');
            this.actionCooldownUntil = Date.now() + nextDelay * 50;
            this.scheduleState(nextState, nextDelay);
            return true;
        }

        return false;
    }

    findNearbyEntity(name, x, y, z, maxDistance = 6) {
        let closestEntity = null;
        let closestDistance = maxDistance;

        for (const entity of World.getAllEntities()) {
            if (ChatLib.removeFormatting(String(entity.getName?.() || '')).trim() !== name) continue;

            const distance = Math.hypot(entity.getX() - x, entity.getY() - y, entity.getZ() - z);
            if (distance >= closestDistance) continue;

            closestDistance = distance;
            closestEntity = entity;
        }

        return closestEntity;
    }

    rotateAndInteract(target, clickType, nextDelay = 10) {
        if (this.rotationPending || Rotations.isRotating || Date.now() < this.actionCooldownUntil) return;

        const entity = this.findNearbyEntity(target.name, target.x, target.y, target.z);
        const aimPoint = entity ? Rotations.getEntityAimPoint(entity) : { x: target.x, y: target.y + 1.0, z: target.z };
        if (!aimPoint) return;

        this.rotationPending = true;
        const token = ++this.rotationToken;

        Rotations.rotateToVector(aimPoint);
        Rotations.onEndRotation(() => {
            if (!this.enabled || this.state !== States.DETERMIN) return;
            if (!this.rotationPending || this.rotationToken !== token) return;

            this.rotationPending = false;

            if (clickType === 'left') Keybind.leftClick();
            else Keybind.rightClick();

            this.actionCooldownUntil = Date.now() + nextDelay * 50;
            this.scheduleState(States.DETERMIN, nextDelay);
        });
    }

    handleDetermin() {
        let closestPoint = null;
        let closestDistance = Infinity;

        for (const point of Points) {
            const distance = Math.hypot(Player.getX() - point.x, Player.getY() - point.y, Player.getZ() - point.z);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestPoint = point.name;
            }
        }

        if (closestPoint == 'Rift Spawn') {
            this.handleRiftSpawn();
        } else if (closestPoint == 'Rift Spawn Exit') {
            this.handleRiftSpawnExit();
        } else if (closestPoint == 'Eye Teleporter') {
            if (Guis.guiName() !== null) {
                this.clickMenuItem(EYE_TELEPORTER.menuItem);
                return;
            }

            this.rotateAndInteract(EYE_TELEPORTER, 'left');
        } else if (closestPoint == 'Mountain Top') {
            this.startPathfind(this.buildPathGoals(BOSS_PATH_WAYPOINT.x, BOSS_PATH_WAYPOINT.y, BOSS_PATH_WAYPOINT.z));
        } else if (closestPoint == 'Boss Path') {
            this.startPathfind(this.buildPathGoals(38, 88, 19));
        } else if (closestPoint == 'Boss Enter') {
            if (Player.getXPLevel() < 240) {
                if (Date.now() < this.actionCooldownUntil) return;
                ChatLib.command('warp wizard');
                this.actionCooldownUntil = Date.now() + 40 * 50;
                this.scheduleState(States.DETERMIN, 40);
                return;
            }

            if (Guis.guiName() !== null) {
                this.clickMenuItem(ORUO.menuItem);
                return;
            }

            this.rotateAndInteract(ORUO, 'right');
        } else if (closestPoint == 'Boss Combat') {
            this.setState(States.COMBAT);
            Keybind.setKey('w', true);
        } else if (closestPoint == 'Hub Tower') {
            this.startPathfind(this.buildPathGoals(HUB_TOWER_WAYPOINT.x, HUB_TOWER_WAYPOINT.y, HUB_TOWER_WAYPOINT.z));
        }
    }

    handleRiftSpawn() {
        if (Player.getY() < 112) {
            this.handleRiftSpawnExit();
            return;
        }

        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        this.pathRequestActive = false;

        const distanceToLadder = Math.hypot(Player.getX() - RIFT_SPAWN_LADDER_WAYPOINT.x, Player.getZ() - RIFT_SPAWN_LADDER_WAYPOINT.z);

        if (distanceToLadder > 0.25) {
            Keybind.setKey('shift', true);
            Keybind.setKey('sprint', false);
            Rotations.rotateToVector(RIFT_SPAWN_LADDER_AIM_POINT);
            Keybind.setKeysForStraightLineCoords(RIFT_SPAWN_LADDER_WAYPOINT.x, RIFT_SPAWN_LADDER_WAYPOINT.y, RIFT_SPAWN_LADDER_WAYPOINT.z, false, true);
            return;
        }

        Keybind.stopMovement();
        Keybind.setKey('shift', false);
        Keybind.setKey('sprint', false);
        if (Rotations.isRotating) Rotations.stopRotation();
    }

    handleRiftSpawnExit() {
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        this.pathRequestActive = false;
        if (Rotations.isRotating) Rotations.stopRotation();

        const distanceToExit = Math.hypot(
            Player.getX() - RIFT_SPAWN_EXIT_WAYPOINT.x,
            Player.getY() - RIFT_SPAWN_EXIT_WAYPOINT.y,
            Player.getZ() - RIFT_SPAWN_EXIT_WAYPOINT.z
        );

        if (distanceToExit > 1) {
            Keybind.setKey('shift', false);
            Keybind.setKey('sprint', false);
            Keybind.setKeysForStraightLineCoords(RIFT_SPAWN_EXIT_WAYPOINT.x, RIFT_SPAWN_EXIT_WAYPOINT.y, RIFT_SPAWN_EXIT_WAYPOINT.z, false, true);
            return;
        }

        Keybind.unpressKeys();
        this.startPathfind(this.buildPathGoals(EYE_TELEPORTER.x, EYE_TELEPORTER.y, EYE_TELEPORTER.z));
    }

    handleCombat() {
        const distanceFromBoss = Math.hypot(
            Player.getX() - SUN_GECKO_COMBAT_ORIGIN.x,
            Player.getY() - SUN_GECKO_COMBAT_ORIGIN.y,
            Player.getZ() - SUN_GECKO_COMBAT_ORIGIN.z
        );

        if (distanceFromBoss > 100) {
            CombatBot.clearExternalTargets();
            if (CombatBot.enabled) {
                CombatBot.toggle(false, true);
            }
            this.setState(States.DETERMIN);
            return;
        }

        const nearbyTerracotta = this.countNearbyBlocks('minecraft:red_terracotta');
        if (nearbyTerracotta > 10 && Date.now() >= this.terracottaClickCooldownUntil) {
            Keybind.rightClick();
            this.terracottaClickCooldownUntil = Date.now() + 5000;
        }

        const mobs = CombatBot.findMob(SUN_GECKO_TARGET_CONFIG);
        CombatBot.setExternalTargets(mobs || []);

        if (!CombatBot.enabled) {
            const holyIceSlot = Guis.findItemInHotbar('Holy Ice');
            if (holyIceSlot !== -1) {
                Guis.setItemSlot(holyIceSlot);
            }
            CombatBot.toggle(true, true);
        }
    }

    getStateName() {
        switch (this.state) {
            case States.WAITING:
                return 'Waiting';
            case States.DETERMIN:
                return 'Determining next step';
            case States.COMBAT:
                return 'Combat';
            default:
                return 'Unknown';
        }
    }

    formatHourlyRate(total) {
        const hours = this.getActiveHours();
        if (hours <= 0) return '0';
        return this.formatNumber(total / hours);
    }

    getActiveHours() {
        const elapsedMs = OverlayManager.getSessionElapsedMs(this.oid);
        if (elapsedMs <= 0) return 0;
        return elapsedMs / 3600000;
    }

    formatNumber(value) {
        if (!Number.isFinite(value)) return '0';
        const rounded = Math.round(value);
        return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    setState(newState) {
        this.state = newState;
    }

    onEnable() {
        this.pathRequestActive = false;
        this.rotationPending = false;
        this.rotationToken = 0;
        this.actionCooldownUntil = 0;
        this.terracottaClickCooldownUntil = 0;
        this.setState(States.DETERMIN);
        Mouse.ungrab();
        Chat.message('&aSunGecko enabled');
    }

    onDisable() {
        this.pathRequestActive = false;
        this.rotationPending = false;
        Keybind.unpressKeys();
        Pathfinder.resetPath();
        Rotations.stopRotation();
        this.terracottaClickCooldownUntil = 0;
        CombatBot.clearExternalTargets();
        if (CombatBot.enabled) CombatBot.toggle(false, true);
        this.state = States.WAITING;
        Mouse.regrab();
        Chat.message('&cSunGecko disabled');
    }
}

new SunGecko();
