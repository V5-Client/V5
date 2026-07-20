import { bazaarUtil } from '../../utils/BazaarUtil';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { TabListUtils } from '../../utils/TabListUtils';
import { Utils } from '../../utils/Utils';
import { farmingDelays } from './FarmingDelays';
import { farmingSettings } from './FarmingSettings';

const STATES = {
    SEEKING: 'Seeking visitor',
    PATHING: 'Pathing',
    OPENING: 'Opening offer',
    OFFER: 'Checking offer',
    BUYING: 'Buying items',
    ADVANCING: 'Next visitor',
    PHILIP_SEEKING: 'Seeking Philip',
    PHILIP_PATHING: 'Pathing to Philip',
    PHILIP_APPROACHING: 'Approaching Philip',
    PHILIP_OPENING: 'Opening Philip',
    PHILIP_EMPTYING: 'Emptying vacuum',
};

const INTERACT_DISTANCE = 3;
const OPEN_TIMEOUT_MS = 1000;
const VISITOR_TIMEOUT_MS = 15_000;
const TELEPORT_RETRY_MS = 1000;
const VISITOR_BLACKLIST = ['Vinyl Collector', 'Gold Forger', 'Rhys'];
const PHILIP_SKIN_ID = 'minecraft:skins/299bb71d656072506bc04541cbcade06d5ec4b62';
const PHILIP_PATH_DISTANCE = 5;
const PHILIP_INTERACT_DISTANCE = 2.5;
const PHILIP_TIMEOUT_MS = 10_000;
const PHILIP_SEARCH_GOALS = [[-26, 70, -11]];
const cleanText = (value) => ChatLib.removeFormatting(String(value ?? '')).trim();

function parseRequiredItems(lore) {
    const lines = (lore || []).map(cleanText);
    const start = lines.indexOf('Items Required:');
    if (start < 0) return [];

    const end = lines.indexOf('Rewards:', start + 1);
    return lines
        .slice(start + 1, end < 0 ? undefined : end)
        .map((text) => {
            const match = text.match(/^(.*?)\s+x([\d,]+)$/);
            return { name: match ? match[1].trim() : text, count: match ? Number(match[2].replace(/,/g, '')) : 1 };
        })
        .filter((item) => item.name && Number.isFinite(item.count) && item.count > 0);
}

class VisitorMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Visitor Macro',
            subcategory: 'Farming',
            description: 'Buys requested Bazaar items and accepts garden visitors.',
            tooltip: 'Automatically used in farming macro by rewarp.',
            isMacro: true,
            autoDisableOnWorldUnload: true,
        });

        this.bindToggleKey();
        this.declinePurchaseFailures = false;
        this.maxPrice = 500_000;
        this.addSlider(
            'Max Price',
            0,
            5_000_000,
            this.maxPrice,
            (value) => (this.maxPrice = Number(value)),
            'Cancels a Bazaar purchase when its total price is above this amount.'
        );
        this.addToggle('Decline Failed Purchases', (value) => (this.declinePurchaseFailures = !!value), 'Declines visitors when a Bazaar purchase fails.');

        this.on('tick', () => this.tick());
    }

    onEnable() {
        this.visitors = TabListUtils.readVisitors();
        const philipReady = this.isParentManaged && farmingSettings.shouldRunPhilipBonus();
        if (!this.visitors.length && !philipReady) {
            this.message('&eNo visitors found.');
            this.toggle(false);
            return;
        }

        this.visitorIndex = 0;
        this.transition(this.visitors.length ? STATES.SEEKING : STATES.PHILIP_SEEKING, TELEPORT_RETRY_MS);
        this.philipStartedAt = this.visitors.length ? 0 : this.nextActionAt;
        this.firstSeek = true;
        this.declineCurrentVisitor = false;
        this.visitorStartedAt = Date.now();
        ChatLib.command('tptoplot barn');
        if (this.visitors.length) this.message(`&aFound ${this.visitors.length} visitors.`);
    }

    onDisable() {
        bazaarUtil.cancel();
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Rotations.stop();
        Client.stopMovement();
    }

    tick() {
        if (this.philipStartedAt && Date.now() - this.philipStartedAt >= PHILIP_TIMEOUT_MS) return this.toggle(false);
        if (!this.philipStartedAt && this.state !== STATES.ADVANCING && Date.now() - this.visitorStartedAt >= VISITOR_TIMEOUT_MS) return this.skipVisitor();
        if (this.state === STATES.OPENING) {
            if (Client.isInGui()) {
                this.transition(STATES.OFFER);
            } else if (Date.now() >= this.nextActionAt) {
                this.retry(STATES.SEEKING);
            }
            return;
        }

        if (this.state === STATES.PHILIP_OPENING) {
            if (Client.isInGui()) {
                this.transition(STATES.PHILIP_EMPTYING);
            } else if (Date.now() >= this.nextActionAt) {
                this.transition(STATES.PHILIP_SEEKING);
            }
            return;
        }

        if (Date.now() < this.nextActionAt) return;

        switch (this.state) {
            case STATES.SEEKING:
                return this.seekVisitor();
            case STATES.PHILIP_SEEKING:
            case STATES.PHILIP_PATHING:
                return this.seekPhilip();
            case STATES.PHILIP_APPROACHING:
                return this.approachPhilip();
            case STATES.PHILIP_EMPTYING:
                return this.emptyVacuum();
            case STATES.OFFER:
                return this.checkOffer();
            case STATES.ADVANCING:
                Guis.closeInv();
                this.visitorIndex++;
                this.visitors.push(...TabListUtils.readVisitors().filter((visitor) => !this.visitors.includes(visitor)));
                this.firstSeek = true;
                this.declineCurrentVisitor = false;
                this.visitorStartedAt = Date.now();
                if (this.visitorIndex >= this.visitors.length) {
                    this.message('&aAll stored visitors completed.');
                    if (!this.isParentManaged || !farmingSettings.shouldRunPhilipBonus()) return this.toggle(false);
                    this.philipStartedAt = Date.now();
                    this.transition(STATES.PHILIP_SEEKING);
                    return;
                }
                this.transition(STATES.SEEKING);
        }
    }

    seekVisitor() {
        const target = this.visitors[this.visitorIndex];
        if (!target) return this.toggle(false);

        const entity = this.findVisitor(target);
        if (!entity) return this.retryBarn();

        const dx = entity.getX() - Player.getX();
        const dy = entity.getY() - Player.getY();
        const dz = entity.getZ() - Player.getZ();
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq > 15 ** 2) return this.retryBarn();

        if (distanceSq > INTERACT_DISTANCE ** 2) return this.pathTo(entity);
        if (Rotations.active) return;

        const aimPoint = Rotations.getAimPoint(entity);
        if (!aimPoint) return this.retry(STATES.SEEKING);

        this.transition(STATES.OPENING, OPEN_TIMEOUT_MS);
        Rotations.lookAtVector(aimPoint);
        Rotations.onComplete(() => {
            if (!this.enabled || this.state !== STATES.OPENING) return;
            Client.leftClick();
            if (!this.firstSeek) return;
            this.firstSeek = false;
            ScheduleTask(Utils.randomInt(farmingDelays.visitorDoubleClickDelayMin, farmingDelays.visitorDoubleClickDelayMax), () => {
                if (this.enabled) Client.leftClick();
            });
        });
    }

    findPhilip() {
        return World.getAllPlayers().find((player) => {
            try {
                return player.toMC().getSkin().body().texturePath().toString() === PHILIP_SKIN_ID;
            } catch (e) {
                return false;
            }
        });
    }

    seekPhilip() {
        const philip = this.findPhilip();
        if (!philip) {
            if (this.state === STATES.PHILIP_PATHING && Pathfinder.isPathing()) Pathfinder.resetPath();
            this.transition(STATES.PHILIP_SEEKING);
            if (Pathfinder.isPathing()) return;
            return Pathfinder.findPath(PHILIP_SEARCH_GOALS, (success) => {
                if (this.enabled && this.state === STATES.PHILIP_SEEKING && !success) this.retry(STATES.PHILIP_SEEKING);
            });
        }

        if (philip.distanceTo(Player.getX(), Player.getY(), Player.getZ()) > PHILIP_PATH_DISTANCE) {
            if (this.state === STATES.PHILIP_PATHING) return;
            Pathfinder.resetPath();
            this.transition(STATES.PHILIP_PATHING);
            Pathfinder.findPath(
                [[Math.floor(philip.getX()), Math.floor(philip.getY()) - 1, Math.floor(philip.getZ())]],
                (success) => {
                    if (this.enabled && this.state === STATES.PHILIP_PATHING && !success) this.retry(STATES.PHILIP_SEEKING);
                },
                false,
                null,
                false,
                PHILIP_PATH_DISTANCE
            );
            return;
        }

        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Client.unpressKeys();
        this.transition(STATES.PHILIP_APPROACHING);
        Rotations.lookAtVector({ x: philip.getX(), y: philip.getY() + 1.62, z: philip.getZ() });
        Rotations.onComplete(() => {
            if (this.enabled && this.state === STATES.PHILIP_APPROACHING) Client.setKey('w', true);
        });
    }

    approachPhilip() {
        const philip = this.findPhilip();
        if (!philip) return this.retry(STATES.PHILIP_SEEKING);

        if (philip.distanceTo(Player.getX(), Player.getY(), Player.getZ()) > PHILIP_INTERACT_DISTANCE) return;

        Client.stopMovement();
        this.transition(STATES.PHILIP_OPENING, OPEN_TIMEOUT_MS);
        Rotations.lookAtVector({ x: philip.getX(), y: philip.getY() + 1.62, z: philip.getZ() });
        Rotations.onComplete(() => {
            if (this.enabled && this.state === STATES.PHILIP_OPENING) Client.leftClick();
        });
    }

    emptyVacuum() {
        if (!Client.isInGui() || !Guis.clickItem('Empty Vacuum Bag', false, 'LEFT')) return this.retry(STATES.PHILIP_SEEKING);

        this.nextActionAt = Infinity;
        ScheduleTask(1, () => {
            if (!this.enabled || this.state !== STATES.PHILIP_EMPTYING) return;
            Guis.closeInv();
            this.toggle(false);
        });
    }

    transition(state, delay = 0) {
        this.state = state;
        this.nextActionAt = Date.now() + delay;
    }

    retry(state) {
        this.transition(state, Utils.randomInt(farmingDelays.visitorRetryDelayMin, farmingDelays.visitorRetryDelayMax));
    }

    retryBarn() {
        ChatLib.command('tptoplot barn');
        this.nextActionAt = Date.now() + TELEPORT_RETRY_MS;
    }

    findVisitor(target) {
        const expected = cleanText(target).toLowerCase();
        return World.getAllEntities().find((entity) => {
            const name = cleanText(entity.getName?.()).toLowerCase();
            return name && (name.includes(expected) || expected.includes(name));
        });
    }

    pathTo(entity) {
        if (Pathfinder.isPathing()) return;

        const visitorIndex = this.visitorIndex;
        this.state = STATES.PATHING;
        Pathfinder.resetPath();
        Pathfinder.findPath([[Math.floor(entity.getX()), Math.floor(entity.getY()) - 1, Math.floor(entity.getZ())]], () => {
            if (!this.enabled || this.state !== STATES.PATHING || this.visitorIndex !== visitorIndex) return;
            this.retry(STATES.SEEKING);
        });
    }

    checkOffer() {
        if (!Client.isInGui()) return this.retry(STATES.SEEKING);

        if (this.declineCurrentVisitor) {
            if (!Guis.clickItem('Refuse Offer', false, 'LEFT')) return this.retry(STATES.SEEKING);
            return this.advanceVisitor();
        }

        const container = Player.getContainer();
        const offerSlot = Guis.findFirst(container, 'Accept Offer');
        if (offerSlot < 0) return;
        const lore = container.getStackInSlot(offerSlot).getLore() || [];
        if (lore.some((line) => cleanText(line).includes('Click to give!'))) {
            Guis.clickSlot(offerSlot, false, 'LEFT');
            return this.advanceVisitor();
        }

        if (VISITOR_BLACKLIST.includes(this.visitors[this.visitorIndex])) {
            if (!Guis.clickItem('Refuse Offer', false, 'LEFT')) return this.retry(STATES.SEEKING);
            return this.advanceVisitor();
        }

        this.requiredItems = parseRequiredItems(lore);
        if (!this.requiredItems.length) return this.retry(STATES.SEEKING);
        const inventory = Player.getInventory();
        const requiredSlots = this.requiredItems.reduce((slots, item) => slots + Math.ceil(item.count / 64), 0);
        if (!inventory || inventory.getItems().filter((item) => item === null).length < requiredSlots) return this.handlePurchaseFailure();
        this.buyNextItem();
    }

    buyNextItem() {
        const item = this.requiredItems.shift();
        if (!item) return this.transition(STATES.SEEKING);

        this.state = STATES.BUYING;
        const visitorIndex = this.visitorIndex;
        bazaarUtil.buy(item.name, item.count, this.maxPrice, (success) => {
            if (!this.enabled || this.state !== STATES.BUYING || this.visitorIndex !== visitorIndex) return;
            if (!success) return this.handlePurchaseFailure();
            this.buyNextItem();
        });
    }

    handlePurchaseFailure() {
        if (this.declinePurchaseFailures) {
            this.declineCurrentVisitor = true;
            return this.retry(STATES.SEEKING);
        }
        this.advanceVisitor();
    }

    advanceVisitor() {
        this.transition(STATES.ADVANCING, Utils.randomInt(farmingDelays.visitorNextDelayMin, farmingDelays.visitorNextDelayMax));
    }

    skipVisitor() {
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Rotations.stop();
        Client.stopMovement();
        Guis.closeInv();
        this.message('&eVisitor timed out, skipping.');
        bazaarUtil.cancel();
        this.advanceVisitor();
    }
}

export const visitorMacro = new VisitorMacro();
