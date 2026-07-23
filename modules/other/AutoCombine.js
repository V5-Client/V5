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
            theme: '#f1a64b',
            showEnabledToggle: false,
            autoDisableOnWorldUnload: true,
            ignoreFailsafes: true,
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
        this.first = null;
        this.second = null;
        this.timeoutFlags = 0;
        this.enableLevelTenBooks = false;
        this.tickCounter = 0;

        this.addToggle(
            'Support Level 10 Books',
            (value) => (this.enableLevelTenBooks = !!value),
            'Combines books up to level 10. Do not enable if your using normal level 5 capped books.',
            false
        );

        this.on('tick', (tick) => this.onTick(tick));
    }

    onTick() {
        this.tickCounter = (this.tickCounter + 1) % 5;
        if (this.tickCounter !== 1) return;
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

    getAnvilItems() {
        const container = Player.getContainer();
        return container?.getName() == '§rAnvil' ? container.getItems() : null;
    }

    searchForNextPair() {
        const container = Player.getContainer();
        if (!container) return this.timeout();

        if (container.getName() != '§rAnvil') {
            this.setState(this.STATES.OPEN_ANVIL);
            return;
        }

        const pair = this.findNextCombinePair();
        if (!pair) {
            this.message('No combineable pair found');
            Guis.closeInv();
            this.toggle(false);
            return;
        }

        [this.first, this.second] = pair;
        this.setState(this.STATES.FIRST_BOOK);
    }

    clickFirstBook() {
        if (!this.getAnvilItems()?.[22]?.getLore()?.join('')?.includes('left and right')) return this.timeout();

        const firstSlot = this.first?.slot;
        if (firstSlot === undefined || firstSlot === null) {
            this.reset(true);
            return;
        }

        Guis.clickSlot(firstSlot, true);
        this.setState(this.STATES.SECOND_BOOK);
    }

    clickSecondBook() {
        if (!this.getAnvilItems()?.[22]?.getLore()?.join('')?.includes('left and right')) return this.timeout();

        const secondSlot = this.second?.slot;
        if (secondSlot === undefined || secondSlot === null) {
            this.reset(true);
            return;
        }

        Guis.clickSlot(secondSlot, true);
        this.setState(this.STATES.COMBINE_BOOKS);
    }

    clickCombine() {
        const items = this.getAnvilItems();
        if (!items) return this.timeout();

        const combineItem = items[22];
        if (!combineItem?.getLore()?.join('')?.includes('Cost')) return this.timeout();

        Guis.clickSlot(22);
        this.setState(this.STATES.EXTRACT_BOOK);
    }

    clickExtractItem() {
        const items = this.getAnvilItems();
        if (!items) return this.timeout();

        const extractItem = items[13];
        if (!extractItem) return this.timeout();
        if (!items[22]?.getLore()?.join('')?.includes('Claim the result')) return this.timeout();

        Guis.clickSlot(13, true);
        this.reset();
    }

    findNextCombinePair() {
        const container = Player.getContainer();
        const booksByTypeAndLevel = new Map();

        for (let slot = 30; slot < container?.getSize(); slot++) {
            const item = container?.getStackInSlot(slot);
            if (!item?.getName()?.includes('Enchanted Book')) continue;

            const lore = item?.getLore?.();
            if (!lore?.length) continue;

            const bookData = lore.map((line) => this.getBookData(line?.toString?.() ?? line)).find((data) => data);
            if (!bookData) continue;

            const key = `${bookData.type}|${bookData.level}`;
            if (!booksByTypeAndLevel.has(key)) booksByTypeAndLevel.set(key, { ...bookData, books: [] });
            booksByTypeAndLevel.get(key).books.push({ item, slot });
        }

        const bookGroups = Array.from(booksByTypeAndLevel.values()).sort((a, b) => a.level - b.level || a.type.localeCompare(b.type));
        const maxPairLevel = this.enableLevelTenBooks ? 9 : 4;
        return bookGroups.find((group) => group.level <= maxPairLevel && group.books.length >= 2)?.books.slice(0, 2) || null;
    }

    getBookData(line) {
        if (!line) return null;

        const supportedLevels = this.enableLevelTenBooks ? EXTENDED_BOOK_LEVELS : BASE_BOOK_LEVELS;
        const cleanedLine = ChatLib.removeFormatting(`${line}`).trim();
        const regex = new RegExp(`^(.*)\\s(${supportedLevels.join('|')})$`);
        const match = cleanedLine.match(regex);
        if (!match) return null;

        const type = match[1].trim();
        return type
            ? {
                  type,
                  level: supportedLevels.indexOf(match[2]) + 1,
              }
            : null;
    }

    setState(state) {
        this.state = state;
        this.resetTimeout();
    }

    timeout() {
        this.message('Returned without doing anything? stuck? waiting?');
        this.timeoutFlags++;
        if (this.timeoutFlags > 4) {
            this.message('&cStuck detected. Force resetting.');
            this.reset(true);
        }
    }

    resetTimeout() {
        this.timeoutFlags = 0;
    }

    reset(close = false) {
        this.first = null;
        this.second = null;
        this.tickCounter = 0;
        this.setState(this.STATES.OPEN_ANVIL);
        if (close) Guis.closeInv();
    }

    onEnable() {
        this.message('&aEnabled');
        this.reset();
    }

    onDisable() {
        this.message('&cDisabled');
        this.reset();
    }
}

new AutoCombine();
