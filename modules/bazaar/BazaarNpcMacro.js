import requestV2 from 'requestV2';
import { chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { setSignLine } from '../../utils/Sign';
import { v5Command } from '../../utils/V5Commands';
import { clickSlot, closeInventory, getGuiName } from '../../utils/player/Inventory';

const BAZAAR_URL = 'https://api.hypixel.net/v2/skyblock/bazaar';
const ITEMS_URL = 'https://api.hypixel.net/v2/resources/skyblock/items';
const MAX_ORDER_ITEMS = 2_048;
const MAX_API_PRICE_INCREASE = 0.05;
const MIN_API_PRICE_SLACK = 1;
const GUI_TIMEOUT = 10_000;
const STUCK_RETRY_DELAY = 1_000;
const COMMAND_CAPACITY = 10;
const COMMAND_RESTORE_TIME = 1_050;
const clean = (value) =>
    ChatLib.removeFormatting(String(value ?? ''))
        .trim()
        .replace(/^[^a-z0-9]+/i, '')
        .toLowerCase();
const lore = (item) => (item?.getLore?.() || []).map((line) => ChatLib.removeFormatting(String(line)).trim());
const formatCoins = (value) => {
    const unit = [
        [1e6, 'M'],
        [1e3, 'K'],
    ].find(([minimum]) => Math.abs(value) >= minimum);
    return unit ? `${(value / unit[0]).toFixed(2)}${unit[1]}` : Math.round(value).toLocaleString();
};

class BazaarNpcMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Bazaar to NPC',
            subcategory: 'Bazaar',
            description: 'Places profitable Bazaar buy orders and sells the fills to NPC.',
            tooltip: 'Requires Cookie Buff access to /bz. Only sellable items added after enabling are sold in /trades.',
            autoDisableOnWorldUnload: true,
            isMacro: true,
        });
        this.bindToggleKey();

        this.clickDelay = 350;
        this.addSlider(
            'Click Delay (ms)',
            50,
            2_000,
            350,
            (milliseconds) => (this.clickDelay = milliseconds),
            'Delay between normal Bazaar and NPC menu clicks.'
        );
        this.maxBuyOrders = 14;
        this.addSlider('Order Limit', 14, 28, 14, (limit) => (this.maxBuyOrders = Math.round(limit)), 'Maximum number of active Bazaar orders.');
        this.maxSpend = 1_000_000;
        this.addSlider(
            'Maximum Order Spend (M)',
            0.1,
            100,
            1,
            (millions) => (this.maxSpend = millions * 1_000_000),
            'Per order. Total committed coins can be the Order Limit times this value.'
        );
        this.minProfitPerItem = 1;
        this.addSlider(
            'Minimum Profit per Item',
            0,
            100_000,
            1,
            (coins) => (this.minProfitPerItem = coins),
            'Minimum coins earned on each item after buying it from Bazaar and selling it to NPC.'
        );
        this.minItemProfitPerHour = 0;
        this.addSlider(
            'Minimum Item Profit/hr (K)',
            0,
            10_000,
            0,
            (thousands) => (this.minItemProfitPerHour = thousands * 1_000),
            'Minimum estimated hourly profit for each item.'
        );
        this.minProfitPercent = 1;
        this.addSlider(
            'Minimum Profit (%)',
            0,
            100,
            1,
            (percent) => (this.minProfitPercent = percent),
            'Minimum profit as a percentage of the NPC sell value.'
        );
        this.itemNameBlacklist = [];
        this.addTextInput(
            'Item Name Blacklist',
            '',
            (value) => (this.itemNameBlacklist = String(value).split(',').map(clean).filter(Boolean)),
            'Case-insensitive item names to exclude, separated by commas.'
        );
        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.status,
                    'Active Orders': () => `${this.activeTargets.length}/${this.maxBuyOrders}`,
                    'Hourly Profit': () => `${formatCoins(this.activeTargets.reduce((total, target) => total + Number(target.profit || 0) * 2, 0))} coins`,
                },
            },
            {
                title: 'Item',
                data: {
                    Item: () => this.target?.name || 'None',
                    'Item Profit': () => `${formatCoins(this.target?.profit || 0)} coins`,
                    'Profit %': () => `${(this.target?.profitPercent || 0).toFixed(2)}%`,
                },
            },
        ]);

        this.on('tick', () => this.tick());
        this.on('chat', (event) => this.onChat(event));
        v5Command('bazaar npc cleanup', () => this.startCleanup());
        this.commandTokens = COMMAND_CAPACITY;
        this.commandRefillAt = Date.now();
        this.cleanupOnEnable = false;
        this.cleanupInventory = null;
        this.cleanupFinished = false;
        this.reset();
    }

    onEnable() {
        const cleanupMode = this.cleanupOnEnable;
        const cleanupInventory = this.cleanupInventory;
        this.cleanupOnEnable = false;
        this.cleanupInventory = null;
        this.reset();
        const inventory = Player.getInventory();
        if (!inventory) return this.fail('Could not snapshot your inventory.');
        this.cleanupMode = cleanupMode;
        this.startingInventory = cleanupMode && cleanupInventory ? cleanupInventory : this.inventorySnapshot(inventory.getItems());
        this.lastCheckedInventory = this.startingInventory;
        this.inventoryReady = true;
        this.message(cleanupMode ? '&aCleanup started' : '&aEnabled');
        this.openOrders();
    }

    onDisable() {
        const cleanupFinished = this.cleanupFinished;
        if (!cleanupFinished && this.inventoryReady) this.cleanupInventory = this.startingInventory;
        else if (cleanupFinished) this.cleanupInventory = null;
        this.requestToken++;
        closeInventory();
        this.reset();
        this.cleanupFinished = false;
        this.message(cleanupFinished ? '&aCleanup complete; no buy orders remain.' : '&cDisabled');
        if (!cleanupFinished) this.offerCleanup();
    }

    reset() {
        this.action = null;
        this.status = 'Idle';
        this.target = null;
        this.orderQueue = [];
        this.orderCheckQueue = [];
        this.activeTargets = [];
        this.claimedTargets = new Set();
        this.skippedIds = new Set();
        this.openBuyOrders = [];
        this.openOrderCount = 0;
        this.existingOrdersScanned = false;
        this.orderPricesChecked = false;
        this.orderSlotsChecked = false;
        this.orderLimitReached = false;
        this.cancelQuantity = 0;
        this.bazaarData = null;
        this.itemData = null;
        this.startingInventory = new Map();
        this.lastCheckedInventory = new Map();
        this.confirmSlot = -1;
        this.nextActionAt = 0;
        this.deadline = 0;
        this.retryAction = null;
        this.retryAt = 0;
        this.sellEmptySince = 0;
        this.nextTradesRetryAt = 0;
        this.orderCooldownUntil = 0;
        this.orderMissingSince = 0;
        this.cleanupMode = false;
        this.inventoryReady = false;
        this.requestToken = (this.requestToken || 0) + 1;
    }

    startCleanup() {
        if (this.enabled) return this.message('&eThe macro is already enabled.');
        this.cleanupOnEnable = true;
        this.toggle(true);
    }

    offerCleanup() {
        chat(
            new TextComponent(
                { text: `${this.name}: `, color: '#5fb0ff' },
                {
                    text: '[Clean up remaining orders]',
                    color: 'yellow',
                    underline: true,
                    clickEvent: { action: 'run_command', value: '/v5 bazaar npc cleanup' },
                    hoverEvent: { action: 'show_text', value: 'Claim and cancel all buy orders, then sell their items to NPC.' },
                }
            )
        );
    }

    tick() {
        const now = Date.now();
        if (this.deadline && now >= this.deadline) return this.restart(`Timed out while ${this.status.toLowerCase()}.`);
        if (this.retryAction && now >= this.retryAt) {
            this.retryAt = now + STUCK_RETRY_DELAY;
            this.nextActionAt = now + this.clickDelay;
            this.retryAction.call(this);
            return;
        }
        if (now < this.nextActionAt) return;
        if (this.action) this.action.call(this);
    }

    setAction(action, status, delay = this.clickDelay, timeout = GUI_TIMEOUT, retryAction = null) {
        this.action = action;
        this.status = status;
        this.nextActionAt = Date.now() + delay;
        this.deadline = timeout ? Date.now() + timeout : 0;
        this.retryAction = retryAction;
        this.retryAt = retryAction ? Date.now() + STUCK_RETRY_DELAY : 0;
    }

    clickAndWait(slot, action, status, delay = this.clickDelay, timeout = GUI_TIMEOUT) {
        const gui = clean(getGuiName());
        const item = clean(Player.getContainer()?.getStackInSlot(slot)?.getName?.());
        const click = () => {
            if (clean(getGuiName()) === gui && clean(Player.getContainer()?.getStackInSlot(slot)?.getName?.()) === item) clickSlot(slot);
        };
        this.setAction(action, status, delay, timeout, click);
        click();
    }

    commandAndWait(command, action, status, delay = 0, timeout = GUI_TIMEOUT) {
        const run = () => {
            const wait = this.runCommand(command);
            if (wait) return this.setAction(run, status, wait, 0);
            this.setAction(action, status, delay, timeout, retry);
        };
        const retry = () => {
            action.call(this);
            if (this.action === action && this.retryAction === retry) run();
        };
        run();
    }

    runCommand(command) {
        const now = Date.now();
        const restored = Math.floor((now - this.commandRefillAt) / COMMAND_RESTORE_TIME);
        if (restored) {
            this.commandTokens = Math.min(COMMAND_CAPACITY, this.commandTokens + restored);
            this.commandRefillAt = this.commandTokens === COMMAND_CAPACITY ? now : this.commandRefillAt + restored * COMMAND_RESTORE_TIME;
        }
        if (!this.commandTokens) return COMMAND_RESTORE_TIME - (now - this.commandRefillAt);
        this.commandTokens--;
        ChatLib.command(command);
        return 0;
    }

    fetchPrices(adoptOnly = false, resumeChecks = false) {
        const token = ++this.requestToken;
        this.setAction(null, 'Loading prices', 0, 25_000);

        const failed = () => {
            if (this.enabled && token === this.requestToken) this.fail('Could not load Hypixel Bazaar prices.');
        };
        requestV2({ url: BAZAAR_URL, method: 'GET', json: true, timeout: 10_000 })
            .then((bazaar) => requestV2({ url: ITEMS_URL, method: 'GET', json: true, timeout: 10_000 }).then((items) => [bazaar, items]))
            .then((responses) => {
                const bazaar = responses[0];
                const items = responses[1];
                if (!this.enabled || token !== this.requestToken) return;
                this.bazaarData = bazaar;
                this.itemData = items;
                this.adoptOpenOrders(bazaar, items);
                if (adoptOnly) return this.setAction(this.inspectOrder, 'Checking duplicates', this.clickDelay);
                this.orderQueue = this.findBestFlips(bazaar, items);
                if (!this.orderQueue.length) {
                    if (!this.activeTargets.length) return this.fail('No Bazaar item meets the configured profit minimums.');
                    if (resumeChecks) return this.setAction(this.inspectOrder, 'Checking orders', this.clickDelay, 0);
                    return this.setAction(this.openOrders, 'Checking orders', this.clickDelay, 0);
                }

                this.message(`Found &b${this.orderQueue.length}&f profitable item${this.orderQueue.length === 1 ? '' : 's'}.`);
                this.placeNextOrder();
            })
            .catch(failed);
    }

    findBestFlips(bazaar, itemData) {
        if (!bazaar?.success || !itemData?.success) return [];
        const items = {};
        for (const item of itemData.items || []) {
            if (item.id && item.name && Number(item.npc_sell_price) > 0) items[item.id] = item;
        }

        const activeNames = new Set([...this.openBuyOrders.map((order) => clean(order.name)), ...this.activeTargets.map((target) => clean(target.name))]);
        const candidates = [];
        for (const id of Object.keys(bazaar.products || {})) {
            const item = items[id];
            const product = bazaar.products[id];
            const prices = (product.sell_summary || []).map((order) => Number(order.pricePerUnit)).filter(Number.isFinite);
            const itemName = clean(item?.name);
            if (
                !item ||
                !prices.length ||
                this.skippedIds.has(id) ||
                activeNames.has(itemName) ||
                this.itemNameBlacklist.some((blocked) => itemName.includes(blocked))
            )
                continue;

            const orderPrice = Math.ceil((Math.max(...prices) + 0.1) * 10) / 10;
            const npcPrice = Number(item.npc_sell_price);
            const maxQuantity = Math.min(MAX_ORDER_ITEMS, Math.floor(this.maxSpend / orderPrice));
            const halfHourVolume = Math.floor(Number(product.quick_status?.sellMovingWeek || 0) / (7 * 24 * 2));
            const quantity = Math.min(maxQuantity, halfHourVolume);
            const profitPerItem = npcPrice - orderPrice;
            const profit = profitPerItem * quantity;
            const profitPercent = (profitPerItem / npcPrice) * 100;

            // ponytail: 30 minutes of historical volume is the fill estimate; simulate the order book only if this proves inaccurate.
            if (quantity > 0 && this.isProfitablePrice({ npcPrice, quantity }, orderPrice)) {
                candidates.push({
                    id,
                    name: item.name,
                    npcPrice,
                    orderPrice,
                    expectedOrderPrice: orderPrice,
                    quantity,
                    profit,
                    profitPercent,
                });
            }
        }
        const seen = new Set();
        return candidates
            .sort((a, b) => b.profit * b.profitPercent - a.profit * a.profitPercent || b.profitPercent - a.profitPercent || b.profit - a.profit)
            .filter((target) => !seen.has(clean(target.name)) && seen.add(clean(target.name)))
            .slice(0, Math.max(0, this.maxBuyOrders - this.openOrderCount));
    }

    adoptOpenOrders(bazaar, itemData) {
        if (!bazaar?.success || !itemData?.success) return;
        const byId = new Map();
        const byName = new Map();
        for (const item of itemData.items || []) {
            if (!item.id || !item.name || Number(item.npc_sell_price) <= 0 || !bazaar.products?.[item.id]) continue;
            byId.set(item.id, item);
            const name = clean(item.name);
            if (!byName.has(name)) byName.set(name, []);
            byName.get(name).push(item);
        }

        const unmatchedTargets = [...this.activeTargets];
        let adopted = 0;
        for (const order of this.openBuyOrders) {
            if (!Number.isFinite(order.amount) || order.amount <= 0 || !Number.isFinite(order.price) || order.price <= 0) continue;
            const existing = unmatchedTargets.findIndex(
                (target) => clean(target.name) === clean(order.name) && Math.abs(target.orderPrice - order.price) <= 0.001
            );
            if (existing !== -1) {
                unmatchedTargets.splice(existing, 1);
                continue;
            }

            const nameMatches = byName.get(clean(order.name)) || [];
            const item = byId.get(order.id) || (nameMatches.length === 1 ? nameMatches[0] : null);
            const npcPrice = Number(item?.npc_sell_price);
            if (!item || !Number.isFinite(npcPrice) || npcPrice <= order.price) continue;
            const profitPerItem = npcPrice - order.price;
            this.activeTargets.push({
                id: item.id,
                name: item.name,
                npcPrice,
                orderPrice: order.price,
                expectedOrderPrice: order.price,
                quantity: order.amount,
                profit: profitPerItem * order.amount,
                profitPercent: (profitPerItem / npcPrice) * 100,
            });
            adopted++;
        }
        if (adopted) this.message(`Adopted &b${adopted}&f existing buy order${adopted === 1 ? '' : 's'}.`);
    }

    placeNextOrder() {
        const cooldown = this.orderCooldownUntil - Date.now();
        if (cooldown > 0) return this.setAction(this.placeNextOrder, 'Bazaar order cooldown', cooldown, 0);

        this.target = this.orderQueue.shift() || null;
        if (!this.target) {
            if (this.orderCheckQueue.length) return this.setAction(this.checkNextOrder, 'Checking next order', this.clickDelay, 0);
            if (!this.activeTargets.length) return this.fail('No selected items remained profitable.');
            return this.setAction(this.openOrders, 'Checking orders', this.clickDelay, 0);
        }

        this.message(
            `Ordering &b${this.target.quantity.toLocaleString()}x ${this.target.name}&f for about &6${Math.round(
                this.target.profit
            ).toLocaleString()} coins &fprofit &7(${this.target.profitPercent.toFixed(2)}%).`
        );
        this.commandAndWait(`bz ${this.target.name}`, this.openProduct, 'Opening product');
    }

    openProduct() {
        if (!clean(getGuiName()).includes('bazaar')) return;
        const slot = this.findSlot(this.target.name, true);
        if (slot === -1) return;
        this.clickAndWait(slot, this.chooseBuyOrder, 'Selecting buy order');
    }

    chooseBuyOrder() {
        const slot = this.findSlot('Create Buy Order', true);
        if (slot === -1) return;
        this.clickAndWait(slot, this.chooseAmount, 'Selecting amount');
    }

    chooseAmount() {
        const slot = this.findSlot('Custom Amount', true);
        if (slot === -1) return;
        const limit = Number(
            lore(Player.getContainer()?.getStackInSlot(slot))
                .find((line) => /^buy up to [\d,]+x\.?$/i.test(line))
                ?.match(/[\d,]+/)?.[0]
                ?.replace(/,/g, '')
        );
        if (limit > 0) this.target.quantity = Math.min(this.target.quantity, limit);
        this.clickAndWait(slot, this.enterAmount, 'Entering amount');
    }

    enterAmount() {
        if (!Client.currentGui?.getClassName?.().includes('Sign')) return;
        const submit = () => {
            if (!Client.currentGui?.getClassName?.().includes('Sign')) return;
            setSignLine(1, this.target.quantity);
            Client.currentGui.close();
        };
        this.setAction(this.choosePrice, 'Selecting price', this.clickDelay, GUI_TIMEOUT, submit);
        submit();
    }

    choosePrice() {
        const slot = this.findSlot('Top Order +0.1', true);
        if (slot === -1) return;
        const price = this.unitPrice(Player.getContainer()?.getStackInSlot(slot));
        if (!this.isSafePrice(price)) {
            return this.retryPrices('The +0.1 price moved too far from the API estimate or is no longer profitable.');
        }

        this.target.orderPrice = price;
        this.target.profit = (this.target.npcPrice - price) * this.target.quantity;
        this.target.profitPercent = ((this.target.npcPrice - price) / this.target.npcPrice) * 100;
        this.clickAndWait(slot, this.confirmOrder, 'Confirming order');
    }

    confirmOrder() {
        if (!clean(getGuiName()).includes('confirm buy order')) return;
        const slot = this.findSlot('Buy Order', true);
        if (slot === -1) return;
        const price = this.unitPrice(Player.getContainer()?.getStackInSlot(slot));
        if (!this.isSafePrice(price)) {
            return this.retryPrices('The confirmation price moved too far from the API estimate or is no longer profitable.');
        }

        this.target.orderPrice = price;
        this.target.profit = (this.target.npcPrice - price) * this.target.quantity;
        this.target.profitPercent = ((this.target.npcPrice - price) / this.target.npcPrice) * 100;
        this.confirmSlot = slot;
        this.clickAndWait(slot, this.awaitOrderCreated, 'Creating order', 500);
    }

    awaitOrderCreated() {
        if (!Client.isInGui()) return;
        if (clean(Player.getContainer()?.getStackInSlot(this.confirmSlot)?.getName?.()) !== 'warning') return;
        this.setAction(this.waitForWarning, 'Waiting for Bazaar warning');
    }

    waitForWarning() {
        const name = clean(Player.getContainer()?.getStackInSlot(this.confirmSlot)?.getName?.());
        if (!name || name === 'warning') return;
        this.clickAndWait(this.confirmSlot, this.awaitOrderCreated, 'Creating order', 500);
    }

    openOrders() {
        this.claimedTargets = new Set();
        this.orderCheckQueue = [];
        this.orderPricesChecked = false;
        this.orderSlotsChecked = false;
        this.commandAndWait('managebazaarorders', this.inspectOrder, 'Opening Bazaar orders');
    }

    inspectOrder() {
        if (!clean(getGuiName()).includes('bazaar orders')) return;

        this.scanOpenOrders();
        if (this.cleanupMode) return this.cleanupOrders();
        if (this.bazaarData && this.itemData) this.adoptOpenOrders(this.bazaarData, this.itemData);
        if (!this.existingOrdersScanned) {
            this.existingOrdersScanned = true;
            if (this.openBuyOrders.length) {
                return this.fetchPrices(true);
            }
        }
        const openTargets = [];
        const usedOrderSlots = new Set();
        let claimable = null;
        for (const target of this.activeTargets) {
            const slot = this.findOrderSlot(target, usedOrderSlots);
            if (slot === -1) continue;
            usedOrderSlots.add(slot);
            openTargets.push(target);
            const stack = Player.getContainer().getStackInSlot(slot);
            const orderLore = lore(stack);
            if (!claimable && !this.claimedTargets.has(target) && orderLore.some((line) => /^you have [\d,]+ items? to claim!$/i.test(line))) {
                claimable = { target, slot };
            }
        }

        this.activeTargets = openTargets;
        if (!this.orderLimitReached && !this.orderSlotsChecked && this.openOrderCount < this.maxBuyOrders) {
            this.orderSlotsChecked = true;
            if (this.orderQueue.length) return this.placeNextOrder();
            return this.fetchPrices(false, true);
        }
        if (!this.orderPricesChecked) {
            this.orderPricesChecked = true;
            const counts = new Map();
            for (const order of this.openBuyOrders) counts.set(clean(order.name), (counts.get(clean(order.name)) || 0) + 1);
            const duplicate = this.activeTargets.find((target) => counts.get(clean(target.name)) > 1);
            this.orderCheckQueue = duplicate ? [duplicate] : [...this.activeTargets];
            return this.checkNextOrder();
        }

        const hasNewItems = this.hasInventoryIncrease();
        if (this.inventoryFull()) {
            if (hasNewItems) return this.setAction(this.openTrades, 'Inventory full', 500);
            return this.fail('Inventory is full, but none of it was added by this macro.');
        }
        if (claimable) {
            this.target = claimable.target;
            this.claimedTargets.add(claimable.target);
            clickSlot(claimable.slot);
            return this.setAction(this.inspectOrder, 'Claiming items', Math.max(250, this.clickDelay), 0);
        }
        if (hasNewItems) return this.setAction(this.openTrades, 'Selling claimed items', 500);
        this.orderQueue = [];
        this.setAction(this.openOrders, 'Checking orders', this.clickDelay, 0);
    }

    cleanupOrders() {
        const items = Player.getContainer()?.getItems() || [];
        const buySlots = [];
        for (let slot = 0; slot < Math.max(0, items.length - 36); slot++) {
            if (clean(items[slot]?.getName?.()).startsWith('buy ')) buySlots.push(slot);
        }

        const hasNewItems = this.hasInventoryIncrease();
        const inventoryFull = this.inventoryFull();
        if (inventoryFull && hasNewItems) return this.setAction(this.openTrades, 'Inventory full', 500);

        const claimSlot = buySlots.find((slot) => lore(items[slot]).some((line) => /^you have [\d,]+ items? to claim!$/i.test(line)));
        if (claimSlot !== undefined && inventoryFull) {
            return this.fail('Inventory is full, but none of it can be sold by this cleanup.');
        }
        if (claimSlot !== undefined) {
            clickSlot(claimSlot);
            return this.setAction(this.inspectOrder, 'Claiming items', Math.max(250, this.clickDelay), 0);
        }
        if (buySlots.length) return this.clickAndWait(buySlots[0], this.cancelCleanupOrder, 'Opening buy order');
        if (hasNewItems) return this.setAction(this.openTrades, 'Selling claimed items', 500);

        this.cleanupFinished = true;
        this.toggle(false);
    }

    cancelCleanupOrder() {
        if (!clean(getGuiName()).includes('order options')) return;
        const slot = this.findSlot('Cancel Order', true);
        if (slot !== -1) this.clickAndWait(slot, this.inspectOrder, 'Cancelling buy order', 500);
    }

    checkNextOrder() {
        this.target = this.orderCheckQueue.shift() || null;
        if (!this.target) return this.commandAndWait('managebazaarorders', this.inspectOrder, 'Checking filled orders');
        this.commandAndWait(`bz ${this.target.name}`, this.openOrderCheck, 'Checking Item');
    }

    openOrderCheck() {
        if (!clean(getGuiName()).includes('bazaar')) return;
        const slot = this.findSlot(this.target.name, true);
        if (slot === -1) return;
        this.clickAndWait(slot, this.checkProductOrder, 'Checking Item');
    }

    checkProductOrder() {
        const slot = this.findSlot('Create Buy Order', true);
        if (slot === -1) return;
        const topPrice = this.topBuyOrderPrice(Player.getContainer()?.getStackInSlot(slot));
        if (!Number.isFinite(topPrice)) return;
        const duplicateCount = this.openBuyOrders.filter((order) => clean(order.name) === clean(this.target.name)).length;
        if (duplicateCount < 2 && topPrice <= this.target.orderPrice + 0.001) {
            return this.setAction(this.checkNextOrder, 'Checking next order', this.clickDelay, 0);
        }

        this.target.expectedOrderPrice = Math.ceil((topPrice + 0.1) * 10) / 10;
        this.cancelQuantity = 0;
        this.orderMissingSince = 0;
        this.message(
            duplicateCount > 1
                ? `&eFound ${duplicateCount} ${this.target.name} orders; cancelling all before relisting.`
                : `&e${this.target.name} was outbid at ${topPrice.toLocaleString()} coins; relisting.`
        );
        this.commandAndWait('managebazaarorders', this.openOutbidOrder, 'Opening outbid order');
    }

    openOutbidOrder() {
        if (!clean(getGuiName()).includes('bazaar orders')) return;
        const slot = this.findOrderSlot(this.target);
        if (slot === -1) {
            if (!this.orderMissingSince) this.orderMissingSince = Date.now();
            if (Date.now() - this.orderMissingSince < STUCK_RETRY_DELAY * 2) return;
            this.orderMissingSince = 0;
            return this.finishOrderCancellation();
        }
        this.orderMissingSince = 0;
        if (this.inventoryFull()) {
            if (this.hasInventoryIncrease()) return this.setAction(this.openTrades, 'Inventory full', 500);
            return this.fail('Inventory is full, but none of it was added by this macro.');
        }
        this.clickAndWait(slot, this.cancelOutbidOrder, 'Opening outbid order');
    }

    cancelOutbidOrder() {
        const gui = clean(getGuiName());
        if (gui.includes('bazaar orders')) {
            if (this.findOrderSlot(this.target) !== -1) return;
            return this.openOutbidOrder();
        }
        if (!gui.includes('order options')) return;
        const slot = this.findSlot('Cancel Order', true);
        if (slot === -1) return;

        const missingLine = lore(Player.getContainer()?.getStackInSlot(slot)).find((line) => /[\d,]+x missing items?/i.test(line));
        const quantity = Number(missingLine?.match(/([\d,]+)x missing items?/i)?.[1]?.replace(/,/g, ''));
        if (!Number.isFinite(quantity) || quantity <= 0) return this.fail('Could not read the remaining quantity before relisting.');

        this.cancelQuantity += quantity;
        const name = clean(this.target.name);
        this.activeTargets = this.activeTargets.filter((active) => clean(active.name) !== name);
        this.orderCheckQueue = this.orderCheckQueue.filter((target) => clean(target.name) !== name);
        this.orderQueue = this.orderQueue.filter((target) => clean(target.name) !== name);

        this.clickAndWait(slot, this.afterOrderCancelled, 'Cancelling outbid order', 500);
    }

    afterOrderCancelled() {
        if (!clean(getGuiName()).includes('bazaar orders')) return;
        const slot = this.findOrderSlot(this.target);
        if (slot !== -1) return this.clickAndWait(slot, this.cancelOutbidOrder, 'Opening duplicate order');
        this.finishOrderCancellation();
    }

    finishOrderCancellation() {
        const target = this.target;
        if (this.cancelQuantity <= 0) return this.orderCheckQueue.length ? this.checkNextOrder() : this.inspectOrder();
        const quantity = Math.min(MAX_ORDER_ITEMS, this.cancelQuantity, Math.floor(this.maxSpend / target.expectedOrderPrice));
        this.cancelQuantity = 0;
        if (quantity > 0) {
            target.quantity = quantity;
            target.profit = (target.npcPrice - target.expectedOrderPrice) * quantity;
            target.profitPercent = ((target.npcPrice - target.expectedOrderPrice) / target.npcPrice) * 100;
        }

        if (quantity > 0 && this.isProfitablePrice(target, target.expectedOrderPrice)) {
            this.orderQueue.unshift(target);
            this.message(`Relisting one &b${quantity.toLocaleString()}x ${target.name}&f order.`);
            return this.placeNextOrder();
        }
        this.skippedIds.add(target.id);
        this.message(`&eSkipping ${target.name}; the new top order is no longer profitable.`);
        if (this.orderCheckQueue.length) return this.checkNextOrder();
        this.inspectOrder();
    }

    openTrades() {
        this.sellEmptySince = 0;
        this.nextTradesRetryAt = Date.now() + STUCK_RETRY_DELAY;
        this.commandAndWait('trades', this.sellItems, 'Opening Trades');
    }

    sellItems() {
        const now = Date.now();
        if (getGuiName() !== 'Trades') {
            if (!this.retryAction && now >= this.nextTradesRetryAt) {
                this.status = 'Reopening Trades';
                this.nextTradesRetryAt = now + (this.runCommand('trades') || STUCK_RETRY_DELAY);
            }
            return;
        }
        this.retryAction = null;
        this.deadline = 0;
        this.nextTradesRetryAt = now + STUCK_RETRY_DELAY;
        const items = Player.getContainer()?.getItems() || [];
        const slot = this.findNewSellSlot(items);
        if (slot !== -1) {
            this.sellEmptySince = 0;
            clickSlot(slot, false, 'LEFT');
            this.status = 'Selling to NPC';
            this.nextActionAt = Date.now() + this.clickDelay;
            return;
        }

        if (!this.sellEmptySince) this.sellEmptySince = now;
        if (now - this.sellEmptySince < 1_000) {
            this.status = 'Finishing NPC sales';
            this.nextActionAt = now + Math.max(250, this.clickDelay);
            return;
        }

        this.lastCheckedInventory = this.inventorySnapshot();
        this.setAction(this.openOrders, 'Checking order prices', 500, 0);
    }

    onChat(event) {
        const message = event?.message?.getUnformattedText?.() ?? event?.message?.getString?.() ?? '';
        if (/^\[Bazaar\] You reached your maximum of [\d,]+ Bazaar orders!$/.test(message)) {
            this.orderLimitReached = true;
            this.orderQueue = [];
            this.message('&eMaximum Bazaar orders reached; monitoring existing orders.');
            return this.setAction(this.openOrders, 'Checking orders', this.clickDelay, 0);
        }
        if (message.includes('[Bazaar] Placing orders is on cooldown for up to 1 minute!')) {
            if (this.action === this.awaitOrderCreated && this.target) this.orderQueue.unshift(this.target);
            this.orderCooldownUntil = Date.now() + 20_000;
            this.message('&eOrder placement is on cooldown; checking existing orders for 20 seconds.');
            return this.setAction(this.openOrders, 'Bazaar order cooldown', this.clickDelay, 0);
        }
        if (this.action !== this.awaitOrderCreated) return;
        if (message.includes('[Bazaar] Buy Order Setup!')) {
            this.target.expectedOrderPrice = this.target.orderPrice;
            this.activeTargets.push(this.target);
            this.setAction(this.placeNextOrder, 'Placing next order', this.clickDelay, 0);
        } else if (/not enough coins|couldn't afford|cannot afford/i.test(message)) {
            this.orderQueue = [];
            if (!this.activeTargets.length) return this.fail('Not enough coins for that order. Lower Maximum Order Spend.');
            this.message('&eNot enough coins for more orders; monitoring the placed orders.');
            this.setAction(this.openOrders, 'Checking orders', this.clickDelay, 0);
        }
    }

    findSlot(name, exact = false) {
        const items = Player.getContainer()?.getItems() || [];
        const upperSize = Math.max(0, items.length - 36);
        const target = clean(name);
        for (let slot = 0; slot < upperSize; slot++) {
            const itemName = clean(items[slot]?.getName?.());
            if ((exact && itemName === target) || (!exact && itemName.includes(target))) return slot;
        }
        return -1;
    }

    scanOpenOrders() {
        const items = Player.getContainer()?.getItems() || [];
        const buyOrders = [];
        let count = 0;
        for (let slot = 0; slot < Math.max(0, items.length - 36); slot++) {
            const stack = items[slot];
            const match = clean(stack?.getName?.()).match(/^(buy|sell) (.+)$/);
            if (!match) continue;
            count++;
            if (match[1] !== 'buy') continue;
            const orderLore = lore(stack);
            const amount = Number(
                orderLore
                    .find((line) => /^order amount:\s*[\d,]+x/i.test(line))
                    ?.match(/[\d,]+/)?.[0]
                    ?.replace(/,/g, '')
            );
            buyOrders.push({
                id: this.skyblockItemId(stack),
                name: ChatLib.removeFormatting(String(stack.getName()))
                    .trim()
                    .replace(/^BUY\s+/i, ''),
                amount,
                price: this.unitPrice(stack),
            });
        }
        this.openBuyOrders = buyOrders;
        this.openOrderCount = count;
    }

    topBuyOrderPrice(item) {
        const prices = lore(item)
            .map((line) => Number(line.match(/^- ([\d,.]+) coins? each\b/i)?.[1]?.replace(/,/g, '')))
            .filter(Number.isFinite);
        return prices.length ? Math.max(...prices) : NaN;
    }

    findOrderSlot(target, excluded = new Set()) {
        const items = Player.getContainer()?.getItems() || [];
        const targetName = clean(target.name);
        let fallback = -1;
        for (let slot = 0; slot < Math.max(0, items.length - 36); slot++) {
            if (excluded.has(slot)) continue;
            const name = clean(items[slot]?.getName?.());
            if (!name.startsWith('buy ') || name.slice(4) !== targetName) continue;
            if (fallback === -1) fallback = slot;
            const price = this.unitPrice(items[slot]);
            if (Number.isFinite(price) && Math.abs(price - target.orderPrice) <= 0.001) return slot;
        }
        return fallback;
    }

    skyblockItemId(item) {
        let data = '';
        try {
            data = String(item?.toMC?.()?.get?.(net.minecraft.core.component.DataComponents.CUSTOM_DATA)?.copyTag?.() || '');
        } catch (error) {}
        if (!data) data = String(item?.getNBT?.() || '');
        return data.match(/\bid\s*[:=]\s*"?([^",}\s]+)/i)?.[1] || null;
    }

    itemKey(item) {
        if (!item) return null;
        let customData = '';
        try {
            customData = String(item.toMC()?.get?.(net.minecraft.core.component.DataComponents.CUSTOM_DATA)?.copyTag?.() || '');
        } catch (error) {}
        if (!customData) customData = String(item.getNBT()).match(/\bid\s*[:=]\s*"?([^",}\s]+)/i)?.[1] || '';
        return `${item.getType().getRegistryName()}|${item.getDamage()}|${customData}`;
    }

    inventorySnapshot(items = Player.getInventory()?.getItems() || []) {
        const snapshot = new Map();
        for (const item of items) {
            const key = this.itemKey(item);
            if (key) snapshot.set(key, (snapshot.get(key) || 0) + Number(item.getStackSize() || 0));
        }
        return snapshot;
    }

    hasInventoryIncrease() {
        for (const [key, count] of this.inventorySnapshot()) {
            if (count > (this.lastCheckedInventory.get(key) || 0)) return true;
        }
        return false;
    }

    inventoryFull() {
        const items = Player.getInventory()?.getItems() || [];
        return items.length >= 36 && items.slice(0, 36).every((item) => item != null);
    }

    findNewSellSlot(items) {
        const groups = new Map();
        for (let slot = 54; slot < items.length; slot++) {
            const item = items[slot];
            const key = this.itemKey(item);
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({
                slot,
                size: Number(item.getStackSize() || 0),
                sellable: lore(item).some((line) => line.includes('Sell Price')),
            });
        }

        for (const [key, stacks] of groups) {
            let reserved = 0;
            const baseline = this.startingInventory.get(key) || 0;
            stacks.sort((a, b) => Number(a.sellable) - Number(b.sellable) || a.size - b.size);
            for (const stack of stacks) {
                if (reserved < baseline) {
                    reserved += stack.size;
                    continue;
                }
                if (stack.sellable) return stack.slot;
            }
        }
        return -1;
    }

    unitPrice(item) {
        const line = lore(item).find((value) => /^(?:price per unit|unit price):\s*[\d,.]+/i.test(value));
        return Number(line?.match(/[\d,.]+/)?.[0]?.replace(/,/g, ''));
    }

    isProfitablePrice(target, price) {
        const profitPerItem = target.npcPrice - price;
        return (
            Number.isFinite(price) &&
            profitPerItem > 0 &&
            profitPerItem >= this.minProfitPerItem &&
            (profitPerItem / target.npcPrice) * 100 >= this.minProfitPercent &&
            profitPerItem * target.quantity * 2 >= this.minItemProfitPerHour &&
            price * target.quantity <= this.maxSpend
        );
    }

    isSafePrice(price) {
        const expectedPrice = Number(this.target.expectedOrderPrice);
        const priceSlack = Math.max(MIN_API_PRICE_SLACK, expectedPrice * MAX_API_PRICE_INCREASE);
        return this.isProfitablePrice(this.target, price) && Number.isFinite(expectedPrice) && price <= expectedPrice + priceSlack;
    }

    retryPrices(message) {
        this.message(`&e${message}`);
        if (this.target?.id) this.skippedIds.add(this.target.id);
        this.setAction(this.placeNextOrder, 'Skipping item', 500, 0);
    }

    restart(message) {
        const startingInventory = this.startingInventory;
        const lastCheckedInventory = this.lastCheckedInventory;
        const cleanupMode = this.cleanupMode;
        this.message(`&e${message} Restarting...`);
        closeInventory();
        this.reset();
        this.startingInventory = startingInventory;
        this.lastCheckedInventory = lastCheckedInventory;
        this.cleanupMode = cleanupMode;
        this.inventoryReady = true;
        this.openOrders();
    }

    fail(message) {
        this.message(`&c${message}`);
        this.toggle(false);
    }
}

new BazaarNpcMacro();
