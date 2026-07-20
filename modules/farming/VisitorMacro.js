import { bazaarUtil } from '../../utils/BazaarUtil';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { TabListUtils } from '../../utils/TabListUtils';
import { Utils } from '../../utils/Utils';
import { farmingDelays } from './FarmingDelays';

const STATES = {
    SEEKING: 'Seeking visitor',
    PATHING: 'Pathing',
    OPENING: 'Opening offer',
    OFFER: 'Checking offer',
    BUYING: 'Buying items',
    ADVANCING: 'Next visitor',
};

const INTERACT_DISTANCE = 3;
const OPEN_TIMEOUT_MS = 1000;
const VISITOR_TIMEOUT_MS = 15_000;
const TELEPORT_RETRY_MS = 1000;
const VISITOR_BLACKLIST = ['Vinyl Collector', 'Gold Forger', 'Rhys'];
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
        if (!this.visitors.length) {
            this.message('&eNo visitors found.');
            this.toggle(false);
            return;
        }

        this.visitorIndex = 0;
        this.state = STATES.SEEKING;
        this.nextActionAt = 0;
        this.firstSeek = true;
        this.declineCurrentVisitor = false;
        this.visitorStartedAt = Date.now();
        this.message(`&aFound ${this.visitors.length} visitors.`);
    }

    onDisable() {
        bazaarUtil.cancel();
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Rotations.stop();
        Client.stopMovement();
    }

    tick() {
        if (this.state !== STATES.ADVANCING && Date.now() - this.visitorStartedAt >= VISITOR_TIMEOUT_MS) return this.skipVisitor();

        if (this.state === STATES.OPENING) {
            if (Client.isInGui()) {
                this.state = STATES.OFFER;
                this.nextActionAt = 0;
            } else if (Date.now() >= this.nextActionAt) {
                this.retrySeeking();
            }
            return;
        }

        if (Date.now() < this.nextActionAt) return;

        switch (this.state) {
            case STATES.SEEKING:
                return this.seekVisitor();
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
                    this.toggle(false);
                    return;
                }
                this.state = STATES.SEEKING;
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
        if (!aimPoint) return this.retrySeeking();

        this.state = STATES.OPENING;
        this.nextActionAt = Date.now() + OPEN_TIMEOUT_MS;
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
            this.retrySeeking();
        });
    }

    checkOffer() {
        if (!Client.isInGui()) return this.retrySeeking();

        if (this.declineCurrentVisitor) {
            if (!Guis.clickItem('Refuse Offer', false, 'LEFT')) return this.retrySeeking();
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
            if (!Guis.clickItem('Refuse Offer', false, 'LEFT')) return this.retrySeeking();
            return this.advanceVisitor();
        }

        this.requiredItems = parseRequiredItems(lore);
        if (!this.requiredItems.length) return this.retrySeeking();
        const inventory = Player.getInventory();
        const requiredSlots = this.requiredItems.reduce((slots, item) => slots + Math.ceil(item.count / 64), 0);
        if (!inventory || inventory.getItems().filter((item) => item === null).length < requiredSlots) return this.handlePurchaseFailure();
        this.buyNextItem();
    }

    buyNextItem() {
        const item = this.requiredItems.shift();
        if (!item) {
            this.state = STATES.SEEKING;
            this.nextActionAt = Date.now();
            return;
        }

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
            return this.retrySeeking();
        }
        this.advanceVisitor();
    }

    advanceVisitor() {
        this.state = STATES.ADVANCING;
        this.nextActionAt = Date.now() + Utils.randomInt(farmingDelays.visitorNextDelayMin, farmingDelays.visitorNextDelayMax);
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

    retrySeeking() {
        this.state = STATES.SEEKING;
        this.nextActionAt = Date.now() + Utils.randomInt(farmingDelays.visitorRetryDelayMin, farmingDelays.visitorRetryDelayMax);
    }
}

export const visitorMacro = new VisitorMacro();
