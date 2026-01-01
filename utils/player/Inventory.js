import { Keybind } from './Keybinding';
import { Rotations } from './Rotations';
import { Chat } from '../Chat';
import { CloseHandledScreenC2S } from '../Packets';

class ItemSearcher {
    constructor() {}

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

        return exact ? lowerName === lowerTarget : lowerName.indexOf(lowerTarget) !== -1;
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
        if (!inventory) return -1;
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
        if (!container) return null;
        return ChatLib.removeFormatting(container.getName().toString());
    }

    performClick(slot, shift = false, button = 'LEFT') {
        const container = Player.getContainer();
        if (!container || slot < 0) {
            Chat.message('ClickSlot failed due to no container');
            return false;
        }
        const items = container.getItems();
        if (!items || !slot || slot >= items.length) {
            Chat.message('ClickSlot failed due to invalid slot');
            return false;
        }

        container.click(slot, shift, button);
        return true;
    }

    terminateGui() {
        const player = Player.getPlayer();
        if (!player || !Player.getContainer()) return;

        try {
            const syncId = Client.getMinecraft().player.currentScreenHandler.syncId;
            Client.sendPacket(new CloseHandledScreenC2S(syncId));

            if (Client.currentGui) {
                Client.currentGui.close();
            }

            Client.getMinecraft().options.attackKey.setPressed(false);
        } catch (err) {}
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

            const itemName = displayName !== false ? ChatLib.removeFormatting(String(item.getName())) : String(item.type.getRegistryName());

            const match = exact ? itemName.toLowerCase() === name.toLowerCase() : itemName.toLowerCase().indexOf(name.toLowerCase()) !== -1;

            if (match) {
                this.clickSlot(i, shift, button);
                return true;
            }
        }
        return false;
    },

    clickSlot: function (slot, shift, button) {
        return handler.performClick(slot, shift, button);
    },

    clickItems: function (names, shift, button, displayName, exact) {
        if (!Array.isArray(names)) return false;
        for (var i = 0; i < names.length; i++) {
            if (this.clickItem(names[i], shift, button, displayName, exact)) {
                return true;
            }
        }
        return false;
    },

    setItemSlot: function (slot) {
        if (slot >= 0 && slot <= 8) {
            if (Player.getHeldItemIndex() !== slot) {
                Player.setHeldItemIndex(slot);
            }
        }
    },

    getHeldItemStackSize: function () {
        const item = Player.getHeldItem();
        return item && item.getStackSize ? item.getStackSize() : 0;
    },

    stopInGui: function () {
        if (handler.getCurrentTitle() !== null) {
            Keybind.stopMovement();
            Keybind.setKey('shift', false);
            Keybind.setKey('leftclick', false);
            Rotations.stopRotation();
        }
    },

    guiName: () => handler.getCurrentTitle(),
};

console.log(searcher.findInList(Player.getInventory(), 'hype'));
