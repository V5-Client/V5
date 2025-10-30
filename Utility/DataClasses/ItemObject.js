export class ItemObject {
    /**
     * @param {Item} item
     */
    constructor(item, slot) {
        this.name = item?.getName();
        this.lore = item?.getLore();
        this.slot = slot;
    }

    equals(item) {
        return item.name === this.name && item.lore === this.lore && item.slot === this.slot;
    }

    compareName(item) {
        return item.name === this.name;
    }

    getSlot() {
        return this.slot;
    }

    getName() {
        return this.name;
    }

    getLore() {
        return this.lore;
    }
}
