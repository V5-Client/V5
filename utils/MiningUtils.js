import { Chat } from './Chat';
import { Utils } from './Utils';
import { Guis } from './player/Inventory';
import { Keybind } from './player/Keybinding';
import { Flowstate } from './Flowstate';
import { Executor } from './ThreadExecutor';
import { Blocks, BP } from './Constants';
import { v5Command } from './V5Commands';
import { findAndFollowPath, stopPathing } from './pathfinder/PathAPI';
import { Rotations } from './player/Rotations';
import { DRILL_MECHANIC_LOCATION } from '../modules/mining/CommissionData';

const BLOCK_HARDNESS_DATA = {
    'minecraft:polished_diorite': { hardness: 2000, name: 'Titanium' },
    'minecraft:light_blue_wool': { hardness: 1500, name: 'Blue Mithril' },
    'minecraft:prismarine': { hardness: 800, name: 'Prismarine Mithril' },
    'minecraft:prismarine_bricks': { hardness: 800, name: 'Prismarine Mithril' },
    'minecraft:dark_prismarine': { hardness: 800, name: 'Prismarine Mithril' },
    'minecraft:cyan_terracotta': { hardness: 500, name: 'Gray Mithril' },
    'minecraft:gray_wool': { hardness: 500, name: 'Gray Mithril' },
    'minecraft:packed_ice': { hardness: 6000, name: 'Glacite' },
    'minecraft:clay': { hardness: 5600, name: 'Tungsten Clay' },
    'minecraft:infested_cobblestone': { hardness: 5600, name: 'Tungsten Cobble' },
    'minecraft:brown_terracotta': { hardness: 5600, name: 'Umber Brown Terracotta' },
    'minecraft:smooth_red_sandstone': { hardness: 5600, name: 'Umber Smooth Red Sandstone' },
    'minecraft:terracotta': { hardness: 5600, name: 'Umber Terracotta' },
    'minecraft:blue_stained_glass_pane': { hardness: 5200, name: 'Aquamarine Pane' },
    'minecraft:brown_stained_glass_pane': { hardness: 5200, name: 'Citrine Pane' },
    'minecraft:lime_stained_glass_pane': { hardness: 5200, name: 'Peridot Pane' },
    'minecraft:black_stained_glass_pane': { hardness: 5200, name: 'Onyx Pane' },
    'minecraft:pink_stained_glass_pane': { hardness: 4800, name: 'Jasper Pane' },
    'minecraft:yellow_stained_glass_pane': { hardness: 3800, name: 'Topaz Pane' },
    'minecraft:orange_stained_glass_pane': { hardness: 3000, name: 'Amber Pane' },
    'minecraft:purple_stained_glass_pane': { hardness: 3000, name: 'Amethyst Pane' },
    'minecraft:green_stained_glass_pane': { hardness: 3000, name: 'Jade Pane' },
    'minecraft:light_blue_stained_glass_pane': { hardness: 3000, name: 'Sapphire Pane' },
    'minecraft:red_stained_glass_pane': { hardness: 2300, name: 'Ruby Pane' },
    'minecraft:blue_stained_glass': { hardness: 5200, name: 'Aquamarine Block' },
    'minecraft:brown_stained_glass': { hardness: 5200, name: 'Citrine Block' },
    'minecraft:lime_stained_glass': { hardness: 5200, name: 'Peridot Block' },
    'minecraft:black_stained_glass': { hardness: 5200, name: 'Onyx Block' },
    'minecraft:pink_stained_glass': { hardness: 4800, name: 'Jasper Block' },
    'minecraft:yellow_stained_glass': { hardness: 3800, name: 'Topaz Block' },
    'minecraft:orange_stained_glass': { hardness: 3000, name: 'Amber Block' },
    'minecraft:purple_stained_glass': { hardness: 3000, name: 'Amethyst Block' },
    'minecraft:green_stained_glass': { hardness: 3000, name: 'Jade Block' },
    'minecraft:light_blue_stained_glass': { hardness: 3000, name: 'Sapphire Block' },
    'minecraft:red_stained_glass': { hardness: 2300, name: 'Ruby Block' },
    'minecraft:coal_block': { hardness: 600, name: 'Coal Block' },
    'minecraft:gold_block': { hardness: 600, name: 'Gold Block' },
    'minecraft:iron_block': { hardness: 600, name: 'Iron Block' },
    'minecraft:redstone_block': { hardness: 600, name: 'Redstone Block' },
    'minecraft:emerald_block': { hardness: 600, name: 'Emerald Block' },
    'minecraft:diamond_block': { hardness: 600, name: 'Diamond Block' },
    'minecraft:quartz_block': { hardness: 600, name: 'Quartz Block' },
};

function lookupBlock(registryName) {
    if (!registryName) return null;
    const data = BLOCK_HARDNESS_DATA[registryName];
    if (!data) return null;
    return data;
}

const TOOL_PRIORITY_LIST = [
    { match: 'Gauntlet', priority: 5, fuel: true },
    { match: 'Drill', priority: 5, fuel: true },
    { match: 'Pickonimbus', priority: 3, fuel: false },
    { match: 'Eon Pickaxe', priority: 2, fuel: false },
    { match: 'Chrono Pickaxe', priority: 2, fuel: false },
    { match: 'Jungle Pickaxe', priority: 2, fuel: false },
    { match: 'Titanium Pickaxe', priority: 1, fuel: false },
    { match: 'Mithril Pickaxe', priority: 1, fuel: false },
];

class MiningStatsCollector {
    constructor() {
        this.stats = Utils.getConfigFile('miningstats.json') || {};
        this.isCollecting = false;
        this.statsFile = 'miningstats.json';
        this.collectedData = {};
    }

    beginCollection() {
        if (this.isCollecting) {
            Chat.message('Already collecting stats. Wait a moment.');
            return;
        }

        let toolData = ToolFinder.findBest();
        if (!toolData) {
            Chat.message('No mining tool found!');
            return;
        }

        this.isCollecting = true;
        try {
            Guis.setItemSlot(toolData.slot);
            Thread.sleep(500);

            ChatLib.command('stats');
            if (!this.waitForGui('Your Equipment and Stats')) return this.timeout();
            if (!this.waitForItem('Mining Stats')) return this.timeout();
            Thread.sleep(100);
            this.collectedData = {};
            this.collectedData.speed = this.extractNumericFromSlot(15, /Mining\s+Speed[:\s]*([\d,]+)/i);

            ChatLib.command('hotm');
            if (!this.waitForGui('Heart of the Mountain')) return this.timeout();
            if (!this.waitForItem('Tier 5')) return this.timeout();
            Thread.sleep(100);

            this.collectedData.cotm = this.extractNumericFromSlot(4, /Level[:\s]*(\d+)/i);
            this.collectedData.professional = this.extractNumericFromSlot(12, /\+(\d+(\.\d+)?)/);

            let container = Player.getContainer();
            let activeMarker = 'minecraft:emerald_block';
            let ability = 'None';
            if (this.checkSlotForBlock(container, 29, activeMarker)) ability = 'SpeedBoost';
            else if (this.checkSlotForBlock(container, 33, activeMarker)) ability = 'Pickobulus';

            Guis.clickSlot(8, false, 'RIGHT');
            if (!this.waitForItem('Tier 10')) return this.timeout();
            if (ability === 'None') {
                container = Player.getContainer();
                if (this.checkSlotForBlock(container, 1, activeMarker)) ability = 'GemstoneInfusion';
                else if (this.checkSlotForBlock(container, 7, activeMarker)) ability = 'SheerForce';
                else if (this.checkSlotForBlock(container, 37, activeMarker)) ability = 'AnomalousDesire';
                else if (this.checkSlotForBlock(container, 43, activeMarker)) ability = 'ManiacMiner';
            }
            this.collectedData.ability = ability;

            this.collectedData.strongarm = this.extractNumericFromSlot(21, /\+(\d+(\.\d+)?)/);
            this.collectedData.coldres = this.extractNumericFromSlot(23, /\+(\d+(\.\d+)?)/);

            let explorerLevel = this.extractNumericFromSlot(42, /\+(\d+(\.\d+)?)/);
            this.collectedData.maxge = parseInt(explorerLevel) >= 96;

            Guis.closeInv();
            this.finishCollection();
        } catch (e) {
            Chat.message('Error collecting stats: ' + e);
            console.error('V5 Caught error' + e + e.stack);
        } finally {
            this.isCollecting = false;
        }
    }

    waitForGui(name, timeoutMs = 4000) {
        let waited = 0;
        while (waited < timeoutMs) {
            let current = Guis.guiName();
            if (current && current.includes(name)) return true;
            Thread.sleep(50);
            waited += 50;
        }
        return false;
    }

    waitForItem(itemName, timeoutMs = 4000) {
        let waited = 0;
        while (waited < timeoutMs) {
            let inventory = Player.getContainer();
            if (Guis.findFirst(inventory, itemName) != -1) return true;
            Thread.sleep(50);
            waited += 50;
        }
        return false;
    }

    timeout() {
        Chat.message('Failed to get mining stats.');
        Guis.closeInv();
        this.isCollecting = false;
        return false;
    }

    finishCollection() {
        let heldItem = Player.getHeldItem();
        if (heldItem) {
            let fullLore = heldItem.getLore().join(' ');
            let lapMatch = fullLore.match(/lapidary\s+(i{1,3}|iv|v)/i);

            if (lapMatch) {
                let levels = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
                let levelText = lapMatch[1].toUpperCase();
                let bonus = (levels[levelText] || 0) * 20;
                this.collectedData.lapidary = bonus;
            }
        }

        this.saveAndDisplay();
    }

    saveAndDisplay() {
        let finalStats = {
            speed: this.collectedData.speed || 0,
            professional: this.collectedData.professional || 0,
            lapidary: this.collectedData.lapidary || 0,
            strongarm: this.collectedData.strongarm || 0,
            ability: this.collectedData.ability || 'None',
            coldres: this.collectedData.coldres || 0,
            cotm: this.collectedData.cotm || 0,
            maxge: this.collectedData.maxge || false,
        };

        Utils.writeConfigFile(this.statsFile, finalStats);
        this.stats = finalStats;

        Chat.message('Speed: &6' + finalStats.speed + ' Mining Speed');
        Chat.message('Lapidary: &6+' + finalStats.lapidary + ' Mining Speed');
        Chat.message('Professional: &6+' + finalStats.professional + ' Mining Speed');
        Chat.message('Strong Arm: &6+' + finalStats.strongarm + ' Mining Speed');
        Chat.message('Ability: &e' + finalStats.ability);
        Chat.message('Cold Resistance: &b' + finalStats.coldres);
        Chat.message('COTM Level: &e' + finalStats.cotm);
        Chat.message('Max Great Explorer: ' + (finalStats.maxge ? '&aYes' : '&cNo'));
    }

    extractNumericFromSlot(slot, pattern) {
        try {
            let container = Player.getContainer();
            let item = container?.getStackInSlot(slot);
            if (!item) return 0;

            if (item.type?.getRegistryName?.() === 'minecraft:coal') {
                return 0;
            }

            let lore = item.getLore();
            for (var i = 0; i < lore.length; i++) {
                // Chat.message(lore[i])
                let cleanLine = ChatLib.removeFormatting(String(lore[i]));
                let match = cleanLine.match(pattern);
                if (match) {
                    let value = match[1].replace(/,/g, '');
                    return value.indexOf('.') !== -1 ? parseFloat(value) : parseInt(value);
                }
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return 0;
        }
        return 0;
    }

    checkSlotForBlock(container, slot, blockId) {
        let item = container?.getStackInSlot(slot);
        return item && item.type?.getRegistryName() === blockId;
    }

    getStoredStats() {
        return this.stats;
    }
}

const miningStatsCollector = new MiningStatsCollector();

v5Command('getminingstats', () => {
    Executor.execute(() => {
        miningStatsCollector.beginCollection();
    });
});

class ToolFinder {
    static findBest() {
        let inventory = Player.getInventory();
        if (!inventory) return null;

        let foundTools = [];

        for (var slot = 0; slot <= 7; slot++) {
            let item = inventory.getStackInSlot(slot);
            if (!item) continue;

            let itemName = ChatLib.removeFormatting(item.getName());
            let toolInfo = this.matchTool(itemName);

            if (toolInfo) {
                let hasCheese = this.checkBlueCheese(item);
                foundTools.push({
                    item: item,
                    slot: slot,
                    priority: toolInfo.priority + (hasCheese ? 10 : 0),
                    needsFuel: toolInfo.fuel,
                    blueCheese: hasCheese,
                });
            }
        }

        if (foundTools.length === 0) return null;

        foundTools.sort(function (a, b) {
            return b.priority - a.priority;
        });

        return foundTools[0];
    }

    static matchTool(name) {
        for (var i = 0; i < TOOL_PRIORITY_LIST.length; i++) {
            if (name.indexOf(TOOL_PRIORITY_LIST[i].match) !== -1) {
                return TOOL_PRIORITY_LIST[i];
            }
        }
        return null;
    }

    static checkBlueCheese(item) {
        try {
            let lore = item.getLore();
            for (var i = 0; i < lore.length; i++) {
                let clean = ChatLib.removeFormatting(String(lore[i]));
                if (clean.indexOf('Blue Cheese') !== -1) {
                    return true;
                }
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return false;
        }
        return false;
    }
}

class SpeedCalculations {
    constructor(collector) {
        this.collector = collector;
        this.lastCalculated = null;
    }

    getBaseSpeed(area) {
        let stats = this.collector.getStoredStats();
        if (!stats || !stats.speed) {
            console.error('No stats saved!');
            return null;
        }

        let targetArea = area || Utils.area();
        let base = stats.speed;

        if (targetArea === 'Crystal Hollows' && stats.professional) {
            base = base + stats.professional;
        }

        let flowBonus = Flowstate.CurrentFlowstate ? Flowstate.CurrentFlowstate() : 0;
        this.lastCalculated = base + flowBonus;

        return this.lastCalculated;
    }

    getSpeedWithColdPenalty() {
        let base = this.lastCalculated || this.getBaseSpeed();
        if (!base) return null;

        let stats = this.collector.getStoredStats();
        let resistance = stats?.coldres || 0;
        let currentCold = ScoreboardDebuffReader.readCold();

        let penalty = Math.max(0, currentCold - resistance);
        if (penalty === 0) return base;

        let reduction = Math.min(100, penalty / 2);
        return Math.round(base * (1 - reduction / 100));
    }
}

class MineTimeCalculations {
    constructor(collector) {
        this.collector = collector;
    }

    calculateTicks(position, speed, boosted) {
        if (!position || typeof position !== 'object') {
            return this.clamp(100);
        }

        const x = position.x ?? (typeof position.getX === 'function' ? position.getX() : null);
        const y = position.y ?? (typeof position.getY === 'function' ? position.getY() : null);
        const z = position.z ?? (typeof position.getZ === 'function' ? position.getZ() : null);

        if (x === null || y === null || z === null) {
            return this.clamp(100);
        }

        let block = World.getBlockAt(x, y, z);
        if (!block || !block.type) {
            return this.clamp(100);
        }

        let blockName = block?.type?.getRegistryName();
        if (!blockName) {
            return this.clamp(100);
        }
        let data = BLOCK_HARDNESS_DATA[blockName];
        let hardness = data ? data.hardness : 20000;

        let effectiveSpeed = speed + (Flowstate.CurrentFlowstate ? Flowstate.CurrentFlowstate() : 0);

        if (boosted) {
            let stats = this.collector.getStoredStats();
            let multiplier = (stats?.cotm || 0) >= 2 ? 3.5 : 3.0;
            effectiveSpeed = effectiveSpeed * multiplier;
        }

        let rawTicks = (hardness * 30) / effectiveSpeed;
        return this.clamp(Math.round(rawTicks));
    }

    clamp(ticks) {
        return Math.max(4, ticks || 4);
    }
}

class RefuelService {
    constructor() {
        this.STATES = {
            IDLE: 0,
            FIND_ABIPHONE: 1,
            OPEN_ABIPHONE: 2,
            SELECT_CONTACT: 3,
            CLICK_CONTACT: 4,
            WAIT_FOR_ANVIL: 5,
            WAIT_ANVIL_READY: 6,
            ADD_FUEL: 7,
            CONFIRM_FUEL: 8,
            TAKE_TOOL: 9,
            CLOSE: 10,
            FAIL_CLEANUP: 11,
            WALK_TO_MECHANIC: 12,
            ROTATE_TO_MECHANIC: 13,
        };

        this.reset();
        register('tick', () => this.tick());
    }

    reset() {
        this.state = this.STATES.IDLE;
        this.waitTicks = 0;
        this.timeoutTicks = null;
        this.callback = null;
        this.contactSlot = -1;
        this.npcRotationToken = 0;
        this.npcRotationPending = false;
        this.isPathing = false;
    }

    setState(nextState, waitTicks = 0, timeoutTicks = null) {
        this.state = nextState;
        this.waitTicks = waitTicks;
        this.timeoutTicks = timeoutTicks;
    }

    refuel(callback) {
        if (this.state !== this.STATES.IDLE) {
            Chat.message('Refuel already running!');
            if (callback) callback(false);
            return;
        }

        if (callback) this.callback = callback;
        this.setState(this.STATES.FIND_ABIPHONE);
    }

    tick() {
        if (this.state === this.STATES.IDLE) return;

        if (this.waitTicks > 0) {
            this.waitTicks--;
            return;
        }

        switch (this.state) {
            case this.STATES.FIND_ABIPHONE:
                let abiphoneSlot = Guis.findItemInInventory('Abiphone');
                if (abiphoneSlot === -1) {
                    Chat.message('Abiphone not found. Walking to Drill Mechanic...');
                    this.setState(this.STATES.WALK_TO_MECHANIC);
                    break;
                }

                ChatLib.command('call Jotraeline Greatforge');
                this.setState(this.STATES.WAIT_FOR_ANVIL, 20, 200);
                break;

            case this.STATES.WAIT_FOR_ANVIL:
                if (Guis.guiName() === 'Drill Anvil') {
                    this.setState(this.STATES.WAIT_ANVIL_READY, 20);
                    break;
                }

                if (this.handleTimeout('Anvil never opened?!')) return;
                break;

            case this.STATES.WAIT_ANVIL_READY:
                let tool = ToolFinder.findBest();
                if (!tool) return this.fail('No drill found!');

                Guis.clickSlot(tool.slot + 81, true);
                this.setState(this.STATES.ADD_FUEL, 15);
                break;

            case this.STATES.ADD_FUEL:
                if (!Guis.clickItems(['Volta', 'Oil Barrel', 'Biofuel', 'Sunflower Oil', 'Goblin Egg'], true)) {
                    Chat.message('No fuel detected!'); // fuel buyer when?
                    this.setState(this.STATES.FAIL_CLEANUP, 15);
                    return;
                }

                this.setState(this.STATES.CONFIRM_FUEL, 15);
                break;

            case this.STATES.CONFIRM_FUEL:
                Guis.clickSlot(22, false);
                this.setState(this.STATES.TAKE_TOOL, 15);
                break;

            case this.STATES.TAKE_TOOL:
                Guis.clickSlot(13, true);
                this.setState(this.STATES.CLOSE, 15);
                break;

            case this.STATES.CLOSE:
                Guis.closeInv();
                this.finish(true);
                break;

            case this.STATES.FAIL_CLEANUP:
                Guis.closeInv();
                this.finish(false);
                break;

            case this.STATES.WALK_TO_MECHANIC:
                const dist = Math.hypot(
                    Player.getX() - DRILL_MECHANIC_LOCATION[0],
                    Player.getY() - DRILL_MECHANIC_LOCATION[1],
                    Player.getZ() - DRILL_MECHANIC_LOCATION[2]
                );

                if (dist < 3.5) {
                    stopPathing();
                    this.isPathing = false;
                    this.setState(this.STATES.ROTATE_TO_MECHANIC);
                    return;
                }

                if (!this.isPathing) {
                    this.isPathing = true;
                    findAndFollowPath(
                        [Math.floor(Player.getX()), Math.round(Player.getY()) - 1, Math.floor(Player.getZ())],
                        [DRILL_MECHANIC_LOCATION],
                        (success) => {
                            this.isPathing = false;
                            if (!success) {
                                this.fail('Failed to path to Drill Mechanic.');
                            }
                        }
                    );
                }
                break;

            case this.STATES.ROTATE_TO_MECHANIC:
                const mechanicHead = [DRILL_MECHANIC_LOCATION[0] + 0.5, DRILL_MECHANIC_LOCATION[1] + 2.2, DRILL_MECHANIC_LOCATION[2] + 0.5];

                if (!this.npcRotationPending && !Rotations.isRotating) {
                    this.npcRotationPending = true;
                    const token = ++this.npcRotationToken;
                    Rotations.rotateToVector(mechanicHead);
                    Rotations.onEndRotation(() => {
                        if (!this.npcRotationPending || this.npcRotationToken !== token) return;
                        this.npcRotationPending = false;
                        Keybind.rightClick();
                        this.setState(this.STATES.WAIT_FOR_ANVIL, 10, 200);
                    });
                }
                break;
        }
    }

    handleTimeout(message) {
        this.timeoutTicks--;
        if (this.timeoutTicks <= 0) {
            this.fail(message);
            return true;
        }

        return false;
    }

    fail(message) {
        if (message) Chat.message(message);
        this.finish(false);
    }

    finish(success) {
        const cb = this.callback;
        this.reset();
        if (cb) cb(success);
    }
}

class ExplorerUpgrade {
    constructor(collector) {
        this.collector = collector;
    }

    upgrade(callback) {
        let self = this;

        new Thread(function () {
            let stats = self.collector.getStoredStats();

            if (stats?.maxge) {
                Chat.message('Great Explorer already maxed!');
                return callback(true);
            }

            if (stats?.maxge === undefined) {
                Chat.message('Run /getminingstats first!');
                return callback(false);
            }

            let chatWatcher = register('chat', function (event) {
                let msg = event.message.getString();

                if (msg.indexOf('You must first unlock') !== -1) {
                    Thread.sleep(300);
                    Chat.message("great explorer can't be unlocked!");
                    Guis.closeInv();
                    chatWatcher.unregister();
                    return callback(false);
                }

                if (msg.indexOf("You don't have enough Gemstone Powder!") !== -1) {
                    Thread.sleep(300);
                    Chat.message('insufficient powder!');
                    Guis.closeInv();
                    chatWatcher.unregister();
                    return callback(false);
                }
            });

            ChatLib.command('hotm');
            Thread.sleep(1000);

            if (Guis.guiName() !== 'Heart of the Mountain') {
                Chat.message('HOTM failed to open!');
                chatWatcher.unregister();
                return callback(false);
            }

            Guis.clickSlot(8, false, 'RIGHT');
            Thread.sleep(1000);

            while (Guis.guiName() === 'Heart of the Mountain') {
                Thread.sleep(500);

                let slot = Player.getContainer()?.getStackInSlot(42);
                if (!slot) continue;

                let nbtString = slot.getNBT().toString();

                if (nbtString.indexOf('item.minecraft.coal') !== -1) {
                    Guis.clickSlot(42, false);
                } else if (nbtString.indexOf('item.minecraft.emerald') !== -1) {
                    Guis.clickSlot(42, true);
                } else {
                    break;
                }
            }

            chatWatcher.unregister();
            callback(true);
        }).start();
    }
}

class ScoreboardDebuffReader {
    static readCold() {
        return this.readDebuff('❄');
    }

    static readHeat() {
        return this.readDebuff('♨');
    }

    static readDebuff(symbol) {
        let lines = Scoreboard.getLines();

        for (var i = 0; i < lines.length; i++) {
            let lineText = String(lines[i]);
            if (lineText.indexOf(symbol) !== -1) {
                let clean = ChatLib.removeFormatting(lineText);
                let pattern = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + symbol);
                let match = clean.match(pattern);

                if (match) {
                    return parseFloat(match[1]);
                }
            }
        }

        return 0;
    }
}

class CommissionParser {
    static parse() {
        try {
            let tabNames = TabList.getNames();
            let startIdx = this.findIndex(tabNames, 'Commissions:');

            if (startIdx === -1) return [];

            let endIdx = this.findIndex(tabNames, 'Powders:', startIdx + 1);
            if (endIdx === -1) endIdx = tabNames.length;

            return this.extractCommissionData(tabNames, startIdx + 1, endIdx);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return [];
        }
    }

    static findIndex(items, target, start) {
        start = start || 0;
        for (var i = start; i < items.length; i++) {
            let cleaned = ChatLib.removeFormatting(items[i] || '').trim();
            if (cleaned === target) return i;
        }
        return -1;
    }

    static extractCommissionData(items, start, end) {
        let commissions = [];

        for (var i = start; i < end; i++) {
            let text = ChatLib.removeFormatting(items[i] || '').trim();
            if (text.indexOf(':') === -1) continue;

            let parts = text.split(':');
            let name = parts[0].trim();
            let progressText = parts[1].trim();
            let progress;

            if (progressText.indexOf('DONE') !== -1) {
                progress = 1;
            } else if (progressText.indexOf('%') !== -1) {
                progress = parseFloat(progressText.replace(/ /g, '').replace('%', '')) / 100;
            } else {
                continue;
            }

            commissions.push({ name: name, progress: progress });
        }

        return commissions;
    }
}

class BlockUtils {
    static setToAir(pos) {
        if (!pos) return;
        try {
            const x = pos.x ?? (typeof pos.getX === 'function' ? pos.getX() : null);
            const y = pos.y ?? (typeof pos.getY === 'function' ? pos.getY() : null);
            const z = pos.z ?? (typeof pos.getZ === 'function' ? pos.getZ() : null);

            if (x === null || y === null || z === null) return;

            let blockPos = new BP(x, y, z);
            Client.getMinecraft().world.setBlockState(blockPos, Blocks.AIR.getDefaultState());
        } catch (e) {
            Chat.message('error setting ghost block');
            console.error('V5 Caught error' + e + e.stack);
        }
    }
}

const speedCalc = new SpeedCalculations(miningStatsCollector);
const timeCalc = new MineTimeCalculations(miningStatsCollector);
const refueler = new RefuelService();
const explorer = new ExplorerUpgrade(miningStatsCollector);

v5Command('refueldrill', () => {
    refueler.refuel((success) => {
        if (success) {
            Chat.message('Refueling completed');
        } else {
            Chat.message('Refueling failed');
        }
    });
});

export const MiningUtils = {
    getMiningSpeed: function (area) {
        return speedCalc.getBaseSpeed(area);
    },
    getSpeedWithCold: function () {
        return speedCalc.getSpeedWithColdPenalty();
    },
    getMineTime: function (pos, speed, boost) {
        return timeCalc.calculateTicks(pos, speed, boost);
    },
    getBlockInfo: function (registryName) {
        return lookupBlock(registryName);
    },
    getDrills: function () {
        let bestTool = ToolFinder.findBest();
        if (!bestTool) {
            return { blueCheese: null, drill: null };
        }
        return {
            blueCheese: bestTool.blueCheese ? bestTool : null,
            drill: bestTool,
        };
    },
    doRefueling: function (isComm, callback) {
        refueler.refuel(callback);
    },
    MaxGreatExplorer: function (callback) {
        explorer.upgrade(callback);
    },
    inCamp: function () {
        return Player.getZ() > 185 && Utils.area() === 'Dwarven Mines';
    },
    getDebuff: function (type) {
        return type.toLowerCase() === 'cold' ? ScoreboardDebuffReader.readCold() : ScoreboardDebuffReader.readHeat();
    },
    GhostBlock: function (pos) {
        BlockUtils.setToAir(pos);
    },
    readCommissions: function () {
        return CommissionParser.parse();
    },
};

v5Command('maxge', () => {
    MiningUtils.MaxGreatExplorer((success) => {
        if (success) {
            Chat.message('Great Explorer upgrade completed');
        } else {
            Chat.message('Great Explorer upgrade failed');
        }
    });
});
