import { Chat } from '../../Utility/Chat';
import { findAndFollowPath, stopPathing } from '../../Pathfinding2.0/PathAPI';
import { COMMISSION_DATA } from './CommissionData';
import { registerEventSB } from '../../Utility/SkyblockEvents';
import { MiningBot } from './MiningBot';
import { MiningUtils } from '../../Utility/MiningUtils';
import { Guis } from '../../Utility/Inventory';
import { Keybind } from '../../Utility/Keybinding';
import { RotationRedo } from '../../Utility/RotationsTest';
import { ModuleBase } from '../../Utility/ModuleBase';

// TODO
// ROTATION CALLBACKS FOR NPC CLICK
// SLAYER COMMISSIONS
// USE MULTIPLE END POINTS FOR EMISSARRY PATHFINDING

const STATES = {
    IDLE: 'Idle',
    CHOOSING: 'Choosing Commission',
    TRAVELING: 'Traveling to Location',
    WAITING_FOR_SPOT: 'Waiting for Spot',
    MINING: 'Mining',
    SLAYER: 'Killing Mobs',
    SELLING: 'Selling Items',
    REFUELING: 'Refueling Drill',
    CLAIMING: 'Claiming Rewards',
    SWAPPING_PICK: 'Swapping Pickonimbus',
};

const EMISSARY_LOCATIONS = [
    [129, 195, 196],
    [42, 134, 22],
    [171, 149, 31],
    [-73, 152, -11],
    [-133, 173, -51],
    [-38, 199, -132],
    [89, 197, -93],
    [58, 197, -9],
];

const TRASH_ITEMS = ['Mithril', 'Titanium', 'Rune', 'Glacite', 'Goblin', 'Cobblestone', 'Stone'];

const MOB_CONFIGS = {
    goblin: {
        names: ['Goblin', 'Weakling'],
        checkVisibility: true,
        boundaryCheck: (x, y, z) => y > 127 && !(z > 153 && x < -157) && !(z < 148 && x > -77),
    },
    icewalker: {
        names: ['Ice Walker', 'Glacite Walker'],
        checkVisibility: true,
        boundaryCheck: (x, y, z) => y >= 127 && y <= 132 && z <= 180 && z >= 147 && x <= 42,
    },
    treasure: {
        names: ['Treasuer Hunter'], // MISSPELLED ON PURPOSE (Hypixel typo)
        checkVisibility: false,
        boundaryCheck: (x, y, z) => y >= 200 && y <= 210,
    },
};

class CommissionMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Commission Macro',
            subcategory: 'Mining',
            description: 'Completes Commissions for you',
            tooltip: 'Completes Commissions for you (Dwarven). Use /startcommission and /stopcommission',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
        });

        this.bindToggleKey();
        this.currentState = STATES.IDLE;
        this.playerAvoidanceRadius = 10;
        this.goblinWeaponSlot = 1;
        this.swapPickaxeStep = 0;
        this.pauseTicks = 0;

        this.commissions = [];
        this.currentCommission = null;
        this.currentMobType = null;
        this.mobWhitelist = new Set();
        this.savedState = null;
        this.awaitingTabUpdate = false;
        this.travelPurpose = null;
        this.pathfinding = false;

        this.drill = null;
        this.blueCheese = null; // unused rn
        this.pickaxe = null;
        this.weapon = null;
        this.miningSpeed = 0;
        this.currentMiningWaypoint = null;

        this.on('step', () => this.readCommissions()).setDelay(1);
        this.on('tick', () => this.runLogic());

        this.on('chat', (event) => {
            const msg = event.message.getUnformattedText();
            if (msg?.includes('Commission Complete! Visit the King to claim')) {
                this.onCommissionComplete();
            }
        });

        registerEventSB('fullinventory', () => {
            if (this.enabled && this.currentState === STATES.MINING) this.onInventoryFull();
        });

        registerEventSB('emptydrill', () => {
            if (this.enabled && this.currentState === STATES.MINING) this.onDrillEmpty();
        });

        registerEventSB('death', () => {
            if (this.enabled) {
                Chat.message('&cYou died! Stopping macro...');
                this.toggle(false);
            }
        });

        this.addSlider(
            'Player Avoidance Radius',
            0,
            200,
            10,
            (value) => {
                this.playerAvoidanceRadius = value;
            },
            'How close another player can be to a mining spot before it is considered occupied.'
        );

        this.addSlider(
            'Weapon Slot (Goblin)',
            1,
            8,
            1,
            (value) => {
                this.goblinWeaponSlot = value;
            },
            'Hotbar slot with weapon for Goblin Slayer (1-8)'
        );
    }

    onEnable() {
        Chat.message('&aCommission Macro Enabled.');
        const drills = MiningUtils.getDrills();
        this.drill = drills.drill;
        this.pickaxe = this.drill;
        this.blueCheese = drills.blueCheese; // unused rn

        if (!this.drill) {
            Chat.message('&cNo drill found in hotbar!');
            this.toggle(false);
            return;
        }

        this.weapon = this.getWeaponFromSlot();
        if (!this.weapon) {
            Chat.message('&eNo weapon found in Goblin Slayer slot. Goblin commissions will be skipped.');
        }

        this.miningSpeed = MiningUtils.getMiningSpeed('Dwarven Mines');
        if (!this.miningSpeed) {
            Chat.message('&cNo mining speed saved! Run /getminingstats');
            this.toggle(false);
            return;
        }

        this.resetState();
    }

    onDisable() {
        Chat.message('&cCommission Macro Disabled.');
        MiningBot.toggle(false);
        stopPathing();
    }

    resetState() {
        this.currentState = STATES.IDLE;
        this.commissions = [];
        this.currentCommission = null;
        this.currentMobType = null;
        this.mobWhitelist.clear();
        this.savedState = null;
        this.travelPurpose = null;
        this.pauseTicks = 0;
        this.awaitingTabUpdate = false;
        this.pathfinding = false;
    }

    setState(newState) {
        if (this.currentState !== newState) {
            Chat.message(`&aCommission Macro: &eChanging state to ${newState}`);
            this.currentState = newState;
        }
    }

    runLogic() {
        if (this.pauseTicks > 0) {
            this.pauseTicks--;
            return;
        }

        // Route logic to state handlers
        if (this.currentState === STATES.IDLE) this.handleIdle();
        else if (this.currentState === STATES.CHOOSING) this.handleChoosing();
        else if (this.currentState === STATES.SLAYER) this.handleSlayer();
        else if (this.currentState === STATES.SELLING) this.handleSelling();
        else if (this.currentState === STATES.CLAIMING) this.handleClaiming();
    }

    handleIdle() {
        this.setState(STATES.CHOOSING);
    }

    handleChoosing() {
        this.readCommissions();
        if (this.awaitingTabUpdate) return;

        const hasCompleted = this.commissions.some((c) => c.progress === 1);
        if (hasCompleted) {
            this.onCommissionComplete();
            return;
        }

        const activeCommissions = this.commissions.filter((c) => c.progress < 1);
        if (activeCommissions.length === 0) {
            Chat.message('No commissions detected.');
            Chat.message('Ensure commissions are enabled in /tab');
            this.toggle(false);
            return;
        }

        const supportedTasks = this.getSupportedTasks(activeCommissions);
        if (supportedTasks.length === 0) {
            Chat.message('&eNo supported commissions available.');
            this.toggle(false);
            return;
        }

        const otherPlayers = this.getOtherPlayers();
        const chosenCommission = this.findAvailableCommission(supportedTasks, otherPlayers);

        if (chosenCommission) {
            this.startCommission(chosenCommission);
        } else {
            this.handleNoAvailableSpots(supportedTasks);
        }
    }

    getSupportedTasks(activeCommissions) {
        return activeCommissions
            .map((tabComm) => {
                const data = COMMISSION_DATA.find((d) => d.names.includes(tabComm.name));
                return data ? { ...tabComm, ...data } : null;
            })
            .filter((task) => task && task.type === 'MINING' && (!task.name.includes('Goblin') || this.weapon))
            .sort((a, b) => a.cost - b.cost);
    }

    getOtherPlayers() {
        if (this.playerAvoidanceRadius <= 0) return [];
        return World.getAllPlayers().filter((p) => p.getName() !== Player.getName());
    }

    findAvailableCommission(supportedTasks, otherPlayers) {
        for (const task of supportedTasks) {
            const safeWaypoints = this.getSafeWaypoints(task.waypoints, otherPlayers);
            if (safeWaypoints.length > 0) {
                const closestWaypoint = this.getClosestWaypoint(safeWaypoints);
                return { task, waypoint: closestWaypoint };
            }
        }
        return null;
    }

    getSafeWaypoints(waypoints, otherPlayers) {
        if (this.playerAvoidanceRadius <= 0) return waypoints;

        return waypoints.filter((waypoint) => {
            return !otherPlayers.some((player) => {
                const distance = this.getDistance(player.getX(), player.getY(), player.getZ(), ...waypoint);
                return distance < this.playerAvoidanceRadius;
            });
        });
    }

    getClosestWaypoint(waypoints) {
        const playerPos = { x: Player.getX(), y: Player.getY(), z: Player.getZ() };
        return waypoints.reduce((closest, current) => {
            const closestDist = this.getDistance(playerPos.x, playerPos.y, playerPos.z, ...closest);
            const currentDist = this.getDistance(playerPos.x, playerPos.y, playerPos.z, ...current);
            return currentDist < closestDist ? current : closest;
        });
    }

    startCommission(chosenCommission) {
        const { task, waypoint } = chosenCommission;
        this.currentCommission = task;
        this.travelPurpose = task.type;
        this.currentMiningWaypoint = waypoint;

        Chat.message(`&aStarting commission: &b${task.name}&a. Pathing to: &b[${waypoint.join(', ')}]`);

        this.setState(STATES.TRAVELING);
        findAndFollowPath(
            [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())],
            waypoint,
            false,
            () => this.onPathComplete(),
            () => this.onPathFail()
        );
    }

    handleNoAvailableSpots(supportedTasks) {
        const commissionNames = supportedTasks.map((t) => t.name).join('&7, &b');
        Chat.message(`&cAll spots occupied for: &b${commissionNames}&c. Waiting...`);
    }

    handleSlayer() {
        if (!this.currentMobType) return;

        const mobs = this.findMob(this.currentMobType);
        if (mobs.length === 0) return;

        const closest = this.getClosestMob(mobs);
        // TODO: Implement rotation, movement, and attacking
        // Pretty much the same as the original 1.8.9 ig
    }

    handleSelling() {
        // COMPLETELY UNTESTED :)
        if (Guis.guiName() !== 'Trades') {
            ChatLib.command('trades');
            this.delay(10);
            return;
        }

        const soldItem = this.sellNextTrashItem();
        if (soldItem) return;

        // No more items to sell
        Guis.closeInv();
        this.restoreStateAfterSelling();
    }

    sellNextTrashItem() {
        const container = Player.getContainer();
        const items = container.getItems();

        for (let i = 54; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;

            const name = ChatLib.removeFormatting(item.getName());
            const isTrash = TRASH_ITEMS.some((trash) => name.includes(trash));
            const isNotEquipment = !name.includes('Drill') && !name.includes('Pickaxe') && !name.includes('Minecart');

            if (isTrash && isNotEquipment) {
                Guis.clickSlot(i, false);
                return true;
            }
        }
        return false;
    }

    restoreStateAfterSelling() {
        if (this.savedState) {
            this.setState(this.savedState);
            if (this.savedState === STATES.MINING) this.startMining();
            this.savedState = null;
        } else {
            this.setState(STATES.CHOOSING);
        }
    }

    handleClaiming() {
        if (Guis.guiName() === 'Commissions') {
            this.claimCompletedCommissions();
            return;
        }

        const pigeonSlot = Guis.findItemInHotbar('Royal Pigeon');
        if (pigeonSlot !== -1) {
            this.useRoyalPigeon(pigeonSlot);
        } else {
            this.travelToEmissary();
        }
    }

    claimCompletedCommissions() {
        const Commissions = Player.getContainer();
        for (let i = 9; i < 17; i++) {
            const stack = Commissions.getStackInSlot(i);
            if (!stack) continue;

            const hasCompleted = stack.getLore().some((line) => line.toString().includes('COMPLETED'));
            if (hasCompleted) {
                Guis.clickSlot(i, false);
                this.delay(10);
                return;
            }
        }

        Guis.closeInv();
        this.delay(10); // Delay so it doesn't pathfind inside gui BANDAID, FIX IN ROTATIONS
        this.setState(STATES.CHOOSING);
    }

    useRoyalPigeon(pigeonSlot) {
        if (Player.getHeldItemIndex() != pigeonSlot) {
            Guis.setItemSlot(pigeonSlot);
        } else {
            Keybind.rightClick();
        }
    }

    travelToEmissary() {
        const playerPos = [Player.getX(), Player.getY(), Player.getZ()];
        const closest = this.getClosestEmissary(playerPos);
        const closestDist = this.getDistance(...playerPos, ...closest);

        if (closestDist < 4) {
            this.interactWithEmissary(closest);
        } else {
            this.pathToEmissary(closest);
        }
    }

    getClosestEmissary(playerPos) {
        let closest = EMISSARY_LOCATIONS[0];
        let closestDist = this.getDistance(...playerPos, ...closest);

        for (let i = 1; i < EMISSARY_LOCATIONS.length; i++) {
            const current = EMISSARY_LOCATIONS[i];
            const currentDist = this.getDistance(...playerPos, ...current);
            if (currentDist < closestDist) {
                closest = current;
                closestDist = currentDist;
            }
        }
        return closest;
    }

    interactWithEmissary(target) {
        const adjustedTarget = [target[0] + 0.5, target[1] + 2.2, target[2] + 0.5];
        if (RotationRedo.isRotating) return;

        RotationRedo.rotateToVector(adjustedTarget);
        RotationRedo.onEndRotation(() => {
            Keybind.rightClick();
            this.delay(10);
        });
    }

    pathToEmissary(closest) {
        if (this.pathfinding) return;

        this.pathfinding = true;
        this.travelPurpose = 'EMISSARY';
        findAndFollowPath(
            [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())],
            closest,
            false,
            () => (this.pathfinding = false)
        );
    }

    delay(ticks) {
        this.pauseTicks = Math.max(0, Math.floor(Number(ticks) || 0));
    }

    getDistance(x1, y1, z1, x2, y2, z2) {
        return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
    }

    onPathComplete() {
        if (!this.enabled) return;

        if (this.travelPurpose === 'EMISSARY') {
            this.travelPurpose = null;
            this.setState(STATES.CLAIMING);
            return;
        }

        Chat.message(`&aArrived at destination for &b${this.currentCommission?.name || 'Unknown'}`);

        const type = this.currentCommission?.type;
        if (type === 'MINING') {
            this.setState(STATES.MINING);
            this.startMining();
        } else if (type === 'SLAYER') {
            this.setState(STATES.SLAYER);
            this.startSlayer();
        } else {
            this.setState(STATES.IDLE);
        }
    }

    onPathFail() {
        if (!this.enabled) return;
        Chat.message(`&cFailed to find a path for &b${this.currentCommission?.name || 'Unknown'}. Retrying...`);
        this.currentCommission = null;
        this.setState(STATES.IDLE);
    }

    startMining() {
        if (!this.drill) {
            Chat.message('&cERROR: No drill found!');
            this.toggle(false);
            return;
        }

        Guis.setItemSlot(this.drill.slot);

        MiningBot.setCost(MiningBot.mithrilCosts);
        MiningBot.toggle(true);
    }

    startSlayer() {
        const name = this.currentCommission.name;
        let mobType;

        if (name === 'Goblin Slayer') {
            mobType = 'goblin';
            Guis.setItemSlot(this.weapon.slot);
        } else if (
            name === 'Glacite Walker Slayer' ||
            name === 'Treasure Hoarder Puncher' // apparently treasure hoarder takes more damage from pickaxe
        ) {
            mobType = name === 'Glacite Walker Slayer' ? 'icewalker' : 'treasure';
            Guis.setItemSlot(this.pickaxe.slot);
        } else {
            Chat.message('&cUnknown slayer commission type!');
            this.toggle(false);
            return;
        }

        this.currentMobType = mobType;
    }

    onCommissionComplete() {
        Chat.message('&aCommission complete detected!');
        stopPathing();
        MiningBot.toggle(false);
        this.awaitingTabUpdate = true;
        this.setState(STATES.CLAIMING);
    }

    onInventoryFull() {
        Chat.message('&eInventory full! Selling items...');
        MiningBot.toggle(false);
        this.savedState = this.currentState;
        this.setState(STATES.SELLING);
    }

    onDrillEmpty() {
        Chat.message('&eDrill empty! Refueling...');
        MiningBot.toggle(false);
        this.setState(STATES.REFUELING);

        MiningUtils.doRefueling(true, (success) => {
            if (!success) {
                Chat.message('&cRefueling failed! No fuel found.');
                this.toggle(false);
                return;
            }

            Chat.message('&aRefueling successful!');
            const drills = MiningUtils.getDrills();
            this.drill = drills.drill;
            this.blueCheese = drills.blueCheese; // unused rn
            this.setState(STATES.IDLE);
        });
    }

    getWeaponFromSlot() {
        const slot = this.goblinWeaponSlot - 1;
        const item = Player.getInventory().getStackInSlot(slot);
        if (!item) return null;

        const name = ChatLib.removeFormatting(item.getName());
        if (name.includes('Mithril') || name.includes('Titanium') || name === '') return null;

        return { slot, name };
    }

    getClosestMob(mobs) {
        return mobs.reduce((closest, current) => {
            const closestDist = this.getDistance(Player.getX(), Player.getY(), Player.getZ(), closest.getX(), closest.getY(), closest.getZ());
            const currentDist = this.getDistance(Player.getX(), Player.getY(), Player.getZ(), current.getX(), current.getY(), current.getZ());
            return currentDist < closestDist ? current : closest;
        }, mobs[0]);
    }

    readCommissions() {
        try {
            const tabItems = TabList.getNames();
            const startIndex = this.findCommissionsStartIndex(tabItems);
            if (startIndex === -1) {
                if (this.commissions.length > 0) this.commissions = [];
                return;
            }

            const endIndex = this.findCommissionsEndIndex(tabItems, startIndex);
            const newCommissions = this.parseCommissions(tabItems, startIndex, endIndex);

            this.updateCommissionsIfChanged(newCommissions);
        } catch (e) {
            Chat.message('&cError reading commissions: ' + e);
            console.error('Error reading commissions:', e);
            this.commissions = [];
        }
    }

    findCommissionsStartIndex(tabItems) {
        for (let i = 0; i < tabItems.length; i++) {
            const cleaned = ChatLib.removeFormatting(tabItems[i] ?? '').trim();
            if (cleaned === 'Commissions:') {
                return i;
            }
        }
        return -1;
    }

    findCommissionsEndIndex(tabItems, startIndex) {
        for (let i = startIndex + 1; i < tabItems.length; i++) {
            const cleaned = ChatLib.removeFormatting(tabItems[i] ?? '').trim();
            if (cleaned === '' || cleaned === 'Powders:') {
                return i;
            }
        }
        return tabItems.length;
    }

    parseCommissions(tabItems, startIndex, endIndex) {
        const commissions = [];
        for (let i = startIndex + 1; i < endIndex; i++) {
            const formattedText = ChatLib.removeFormatting(tabItems[i] ?? '').trim();
            if (!formattedText.includes(':')) continue;

            const commission = this.parseCommissionLine(formattedText);
            if (commission) commissions.push(commission);
        }
        return commissions;
    }

    parseCommissionLine(formattedText) {
        const parts = formattedText.split(':');
        const name = parts[0].trim();
        const progressStr = parts[1].trim();
        let progress;

        if (progressStr.includes('DONE')) {
            progress = 1;
        } else if (progressStr.includes('%')) {
            progress = parseFloat(progressStr.replace(/ /g, '').replace('%', '')) / 100;
        } else {
            return null;
        }

        return { name, progress };
    }

    updateCommissionsIfChanged(newCommissions) {
        if (JSON.stringify(this.commissions) === JSON.stringify(newCommissions)) return;

        this.commissions = newCommissions;

        Chat.message('&a--- Commissions Updated ---');
        this.commissions.forEach((c) => {
            Chat.message(`&7- &f${c.name}: &b${c.progress === 1 ? 'DONE' : (c.progress * 100).toFixed(0) + '%'}`);
        });

        if (this.awaitingTabUpdate) {
            const stillCompleted = this.commissions.some((c) => c.progress === 1);
            if (!stillCompleted) this.awaitingTabUpdate = false;
        }
    }

    /**
     * Finds mobs
     *
     * Usage:
     *   findMob('goblin')     - Returns array of Goblins and Weaklings
     *   findMob('icewalker')  - Returns array of Ice Walkers/Glacite Walkers
     *   findMob('treasure')   - Returns array of Treasure Hunters
     *
     * @param {string} type - The type of mob to find ('goblin', 'icewalker', 'treasure')
     * @returns {Array<PlayerMP>} - Array of found mobs
     */
    findMob(type) {
        const config = MOB_CONFIGS[type.toLowerCase()];
        if (!config) {
            console.error(`Unknown mob type: ${type}`);
            return [];
        }
        return this.getMobs(config);
    }

    getMobs(config) {
        const mobs = [];
        const playerMP = config.checkVisibility ? Player.asPlayerMP() : null;

        World.getAllPlayers().forEach((player) => {
            try {
                const nameObj = player.getName();
                if (!nameObj) return;

                const name = ChatLib.removeFormatting(nameObj);
                const uuid = player.getUUID();

                if (this.mobWhitelist.has(uuid)) return;
                if (!config.names.some((mobName) => name.includes(mobName))) return;
                if (player.isSpectator() || player.isInvisible() || player.isDead()) return;
                if (config.checkVisibility && !playerMP.canSeeEntity(player)) return;

                const x = player.getX(),
                    y = player.getY(),
                    z = player.getZ();
                if (!config.boundaryCheck(x, y, z)) return;

                mobs.push(player);
            } catch (e) {
                // Skip invalid entities
            }
        });

        return mobs;
    }
}

new CommissionMacro();
