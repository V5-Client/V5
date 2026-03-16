import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';

const BASE_BOOK_LEVELS = ['I', 'II', 'III', 'IV'];
const EXTENDED_BOOK_LEVELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

class AutoCombine extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Combine',
            subcategory: 'Other',
            description: 'Automatically combine items in your inventory with /anvil.',
            tooltip: 'Automatically combine items in your inventory with /anvil.',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: true,
        });
        this.bindToggleKey();

        this.STATES = {
            OPEN_ANVIL: 'OPEN_ANVIL',
            SEARCH_PAIR: 'SEARCH_PAIR',
            FIRST_BOOK: 'FIRST_BOOK',
            SECOND_BOOK: 'SECOND_BOOK',
            COMBINE_BOOKS: 'COMBINE_BOOKS',
            EXTRACT_BOOK: 'EXTRACT_BOOK',
        };

        this.state = this.STATES.OPEN_ANVIL;
        this.pendingPair = null;
        this.first = null;
        this.second = null;
        this.lastCombineSlots = [];
        this.timeoutFlags = 0;
        this.enableLevelTenBooks = false;

        this.addToggle(
            'Support Level 10 Books',
            (value) => (this.enableLevelTenBooks = !!value),
            'Allow combining enchanted books from I through X. Level X pairs are ignored so results stay capped at X.',
            false
        );

        this.on('tick', (tick) => this.onTick(tick));
    }

    onTick(tick) {
        if (tick % 5 !== 1) return;
        switch (this.state) {
            case this.STATES.OPEN_ANVIL:
                this.openAnvil();
                break;
            case this.STATES.SEARCH_PAIR:
                this.searchForNextPair();
                break;
            case this.STATES.FIRST_BOOK:
                this.clickFirstBook();
                break;
            case this.STATES.SECOND_BOOK:
                this.clickSecondBook();
                break;
            case this.STATES.COMBINE_BOOKS:
                this.clickCombine();
                break;
            case this.STATES.EXTRACT_BOOK:
                this.clickExtractItem();
                break;
        }
    }

    openAnvil() {
        if (Player.getContainer()?.getName() != '§rAnvil') ChatLib.command('anvil');
        this.setState(this.STATES.SEARCH_PAIR);
    }

    searchForNextPair() {
        if (!Player.getContainer()) return this.timeout();
        this.findNextCombinePair();
        if (!this.pendingPair) {
            Chat.message('[AutoCombine] No combineable pair found');
            if (Player.getContainer()) Guis.closeInv();
            this.toggle(false);
            return;
        }

        if (Player.getContainer()?.getName() != '§rAnvil') {
            this.setState(this.STATES.OPEN_ANVIL);
            return;
        }

        Chat.message(`[AutoCombine] Found pair level ${this.pendingPair.level} | slots ${this.first?.slot} & ${this.second?.slot}`);
        this.setState(this.STATES.FIRST_BOOK);
    }

    clickFirstBook() {
        if (Player.getContainer()?.getName() != '§rAnvil') return this.timeout();
        if (!Player.getContainer()?.getItems()[22]?.getLore()?.join('')?.includes('left and right')) return this.timeout();

        const firstSlot = this.first?.slot;
        if (firstSlot === undefined || firstSlot === null) {
            this.reset(true);
            return;
        }

        Guis.clickSlot(firstSlot, true);
        this.setState(this.STATES.SECOND_BOOK);
    }

    clickSecondBook() {
        if (Player.getContainer()?.getName() != '§rAnvil') return this.timeout();
        if (!Player.getContainer()?.getItems()[22]?.getLore()?.join('')?.includes('left and right')) return this.timeout();

        const secondSlot = this.second?.slot;
        if (secondSlot === undefined || secondSlot === null) {
            this.reset(true);
            return;
        }

        Guis.clickSlot(secondSlot, true);
        this.setState(this.STATES.COMBINE_BOOKS);
    }

    clickCombine() {
        const items = Player.getContainer()?.getItems();
        if (!items) return this.timeout();

        const combineItem = items[22];
        if (!combineItem?.getLore()?.join('')?.includes('Cost')) return this.timeout();

        Guis.clickSlot(22);
        this.setState(this.STATES.EXTRACT_BOOK);
    }

    clickExtractItem() {
        const items = Player.getContainer()?.getItems();
        if (!items) return this.timeout();

        const extractItem = items[13];
        if (!extractItem) return this.timeout();
        if (!items[22]?.getLore()?.join('')?.includes('Claim the result')) return this.timeout();

        Guis.clickSlot(13, true);
        this.reset();
    }

    findNextCombinePair() {
        const container = Player.getContainer();
        const booksByLevel = new Map();

        for (let slot = 30; slot < container?.getSize(); slot++) {
            const item = container?.getStackInSlot(slot);
            if (!item?.getName()?.includes('Enchanted Book')) continue;

            const enchantmentLevel = this.getEnchantmentLevel(item?.getLore()?.[1]?.toString());
            if (enchantmentLevel <= 0) continue;

            if (!booksByLevel.has(enchantmentLevel)) booksByLevel.set(enchantmentLevel, []);
            booksByLevel.get(enchantmentLevel).push({ item, slot });
        }

        const blacklist = new Set(this.lastCombineSlots || []);
        let chosenPair = null;
        let fallbackPair = null;
        const levels = Array.from(booksByLevel.keys()).sort((a, b) => a - b);
        const maxPairLevel = this.enableLevelTenBooks ? 9 : 4;

        for (const level of levels) {
            if (level > maxPairLevel) continue;

            const bookList = booksByLevel.get(level);
            if (!bookList || bookList.length < 2) continue;

            if (!fallbackPair) fallbackPair = { level, books: bookList.slice(0, 2) };

            let candidate = null;
            for (let i = 0; i < bookList.length; i++) {
                for (let j = i + 1; j < bookList.length; j++) {
                    const first = bookList[i];
                    const second = bookList[j];
                    if (blacklist.has(first.slot) || blacklist.has(second.slot)) continue;
                    candidate = [first, second];
                    break;
                }
                if (candidate) break;
            }

            if (candidate) {
                chosenPair = { level, books: candidate };
                break;
            }
        }

        const pair = chosenPair || fallbackPair;
        this.pendingPair = pair ? { level: pair.level, books: pair.books } : null;
        this.first = null;
        this.second = null;

        if (!this.pendingPair) return;

        [this.first, this.second] = this.pendingPair.books;
        this.lastCombineSlots = [this.first.slot, this.second.slot];
    }

    getEnchantmentLevel(line) {
        if (!line) return 0;

        const supportedLevels = this.enableLevelTenBooks ? EXTENDED_BOOK_LEVELS : BASE_BOOK_LEVELS;
        const regex = new RegExp(`\\s(${supportedLevels.join('|')})$`);
        const match = line.match(regex);
        if (!match) return 0;

        const romanStr = match[1];
        return supportedLevels.indexOf(romanStr) + 1;
    }

    setState(state) {
        this.state = state;
        this.resetTimeout();
    }

    timeout() {
        Chat.message('Returned without doing anything? stuck? waiting?');
        this.timeoutFlags++;
        if (this.timeoutFlags > 4) {
            Chat.message('&cStuck detected. Force resetting.');
            this.reset(true);
        }
    }

    resetTimeout() {
        this.timeoutFlags = 0;
    }

    reset(close = false) {
        this.pendingPair = null;
        this.first = null;
        this.second = null;
        this.setState(this.STATES.OPEN_ANVIL);
        if (close) Guis.closeInv();
    }

    onEnable() {
        Chat.message('Auto Combine Enabled');
        this.reset();
    }

    onDisable() {
        Chat.message('Auto Combine Disabled');
        this.reset();
    }
}

new AutoCombine();
