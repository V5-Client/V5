import { ModuleBase } from '../../utils/ModuleBase';
import { MacroState } from '../../utils/MacroState';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Rotations } from '../../utils/player/Rotations';
import { Utils } from '../../utils/Utils';

const STATES = Object.freeze({
    WAITING: 0,
    OPENING: 1,
    SETUP: 2,
    EXCAVATING: 3,
    AUTO_COMBINING: 4,
    REFILLING_SCRAP: 5,
    WAITING_FOR_AREA: 6,
    CLEARING_SCRAP: 7,
    RETRIEVING_CHISEL: 8,
});

const NPC_POS = [19, 120, 226];
const NPC_LOOK_POS = [19, 121, 226];

const SAX_GUI_TIMEOUT        = 200;
const GUI_OPEN_TIMEOUT       = 200;
const GFS_TIMEOUT            = 200;
const PICKUPSTASH_TIMEOUT    = 5; // Changed to 5 ticks for faster check
const GUI_CLOSE_BUFFER       = 20;
const UNEXPECTED_CLOSE_TICKS = 100;
const AUTO_COMBINE_WATCHDOG  = 6000;

class ExcavatorMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Excavator Macro',
            subcategory: 'Mining',
            description: 'Automatically gets glacite powder from the Fossil Excavator using suspicious scrap.',
            tooltip: 'Glacite Powder Macro',
            theme: '#c4682b',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: false,
            isMacro: true,
            ignoreFailsafes: true,
        });

        this.bindToggleKey();

        this.NODELAY = false;
        this.TICKDELAY = 5;

        this.addToggle('No delay', (v) => { this.NODELAY = v; }, 'Ignores tick delay and clicks as soon as possible');
        this.addSlider('Tick delay', 1, 10, 5, (v) => { this.TICKDELAY = v; }, 'Amount of ticks until the player can click again');

        this._resetState();

        this.createOverlay([{
            title: 'Status',
            data: { State: () => Object.keys(STATES).find((key) => STATES[key] === this.state) ?? 'Unknown' },
        }]);

        this.on('tick', () => this._tick());

        this.on('chat', (message) => {
            if (!this.enabled) return;

            if (this.state === STATES.REFILLING_SCRAP && message.includes('You have no Suspicious Scrap in your Sacks!')) {
                this.message('&cNo Suspicious Scrap in sacks. Disabling macro.');
                this.toggle(false);
                return;
            }

            if (this.state === STATES.RETRIEVING_CHISEL && message.includes("Your stash isn't holding any items or materials!")) {
                this.message('&cChisel not in stash. Disabling macro.');
                this.toggle(false);
            }
        });
    }

    // --- STATE ---

    _resetState() {
        this.state = STATES.OPENING;
        this.inExcavator = false;
        this.tickCount = 0;
        this.blacklistedSlots = new Map();
        // gui open wait
        this.guiOpenWaitTicks = 0;
        // refill
        this.refillCommandSent = false;
        this.refillDelayTicks = 0;
        this.guiClosedTicks = 0;
        this.autoCombineDone = false;
        // auto combine watchdog
        this.autoCombineWatchdog = 0;
        // chisel recovery
        this.saxCommandSent = false;
        this.saxGuiOpenTicks = 0;
        this.saxGuiCloseTicks = 0;
        this.chiselCommandSent = false;
        this.chiselRetrieveDelayTicks = 0;
        this.chiselRetrieveCloseTicks = 0;
        this.chiselAutoCombinePending = false;
        this.chiselMissingTicks = 0; // Grace period timer
        // travel
        this.warpCooldownTicks = 0;
        this.warpDelayTicks = 0;
        this.guiCloseWaitTicks = 0;
    }

    // --- TICK LOOP ---

    _tick() {
        this._updateBlacklist();

        // Update Chisel Timer (20 ticks = 1 second)
        if (this._hasPerfectChisel()) {
            this.chiselMissingTicks = 0;
        } else {
            this.chiselMissingTicks++;
        }

        if (this._handleAutoTravel()) return;
        if (this._checkUnexpectedClose()) return;

        switch (this.state) {
            case STATES.WAITING_FOR_AREA:
                if (this.guiCloseWaitTicks-- <= 0) {
                    this.message('&cExcavator GUI closed manually. Disabling macro.');
                    this.toggle(false);
                }
                break;

            case STATES.OPENING:
                if (!this._hasPerfectChisel()) {
                    // Wait for 300 ticks (15 seconds) before assuming the chisel is actually missing
                    if (this.chiselMissingTicks < 300) return;

                    this.message('&eChisel missing for 15s. Clearing scrap and retrieving from stash.');
                    this.saxCommandSent = false;
                    this.saxGuiOpenTicks = 0;
                    this.saxGuiCloseTicks = 0;
                    this.state = STATES.CLEARING_SCRAP;
                    return;
                }

                if (Player.lookingAt() instanceof Entity && !this.inExcavator) {
                    Keybind.rightClick();
                    this.guiOpenWaitTicks = GUI_OPEN_TIMEOUT;
                    this.state = STATES.SETUP;
                } else if (!Rotations.isRotating) {
                    Rotations.rotateToVector(NPC_LOOK_POS);
                }
                break;

            case STATES.SETUP: {
                if (Guis.guiName() !== 'Fossil Excavator') {
                    if (this.guiOpenWaitTicks-- <= 0) {
                        this.inExcavator = false;
                        this.state = STATES.OPENING;
                    }
                    return;
                }
                this.inExcavator = true;

                if (!this._hasSuspiciousScrap() && !this.autoCombineDone) {
                    this._handleNoScrap();
                    return;
                }

                if (this._clickDelay()) {
                    const clickedStart = this._clickItem('Start Excavator', true, 'MIDDLE');
                    
                    // Only transition if we successfully clicked start, OR if the game is already running
                    if (clickedStart || this._isGameStarted()) {
                        this.state = STATES.EXCAVATING;
                    }
                }
                break;
            }

            case STATES.EXCAVATING: {
                if (Guis.guiName() !== 'Fossil Excavator') return;
                const container = Player.getContainer();
                if (container) this._processExcavatorGui(container);
                break;
            }

            case STATES.AUTO_COMBINING:
                if (this.autoCombineWatchdog-- <= 0) {
                    this.message('&cAuto Combine timed out. Disabling macro.');
                    this.toggle(false);
                    return;
                }

                if (this._getAutoCombineModule()?.enabled) return;
                this.refillCommandSent = false;
                this.refillDelayTicks = 0;

                if (this.chiselAutoCombinePending) {
                    this.chiselAutoCombinePending = false;
                    this.chiselCommandSent = false;
                    this.chiselRetrieveDelayTicks = 0;
                    this.state = STATES.RETRIEVING_CHISEL;
                } else {
                    this.autoCombineDone = true;
                    this.state = STATES.REFILLING_SCRAP;
                }
                break;

            case STATES.REFILLING_SCRAP:
                if (Player.getContainer()) {
                    Guis.closeInv();
                    this.guiClosedTicks = GUI_CLOSE_BUFFER;
                    return;
                }

                if (this.guiClosedTicks > 0) {
                    this.guiClosedTicks--;
                    return;
                }

                if (!this.refillCommandSent) {
                    ChatLib.command('gfs SUSPICIOUS_SCRAP 2240');
                    this.refillCommandSent = true;
                    this.refillDelayTicks = GFS_TIMEOUT;
                    return;
                }

                if (this._hasSuspiciousScrap() || this.refillDelayTicks-- <= 0) {
                    this._resumeExcavatorLoop();
                }
                break;

            case STATES.CLEARING_SCRAP: {
                const guiName = Guis.guiName();

                if (!guiName) {
                    if (this.saxGuiCloseTicks > 0) {
                        this.saxGuiCloseTicks--;
                        return;
                    }

                    if (!this.saxCommandSent) {
                        ChatLib.command('sax');
                        this.saxCommandSent = true;
                        this.saxGuiOpenTicks = SAX_GUI_TIMEOUT;
                        return;
                    }

                    if (this.saxGuiOpenTicks-- <= 0) {
                        this.message('&cSack of Sacks GUI failed to open. Disabling macro.');
                        this.toggle(false);
                    }
                    return;
                }

                if (guiName === 'Sack of Sacks' && this._clickDelay()) {
                    const clicked = this._clickItem('Insert Inventory', false, 'LEFT', true);
                    if (clicked) {
                        Guis.closeInv();
                        this.saxCommandSent = false;
                        this.saxGuiOpenTicks = 0;
                        this.saxGuiCloseTicks = GUI_CLOSE_BUFFER;
                        this.chiselCommandSent = false;
                        this.chiselRetrieveDelayTicks = 0;
                        this.chiselRetrieveCloseTicks = 0;
                        this.state = STATES.RETRIEVING_CHISEL;
                    }
                }
                break;
            }

            case STATES.RETRIEVING_CHISEL:
                if (Player.getContainer()) {
                    Guis.closeInv();
                    this.chiselRetrieveCloseTicks = GUI_CLOSE_BUFFER;
                    return;
                }

                if (this.chiselRetrieveCloseTicks > 0) {
                    this.chiselRetrieveCloseTicks--;
                    return;
                }

                if (!this.chiselCommandSent) {
                    ChatLib.command('pickupstash');
                    this.chiselCommandSent = true;
                    this.chiselRetrieveDelayTicks = PICKUPSTASH_TIMEOUT;
                    return;
                }

                if (this.chiselRetrieveDelayTicks-- > 0) return;

                if (this._hasPerfectChisel()) {
                    this.chiselCommandSent = false;
                    this.chiselRetrieveCloseTicks = 0;
                    this.chiselAutoCombinePending = false;
                    this.state = STATES.OPENING;
                    return;
                }

                // Chisel not found — run Auto Combine to clear books from inventory, then try pickupstash again
                this.chiselCommandSent = false;
                this.chiselRetrieveDelayTicks = 0;
                this.chiselAutoCombinePending = true;
                this.autoCombineWatchdog = AUTO_COMBINE_WATCHDOG;

                const autoCombine = this._getAutoCombineModule();
                if (autoCombine && !autoCombine.enabled) autoCombine.toggle(true, true);

                this.state = STATES.AUTO_COMBINING;
                break;
        }
    }

    // --- CORE LOGIC ---

    _processExcavatorGui(container) {
        const brownSlots = [];

        for (let i = 0; i < 54; i++) {
            if (this.blacklistedSlots.has(i)) continue;

            const itemName = container.getStackInSlot(i)?.type?.getRegistryName();
            if (!itemName) continue;

            if (itemName.includes('black_stained')) {
                this.state = STATES.SETUP;
                return;
            }

            if (itemName.includes('yellow_stained')) {
                Guis.closeInv();
                this.inExcavator = false;
                this.state = STATES.OPENING;
                return;
            }

            if (itemName.includes('lime_stained')) {
                if (this._clickDelay()) {
                    Guis.clickSlot(i);
                    this._blacklistSlot(i, 10);
                }
                return;
            }

            if (itemName.includes('brown_stained')) {
                brownSlots.push(i);
            }
        }

        if (brownSlots.length > 0 && this._clickDelay()) {
            const slot = brownSlots[Math.floor(Math.random() * brownSlots.length)];
            Guis.clickSlot(slot);
            this._blacklistSlot(slot, 10);
        }
    }

    _handleAutoTravel() {
        const area = Utils.area();
        const subArea = Utils.subArea();
        const needsWarp = area !== 'Dwarven Mines' || subArea === 'Dwarven Village' || subArea === 'The Lift';

        if (needsWarp) {
            if (Player.getContainer()) Guis.closeInv();
            if (Pathfinder.isPathing()) Pathfinder.resetPath();
            Rotations.stopRotation();

            // If we are on cooldown, count down and wait
            if (this.warpCooldownTicks > 0) {
                this.warpCooldownTicks--;
                return true;
            }

            // Execute the warp command
            const location = area !== 'Dwarven Mines' ? area : subArea;
            this.message(`&e[AutoTravel] Wrong location (${location ?? 'Unknown'}). Warping...`);
            ChatLib.command('warp base');
            
            // Set the retry cooldown to exactly 100 ticks (5 seconds)
            this.warpCooldownTicks = 100;
            return true;
        }

        // Reset the cooldown when we arrive safely
        this.warpCooldownTicks = 0;

        const [nx, ny, nz] = NPC_POS;
        if (Math.hypot(Player.getX() - nx, Player.getY() - ny, Player.getZ() - nz) > 3) {
            if (Player.getContainer()) Guis.closeInv();
            Rotations.stopRotation();

            if (!Pathfinder.isPathing()) {
                Pathfinder.resetPath();
                Pathfinder.findPath([NPC_POS], () => {
                    // FIX: Only transition to OPENING if we haven't already started interacting
                    if (this.enabled && !this.inExcavator) {
                        this.state = STATES.OPENING;
                    }
                });
            }
            return true;
        }

        // FIX: We are within 3 blocks. Stop pathfinding so it doesn't run in the background 
        // and trigger the callback while we are inside the minigame GUI.
        if (Pathfinder.isPathing()) {
            Pathfinder.resetPath();
            if (!this.inExcavator) {
                this.state = STATES.OPENING;
            }
        }

        return false;
    }

    _checkUnexpectedClose() {
        if (this.inExcavator && Guis.guiName() !== 'Fossil Excavator') {
            this.inExcavator = false;
            this.guiCloseWaitTicks = UNEXPECTED_CLOSE_TICKS;
            this.state = STATES.WAITING_FOR_AREA;
            return true;
        }
        return false;
    }

    _handleNoScrap() {
        this.message('&cNo scrap! Running Auto Combine and refilling.');
        this.inExcavator = false;
        if (Player.getContainer()) Guis.closeInv();

        this.autoCombineWatchdog = AUTO_COMBINE_WATCHDOG;
        const autoCombine = this._getAutoCombineModule();
        if (autoCombine && !autoCombine.enabled) autoCombine.toggle(true, true);

        this.state = STATES.AUTO_COMBINING;
    }

    // --- HELPERS ---

    _hasSuspiciousScrap() {
        return Guis.findItemInInventory('Suspicious Scrap') !== -1;
    }

    _hasPerfectChisel() {
        const items = Player.getInventory().getItems();
        const validChisels = ["chisel", "reinforced chisel", "glacite-plated chisel", "perfect chisel"];
        
        for (let i = 0; i < items.length; i++) {
            if (!items[i]) continue;
            const name = ChatLib.removeFormatting(items[i].getName()).toLowerCase();
            
            // Checks if the item name matches any of the approved chisels
            if (validChisels.some(chisel => name.includes(chisel))) {
                return true;
            }
        }
        return false;
    }

    _isGameStarted() {
        const items = Player.getContainer()?.getItems();
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
            if (!items[i]) continue;
            const reg = String(items[i].type?.getRegistryName?.() ?? '');
            // If we see brown or lime glass, the game is already in progress
            if (reg.includes('brown_stained') || reg.includes('lime_stained')) return true;
        }
        return false;
    }

    _getAutoCombineModule() {
        return MacroState.getModule('Auto Combine');
    }

    _resumeExcavatorLoop() {
        this.refillCommandSent = false;
        this.refillDelayTicks = 0;
        this.guiClosedTicks = 0;
        this.autoCombineDone = false;
        this.inExcavator = false;
        this.state = STATES.OPENING;
    }

    _clickItem(name, shift = false, button = 'LEFT', displayName = true, startSlot = 0) {
        const items = Player.getContainer()?.getItems();
        if (!items) return false;

        const target = name.toLowerCase();
        for (let i = startSlot; i < items.length; i++) {
            if (!items[i]) continue;
            const raw = displayName
                ? ChatLib.removeFormatting(String(items[i].getName?.() ?? ''))
                : String(items[i].type?.getRegistryName?.() ?? '');
            
            if (raw.toLowerCase().includes(target)) {
                Guis.clickSlot(i, shift, button);
                return true;
            }
        }
        return false;
    }

    _updateBlacklist() {
        for (const [slot, ticks] of this.blacklistedSlots) {
            if (ticks <= 1) this.blacklistedSlots.delete(slot);
            else this.blacklistedSlots.set(slot, ticks - 1);
        }
    }

    _blacklistSlot(slot, ticks) {
        this.blacklistedSlots.set(slot, ticks);
    }

    _clickDelay() {
        if (this.NODELAY) return true;
        if (this.tickCount > 0) { this.tickCount--; return false; }
        this.tickCount = this.TICKDELAY;
        return true;
    }

    // --- LIFECYCLE ---

    onEnable() {
        this.message('&aEnabled');
        this._resetState();
    }

    onDisable() {
        this.message('&cDisabled');
        this.state = STATES.WAITING;
        this.inExcavator = false;
        this.blacklistedSlots.clear();
        this.guiOpenWaitTicks = 0;
        this.refillCommandSent = false;
        this.refillDelayTicks = 0;
        this.guiClosedTicks = 0;
        this.autoCombineDone = false;
        this.autoCombineWatchdog = 0;
        this.saxCommandSent = false;
        this.saxGuiOpenTicks = 0;
        this.saxGuiCloseTicks = 0;
        this.chiselCommandSent = false;
        this.chiselRetrieveDelayTicks = 0;
        this.chiselRetrieveCloseTicks = 0;
        this.chiselAutoCombinePending = false;
        this.chiselMissingTicks = 0;
        this.warpCooldownTicks = 0;
        this.warpDelayTicks = 0;
        this.guiCloseWaitTicks = 0;
        Pathfinder.resetPath();
        Rotations.stopRotation();
    }
}

new ExcavatorMacro();