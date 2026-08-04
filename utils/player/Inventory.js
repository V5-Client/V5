import { chat } from '../Chat';
import { ServerboundContainerClosePacket } from '../Packets';
import { ScheduleTask } from '../ScheduleTask';

export const stripItemFormatting = (text) => (typeof text === 'string' ? ChatLib.removeFormatting(text) : text);

const itemNameMatches = (item, target, exact = false) => {
    const name = stripItemFormatting(item?.getName?.());
    if (!name) return false;
    return exact ? name.toLowerCase() === target.toLowerCase() : name.toLowerCase().includes(target.toLowerCase());
};

export function findFirstItem(inventory, name, exact = false) {
    if (!inventory) return -1;
    for (let slot = 0; slot < inventory.getSize(); slot++) {
        if (itemNameMatches(inventory.getStackInSlot(slot), name, exact)) return slot;
    }
    return -1;
}

export function findItemInHotbar(name) {
    const inventory = Player.getInventory();
    if (!inventory) return -1;
    for (let slot = 0; slot < Math.min(inventory.getSize(), 9); slot++) {
        if (itemNameMatches(inventory.getStackInSlot(slot), name)) return slot;
    }
    return -1;
}

export function clickSlot(slot, shift = false, button = 'LEFT') {
    const container = Player.getContainer();
    if (!container || slot < 0) {
        chat('ClickSlot failed due to no container');
        return false;
    }
    if (slot == null || slot >= (container.getItems()?.length ?? 0)) {
        chat('ClickSlot failed due to invalid slot');
        return false;
    }
    container.click(slot, shift, button);
    return true;
}

export function clickItem(name, shift, button, displayName = true, exact = false) {
    const items = Player.getContainer()?.getItems();
    if (!items) return false;

    for (let slot = 0; slot < items.length; slot++) {
        const item = items[slot];
        if (!item) continue;
        const itemName = displayName ? ChatLib.removeFormatting(String(item.getName())) : String(item.type?.getRegistryName?.() || '');
        const matches = exact ? itemName.toLowerCase() === name.toLowerCase() : itemName.toLowerCase().includes(name.toLowerCase());
        if (matches) return clickSlot(slot, shift, button);
    }
    return false;
}

export const clickItems = (names, shift, button, displayName, exact) =>
    Array.isArray(names) && names.some((name) => clickItem(name, shift, button, displayName, exact));

export function closeInventory() {
    const player = Player.getPlayer();
    if (!player) return;

    try {
        const containerId = Client.getMinecraft().player.containerMenu.containerId;
        if (containerId) Client.sendPacket(new ServerboundContainerClosePacket(containerId));
        Client.currentGui?.close();
        Client.getMinecraft().options.keyAttack.setDown(false);
    } catch (error) {
        console.error('V5 Caught error' + error + error.stack);
    }
}

export function setItemSlot(slot) {
    if (slot >= 0 && slot <= 8 && Player.getHeldItemIndex() !== slot) ScheduleTask(() => Player.setHeldItemIndex(slot));
}

export function getGuiName() {
    const container = Player.getContainer();
    return container ? ChatLib.removeFormatting(String(container.getName())) : null;
}

export const Guis = {
    clickItems,
    clickSlot,
    closeInv: closeInventory,
    findFirst: findFirstItem,
    guiName: getGuiName,
    setItemSlot,
};
