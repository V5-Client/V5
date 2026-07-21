import { bazaarUtil } from '../../../utils/BazaarUtil';
import { Chat } from '../../../utils/Chat';
import Pathfinder from '../../../utils/pathfinder/PathFinder';
import { Guis } from '../../../utils/player/Inventory';
import { Rotations } from '../../../utils/player/Rotations';
import { ScheduleTask } from '../../../utils/ScheduleTask';
import { TabListUtils } from '../../../utils/TabListUtils';
import { Utils } from '../../../utils/Utils';
import { farmingDelays } from '../FarmingDelays';
import { rewarpSettings } from './RewarpSettings';

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

class VisitorMacro {
    start() {
        this.running = true;
        this.visitors = TabListUtils.readVisitors();
        if (!this.visitors.length) {
            Chat.message('&eNo visitors found.');
            this.running = false;
            return false;
        }

        Chat.message(`&aFound ${this.visitors.length} visitors.`);
        this.visitorIndex = 0;
        this.firstSeek = true;
        this.declineCurrentVisitor = false;
        this.visitorStartedAt = Date.now();
        this.transition(STATES.SEEKING);
        return true;
    }

    stop() {
        this.running = false;
        bazaarUtil.cancel();
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Rotations.stop();
        Client.stopMovement();
    }

    tick() {
        if (!this.running) return true;
        if (Date.now() - this.visitorStartedAt >= VISITOR_TIMEOUT_MS && this.state !== STATES.ADVANCING) return this.skipVisitor();
        if (this.state === STATES.OPENING) {
            if (Client.isInGui()) {
                this.transition(STATES.OFFER);
            } else if (Date.now() >= this.nextActionAt) {
                this.retry(STATES.SEEKING);
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
                return this.advanceToNextVisitor();
        }
    }

    finishVisitors() {
        this.running = false;
        return true;
    }

    advanceToNextVisitor() {
        Guis.closeInv();
        this.visitorIndex++;
        this.visitors.push(...TabListUtils.readVisitors().filter((visitor) => !this.visitors.includes(visitor)));
        this.firstSeek = true;
        this.declineCurrentVisitor = false;
        this.visitorStartedAt = Date.now();
        if (this.visitorIndex >= this.visitors.length) {
            Chat.message('&aAll stored visitors completed.');
            return this.finishVisitors();
        }
        this.transition(STATES.SEEKING);
    }

    seekVisitor() {
        const target = this.visitors[this.visitorIndex];
        if (!target) return this.finishVisitors();

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
            if (!this.running || this.state !== STATES.OPENING) return;
            Client.leftClick();
            if (!this.firstSeek) return;
            this.firstSeek = false;
            ScheduleTask(Utils.randomInt(farmingDelays.visitorDoubleClickDelayMin, farmingDelays.visitorDoubleClickDelayMax), () => {
                if (this.running) Client.leftClick();
            });
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
            if (!this.running || this.state !== STATES.PATHING || this.visitorIndex !== visitorIndex) return;
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
        if (!inventory || inventory.getItems().filter((item) => !item).length < requiredSlots) return this.handlePurchaseFailure();
        this.buyNextItem();
    }

    buyNextItem() {
        const item = this.requiredItems.shift();
        if (!item) return this.transition(STATES.SEEKING);

        this.state = STATES.BUYING;
        const visitorIndex = this.visitorIndex;
        bazaarUtil.buy(item.name, item.count, rewarpSettings.maxVisitorPrice, (success) => {
            if (!this.running || this.state !== STATES.BUYING || this.visitorIndex !== visitorIndex) return;
            if (!success) return this.handlePurchaseFailure();
            this.buyNextItem();
        });
    }

    handlePurchaseFailure() {
        if (rewarpSettings.declinePurchaseFailures) {
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
        Chat.message('&eVisitor timed out, skipping.');
        bazaarUtil.cancel();
        this.advanceVisitor();
    }
}

export const visitorMacro = new VisitorMacro();
