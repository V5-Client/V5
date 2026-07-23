import { isDeveloperModeEnabled } from '../../utils/DeveloperModeState';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import { Utils } from '../../utils/Utils';
import { manager } from '../../utils/SkyblockEvents';
import { MiningUtils } from '../../utils/MiningUtils';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Rotations } from '../../utils/player/Rotations';

//todo
// find the best possible place to pathfind to
// chest click when digging down
// lane switch
// better pane detection both back and forth
// its not done dont use

class ScathaMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Scatha Macro',
            subcategory: 'Mining',
            developerMode: true,
            description: 'Automatically mines and kills Scappas for you',
            tooltip: 'Automatically mines and kills Scappas for you',
            theme: '#5a7cbb',
            isMacro: true,
        });

        this.MAGICFIND_SET = 0;
        this.MINING_SET = 0;
        this.SPREAD_SET = 0;
        this.CLICK_DELAY = 0;

        this.addSlider(
            'Magic Find set slot',
            1,
            9,
            1,
            (value) => {
                this.MAGICFIND_SET = value;
            },
            'The slot in your wardrobe that has your magic find set'
        );

        this.addSlider(
            'Mining set slot',
            1,
            9,
            1,
            (value) => {
                this.MINING_SET = value;
            },
            'The slot in your wardrobe that has your mining set'
        );

        this.addSlider(
            'Mineral set slot',
            1,
            9,
            1,
            (value) => {
                this.SPREAD_SET = value;
            },
            'The slot in your wardrobe that has your mineral set'
        );

        this.addSlider(
            'Click delay',
            0,
            1000,
            500,
            (value) => {
                this.CLICK_DELAY = value;
            },
            'The delay between clicks'
        );

        this.isWarping = false;
        this.travelledToCH = false;
        this.goingToCH = false;
        this.items = { aspect: null, drill: null };
        this.triedPath = false;
        this.handleAOTV = { rotated: false, usedAOTV: false };
        this.HOTMState = { opened: false };
        this.lastActionTime = 0;

        this.CHBounds = {
            minX: 202,
            maxX: 823,
        };

        this.bindToggleKey();

        this.STATES = {
            WAITING: 0,
            WARPING: 1,
            DIGGING: 2,
            PREPARE: 3,
            DECIDEDIRECTION: 4,
            MINING: 5,
        };

        this.state = this.STATES.WAITING;

        manager.subscribe('warp', () => {
            if (!this.enabled) return;
            this.isWarping = true;
        });

        this.on('chat', (event) => {
            if (!this.enabled) return;
            const msg = event.message.getUnformattedText();
            const lower = (msg || '').toLowerCase();

            if (lower.includes("you haven't unlocked this fast travel destination") && this.goingToCH) {
                this.message("&cCan't start macro outside CH because you dont have the warp!");
                this.toggle(false);
                return;
            }
        });

        this.on('tick', () => {
            if (!this.enabled) return;
            if (!Player.getPlayer()) return;
            switch (this.state) {
                case this.STATES.WARPING:
                    this.handleWarping();
                    break;
                case this.STATES.DIGGING:
                    this.handleDigging();
                    break;
                case this.STATES.PREPARE:
                    this.handlePrepare();
                    break;
                case this.STATES.DECIDEDIRECTION:
                    this.handleDirection();
                    break;
                case this.STATES.MINING:
                    this.handleMining();
                    break;
            }
        });
    }

    handleWarping() {
        if (Utils.area() === 'Crystal Hollows') return (this.state = this.STATES.DIGGING);
        if (this.isWarping && this.travelledToCH) return (this.goingToCH = true);

        if (Utils.area() !== 'Crystal Hollows' && !this.travelledToCH) {
            ChatLib.command('warp ch');
            this.travelledToCH = true;
        }
    }

    handleDigging() {
        if (!this.triedPath) {
            //hardcoded point dont shout at me yes yes blah blah
            Pathfinder.findPath([[503, 84, 223]], (success) => {
                if (success) return (this.state = this.STATES.DIGGING);

                // go hub and rewarp and shit
                this.message('&cPath not found!');
                this.toggle(false);
            });

            this.triedPath = true;
            this.state = this.STATES.WAITING;
            return;
        }

        if (!this.handleAOTV.rotated) {
            this.handleAOTV.rotated = true;

            Guis.setItemSlot(this.items.aspect);

            Rotations.lookAtAngles(Player.getYaw(), 90);
            Rotations.onComplete(() => {
                Client.rightClick();
                this.handleAOTV.usedAOTV = true;
            });
        }

        if (!this.handleAOTV.usedAOTV) return;

        Guis.setItemSlot(this.items.drill);
        Client.setKey('leftclick', true);

        // check for chests

        if (Math.floor(Player.getY()) === 31) this.state = this.STATES.PREPARE;
    }

    handlePrepare() {
        if (!this.HOTMState.completed) {
            if (this.togglePerks(false)) {
                this.HOTMState = { opened: false, completed: true };
                this.lastActionTime = Date.now();
                ChatLib.command('wardrobe');
            }
            return;
        }

        if (this.applySet(this.MINING_SET)) {
            Guis.closeInv();
            this.state = this.STATES.DECIDEDIRECTION;
            return;
        }
    }

    handleDirection() {
        const pX = Player.getX();

        const distWest = Math.abs(pX - this.CHBounds.minX); // x: 202
        const distEast = Math.abs(pX - this.CHBounds.maxX); // x: 823

        let angle = distEast < distWest ? -90 : 90;

        Rotations.lookAtAngles(angle, 35);
        Rotations.onComplete(() => (this.state = this.STATES.MINING));

        this.state = this.STATES.WAITING;
    }

    handleMining() {
        let looking = Player.lookingAt();

        let currentPitch = 35;

        if (this.isInPane()) currentPitch = 60;

        Rotations.lookAtAngles(Player.getYaw(), currentPitch);

        if (looking instanceof Block) {
            let blockId = looking?.type?.getRegistryName();
            if (blockId?.includes('bedrock')) return Client.setKey('leftclick', false);
        }

        Client.setKey('leftclick', true);
        Client.setKey('w', true);
    }

    isInPane() {
        let player = Player.getPlayer();
        let currentBlock = World.getBlockAt(player.x, player.y, player.z);
        let id = currentBlock?.type?.getRegistryName();

        return !!(id?.includes('pane') || id?.includes('glass'));
    }

    togglePerks(isEnabling) {
        const container = Player.getContainer();

        if (Guis.guiName() !== 'Heart of the Mountain' || !container) {
            if (!this.HOTMState.opened) {
                ChatLib.command('hotm');
                this.HOTMState.opened = true;
                this.lastActionTime = Date.now();
            }
            return;
        }

        const now = Date.now();
        if (now - this.lastActionTime < this.CLICK_DELAY) return;

        const ignoreID = 'minecraft:redstone_block';
        const isPageOne = container.getStackInSlot(0)?.getName()?.includes('Tier 5');

        const currentSlots = isPageOne ? [13, 22, 8] : [42, 40];

        for (let slot of currentSlots) {
            const item = container.getStackInSlot(slot);
            if (!item) continue;

            if (slot === 8) {
                Guis.clickSlot(slot, false, 'RIGHT');
                this.lastActionTime = now;
                return false;
            }

            const itemID = item.type.getRegistryName().toString();
            const isRedstone = itemID === ignoreID;
            const shouldClick = isEnabling ? isRedstone : !isRedstone;

            if (shouldClick) {
                Guis.clickSlot(slot, false, 'RIGHT');
                this.lastActionTime = now;
                return false;
            }
        }

        if (!isPageOne) {
            this.HOTMState.opened = false;
            return true;
        }

        return false;
    }

    applySet(slot) {
        if (Guis.guiName() !== 'Wardrobe (1/3)') return false;

        const now = Date.now();
        if (now - this.lastActionTime < this.CLICK_DELAY) return false;

        const targetSlot = slot + 35;

        const container = Player.getContainer();
        if (!container) return false;

        const item = container.getStackInSlot(targetSlot);
        if (!item) return false;

        const itemID = item.type.getRegistryName().toString();

        if (itemID.includes('lime_dye')) {
            this.lastActionTime = now;
            return true;
        }

        Guis.clickSlot(targetSlot, false, 'LEFT');
        this.lastActionTime = now;
        return true;
    }

    getAllRequiredItems() {
        const items = {
            'Aspect of the Void': { slot: Guis.findItemInHotbar('Aspect of the Void'), include: true },
            'Mining Tool': { slot: MiningUtils.getDrills().drill?.slot ?? -1, include: null },
        };

        this.items.aspect = items['Aspect of the Void'].slot;
        this.items.drill = items['Mining Tool'].slot;
        const missingItems = Object.keys(items).filter((itemName) => items[itemName].slot === -1);

        if (missingItems.length > 0) {
            this.message('Missing required items: ' + missingItems.join(', '));
            this.toggle(false);
            return null;
        }

        return items;
    }

    hasMaxGE() {
        if (Utils.getConfigFile('miningstats.json')?.maxge !== true) {
            this.message("&cYou don't have max GE!");
            this.toggle(false);
            return false;
        }

        return true;
    }

    handleAllRequirements() {
        return !!this.getAllRequiredItems() && this.hasMaxGE();
    }

    onEnable() {
        this.message('&aEnabled');
        if (!this.handleAllRequirements()) return;
        this.state = this.STATES.WARPING;
        this.triedPath = false;
    }

    onDisable() {
        this.message('&cDisabled');
        this.state = this.STATES.WAITING;

        this.isWarping = false;
        this.travelledToCH = false;
        this.goingToCH = false;

        this.items = { aspect: null, drill: null };

        this.triedPath = false;

        this.handleAOTV = { rotated: false, usedAOTV: false };
        this.HOTMState = { opened: false };

        this.lastActionTime = 0;
        Pathfinder.resetPath();
        Rotations.stop();
        Client.stopMovement();
        Client.setKey('leftclick', false);
    }
}

if (isDeveloperModeEnabled()) new ScathaMacro();
