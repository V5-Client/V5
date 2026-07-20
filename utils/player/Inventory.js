import { Chat } from '../Chat';
import { ServerboundContainerClosePacket } from '../Packets';
import { ScheduleTask } from '../ScheduleTask';
import { Rotations } from './Rotations';

class ItemSearcher {
    stripCodes(text) {
        if (!text || typeof text !== 'string') return text;
        return text.replace(/\u00A7[0-9A-FK-ORa-fk-or]/g, '');
    }

    matchName(item, targetName, exact) {
        if (!item || !item.getName) return false;
        const cleanName = this.stripCodes(item.getName());
        if (!cleanName) return false;

        const lowerName = cleanName.toLowerCase();
        const lowerTarget = targetName.toLowerCase();

        return exact ? lowerName === lowerTarget : lowerName.includes(lowerTarget);
    }

    findInList(inventory, targetName, exact = false) {
        if (!inventory) return -1;
        for (var i = 0; i < inventory.getSize(); i++) {
            const stack = inventory.getStackInSlot(i);
            if (this.matchName(stack, targetName, exact)) {
                return i;
            }
        }
        return -1;
    }

    findAllInList(inventory, targetName) {
        let slots = [];
        if (!inventory) return slots;
        for (var i = 0; i < inventory.getSize(); i++) {
            const stack = inventory.getStackInSlot(i);
            if (this.matchName(stack, targetName, false)) {
                slots.push(i);
            }
        }
        return slots;
    }
}

class InterfaceHandler {
    constructor() {
        this.search = new ItemSearcher();
    }

    getCurrentTitle() {
        const container = Player.getContainer();
        return container ? ChatLib.removeFormatting(container.getName().toString()) : null;
    }

    performClick(slot, shift = false, button = 'LEFT') {
        const container = Player.getContainer();
        if (!container || slot < 0) {
            Chat.message('ClickSlot failed due to no container');
            return false;
        }
        const items = container.getItems();
        if (!items || slot == null || slot < 0 || slot >= items.length) {
            Chat.message('ClickSlot failed due to invalid slot');
            return false;
        }

        container.click(slot, shift, button);
        return true;
    }

    terminateGui() {
        const player = Player.getPlayer();
        if (!player) return;

        try {
            const syncId = Client.getMinecraft().player.containerMenu.containerId;
            if (syncId) {
                Client.sendPacket(new ServerboundContainerClosePacket(syncId));
            }

            if (Client.currentGui) {
                Client.currentGui.close();
            }

            Client.getMinecraft().options.keyAttack.setDown(false);
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }
}

export const handler = new InterfaceHandler();
export const searcher = new ItemSearcher();

export const Guis = {
    stripFormatting: (s) => searcher.stripCodes(s),
    getInventory: () => Player.getInventory(),

    findFirst: function (inv, name) {
        return searcher.findInList(inv, name);
    },

    findAll: function (inv, name) {
        return searcher.findAllInList(inv, name);
    },

    findItemInHotbar: function (name) {
        const inv = Player.getInventory();
        if (!inv) return -1;

        const max = Math.min(inv.getSize(), 9);
        for (var i = 0; i < max; i++) {
            const stack = inv.getStackInSlot(i);
            if (searcher.matchName(stack, name, false)) {
                return i;
            }
        }

        return -1;
    },

    findItemInInventory: function (name) {
        const inv = Player.getInventory();
        return inv ? searcher.findInList(inv, name, false) : -1;
    },

    closeInv: () => handler.terminateGui(),

    clickItem: function (name, shift, button, displayName, exact) {
        const container = Player.getContainer();
        if (!container) return false;

        const items = container.getItems();
        for (var i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item) continue;

            const itemName = displayName !== false ? ChatLib.removeFormatting(String(item.getName())) : String(item.type?.getRegistryName?.() || '');
            if (!itemName) continue;

            const match = exact ? itemName.toLowerCase() === name.toLowerCase() : itemName.toLowerCase().includes(name.toLowerCase());

            if (match) {
                return this.clickSlot(i, shift, button);
            }
        }
        return false;
    },

    clickSlot: function (slot, shift, button) {
        return handler.performClick(slot, shift, button);
    },

    clickItems: function (names, shift, button, displayName, exact) {
        if (!Array.isArray(names)) return false;
        return names.some((name) => this.clickItem(name, shift, button, displayName, exact));
    },

    setItemSlot: function (slot) {
        if (slot >= 0 && slot <= 8) {
            if (Player.getHeldItemIndex() !== slot) {
                ScheduleTask(() => {
                    Player.setHeldItemIndex(slot);
                });
            }
        }
    },

    getHeldItemStackSize: function () {
        const item = Player.getHeldItem();
        return item && item.getStackSize ? item.getStackSize() : 0;
    },

    stopInGui: function () {
        if (handler.getCurrentTitle() !== null) {
            Client.stopMovement();
            Client.setKey('shift', false);
            Client.setKey('leftclick', false);
            Rotations.stop();
        }
    },

    guiName: () => handler.getCurrentTitle(),
};
