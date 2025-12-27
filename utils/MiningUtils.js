import { Chat } from './Chat';
import { Utils } from './Utils';
import { Guis } from './player/Inventory';
import { Keybind } from './player/Keybinding';
import { Flowstate } from './Flowstate';
import { Executor } from './ThreadExecutor';

const BLOCK_HARDNESS_DATA = {
    5: { h: 2000, n: 'Titanium' },
    143: { h: 1500, n: 'Blue Wool Mithril' },
    495: { h: 800, n: 'Prismarine Mithril' },
    496: { h: 800, n: 'Prismarine Brick Mithril' },
    497: { h: 800, n: 'Dark Prismarine Mithril' },
    461: { h: 500, n: 'Cyan Terracotta Mithril' },
    147: { h: 500, n: 'Gray Wool Mithril' },
    524: { h: 6000, n: 'Glacite' },
    268: { h: 5600, n: 'Tungsten Clay' },
    318: { h: 5600, n: 'Tungsten Cobble' },
    464: { h: 5600, n: 'Umber Brown Terracotta' },
    595: { h: 5600, n: 'Umber Smooth Red Sandstone' },
    522: { h: 5600, n: 'Umber Terracotta' },
    479: { h: 5200, n: 'Aquamarine Pane' },
    480: { h: 5200, n: 'Citrine Pane' },
    481: { h: 5200, n: 'Peridot Pane' },
    483: { h: 5200, n: 'Onyx Pane' },
    470: { h: 4800, n: 'Jasper Pane' },
    472: { h: 3800, n: 'Topaz Pane' },
    469: { h: 3000, n: 'Amber Pane' },
    478: { h: 3000, n: 'Amethyst Pane' },
    473: { h: 3000, n: 'Jade Pane' },
    471: { h: 3000, n: 'Sapphire Pane' },
    482: { h: 2300, n: 'Ruby Pane' },
    296: { h: 5200, n: 'Aquamarine Block' },
    297: { h: 5200, n: 'Citrine Block' },
    298: { h: 5200, n: 'Peridot Block' },
    300: { h: 5200, n: 'Onyx Block' },
    287: { h: 4800, n: 'Jasper Block' },
    289: { h: 3800, n: 'Topaz Block' },
    286: { h: 3000, n: 'Amber Block' },
    295: { h: 3000, n: 'Amethyst Block' },
    290: { h: 3000, n: 'Jade Block' },
    288: { h: 3000, n: 'Sapphire Block' },
    299: { h: 2300, n: 'Ruby Block' },
    523: { h: 600, n: 'Coal Ore' },
    173: { h: 600, n: 'Gold Block' },
    174: { h: 600, n: 'Iron Ore' },
    443: { h: 600, n: 'Redstone Ore' },
    372: { h: 600, n: 'Emerald Ore' },
    192: { h: 600, n: 'Diamond Ore' },
    446: { h: 600, n: 'Quartz Ore' },
};

const TOOL_PRIORITY_LIST = [
    { match: 'Gauntlet', priority: 5, fuel: true },
    { match: 'Drill', priority: 5, fuel: true },
    { match: 'Pickonimbus', priority: 3, fuel: false },
    { match: 'Eon Pickaxe', priority: 2, fuel: false },
    { match: 'Chrono Pickaxe', priority: 2, fuel: false },
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
            Player.setHeldItemIndex(toolData.slot);
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
            this.collectedData.professional = this.extractNumericFromSlot(12, /\+(\d+)/);

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

            this.collectedData.strongarm = this.extractNumericFromSlot(21, /\+(\d+)/);
            this.collectedData.coldres = this.extractNumericFromSlot(23, /\+(\d+)/);

            let explorerLevel = this.extractNumericFromSlot(42, /\+(\d+)/);
            this.collectedData.maxge = parseInt(explorerLevel) >= 96;

            Guis.closeInv();
            this.finishCollection();
        } catch (e) {
            Chat.message('error collecting stats: ' + e);
            Chat.log('Stats Collector Error: ' + e);
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
                let cleanLine = ChatLib.removeFormatting(String(lore[i]));
                let match = cleanLine.match(pattern);
                if (match) {
                    let value = match[1].replace(/,/g, '');
                    return value.indexOf('.') !== -1 ? parseFloat(value) : parseInt(value);
                }
            }
        } catch (e) {
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
register('command', () => {
    Executor.execute(() => {
        miningStatsCollector.beginCollection();
    });
}).setName('getminingstats');

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
            Chat.message('§cNo stats saved! Use /getminingstats');
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

        let blockId = block.type.getID();
        let data = BLOCK_HARDNESS_DATA[blockId];
        let hardness = data ? data.h : 100;

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
    refuel(callback) {
        let self = this;

        new Thread(function () {
            try {
                let abiphoneSlot = Guis.findItemInHotbar('Abiphone');
                if (abiphoneSlot === -1) {
                    Chat.message('Abiphone not found!');
                    return callback(false);
                }

                Player.setHeldItemIndex(abiphoneSlot);
                Thread.sleep(250);
                Keybind.rightClick();
                Thread.sleep(1000);

                if (!Guis.guiName() || Guis.guiName().indexOf('Abiphone') === -1) {
                    Chat.message('Abiphone failed to open!');
                    return callback(false);
                }

                let jotraelineSlot = Guis.findFirst(Player.getContainer(), 'Jotraeline Greatforge');
                if (jotraelineSlot === -1) {
                    Chat.message('Jotraeline contact missing!');
                    return callback(false);
                }

                Guis.clickSlot(jotraelineSlot);
                Thread.sleep(1000);

                if (!self.waitForAnvil()) {
                    Chat.message('drill anvil timeout!');
                    return callback(false);
                }

                Thread.sleep(1000);
                let tool = ToolFinder.findBest();
                if (!tool) {
                    Chat.message('no drill found!');
                    return callback(false);
                }

                Guis.clickSlot(tool.slot + 81, true);
                Thread.sleep(500);

                let container = Player.getContainer();
                if (!container.getStackInSlot(29)) {
                    Chat.message('drill not in anvil!');
                    return callback(false);
                }

                let fuelAdded = Guis.clickItems(['Volta', 'Oil Barrel', 'Biofuel'], true);
                if (!fuelAdded) {
                    Chat.message('no fuel available!');
                    Guis.clickSlot(29, true);
                    Thread.sleep(500);
                    Guis.closeInv();
                    return callback(false);
                }

                Thread.sleep(500);
                Guis.clickSlot(22, false);
                Thread.sleep(750);
                Guis.clickSlot(13, true);
                Thread.sleep(500);
                Guis.closeInv();

                callback(true);
            } catch (e) {
                Chat.message('refuel error: ' + e.message);
                callback(false);
            }
        }).start();
    }

    waitForAnvil() {
        let waited = 0;
        while (Guis.guiName() !== 'Drill Anvil' && waited < 5000) {
            Thread.sleep(50);
            waited = waited + 50;
        }
        return waited < 5000;
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

            let Blocks = net.minecraft.block.Blocks;
            let blockPos = new net.minecraft.util.math.BlockPos(x, y, z);
            Client.getMinecraft().world.setBlockState(blockPos, Blocks.AIR.getDefaultState());
        } catch (e) {
            Chat.message('error setting ghost block');
        }
    }
}

const speedCalc = new SpeedCalculations(miningStatsCollector);
const timeCalc = new MineTimeCalculations(miningStatsCollector);
const refueler = new RefuelService();
const explorer = new ExplorerUpgrade(miningStatsCollector);

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
