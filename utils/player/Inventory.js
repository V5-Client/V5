import { Keybind } from '../Keybinding';
import { Rotations } from '../Rotations';
import { Chat } from '../Chat';
import { HandleInputEvents, OnMouseScroll } from '../../Mixins/SlotChangeMixin';
import { attachMixin } from '../AttachMixin';

class InventoryUtilsClass {
    /**
     * Strips Minecraft formatting codes from a string
     * @param {String} str - The string to strip formatting from
     * @returns {String} The string without formatting codes
     */
    stripFormatting(str) {
        return typeof str === 'string' ? str.replace(/\u00A7[0-9A-FK-ORa-fk-or]/g, '') : str;
    }

    /**
     * Gets the player's inventory
     * @returns {Object} The player's inventory or null if not available
     */
    getInventory() {
        return Player.getInventory();
    }

    findFirst(inv, itemn) {
        let inventory = inv;
        for (let i = 0; i < inventory.getSize(); i++) {
            let item = inventory.getStackInSlot(i);
            if (item && item.getName && item.getName().removeFormatting() === itemn) {
                return i; // Returns the slot index where it's found
            }
        }
        return -1; // Not found
    }

    findAll(inv, itemn) {
        let inventory = inv;
        let result = [];
        for (let i = 0; i < inventory.getSize(); i++) {
            let item = inventory.getStackInSlot(i);
            if (item && item.getName && item.getName().removeFormatting() === itemn) {
                result.push(i);
            }
        }
        return result; // Returns an array of all matching slot indices
    }

    /**
     * Finds an item in the hotbar and returns its slot
     * @param {string} itemName - The name of the item to find
     * @returns {number} - The slot of the item, or -1 if not found
     */
    findItemInHotbar(itemName) {
        for (let slot = 0; slot < 8; slot++) {
            let item = Player.getInventory()?.getStackInSlot(slot);
            if (item && item.getName().includes(itemName)) {
                return slot;
            }
        }
        return -1;
    }

    /**
     * Finds an item in the entire inventory, including hotbar, and returns its slot
     * @param {string} itemName - The name of the item to find
     * @returns {number} - The slot of the item, or -1 if not found
     */
    findItemInInventory(itemName) {
        const inventory = Player.getInventory();
        if (!inventory) return -1;

        for (let i = 0; i < inventory.getSize(); i++) {
            const item = inventory.getStackInSlot(i);
            if (item && item.getName && item.getName().includes(itemName)) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Chattriggers closes GUIs client side, this function both closes it client and server side.
     */
    closeInv() {
        if (!Player.getContainer()) return;
        mc = Client.getMinecraft();

        let id = mc.player.currentScreenHandler.syncId;
        Client.sendPacket(new net.minecraft.network.packet.c2s.play.CloseHandledScreenC2SPacket(id));

        Client.currentGui?.close();
    }

    /**
     * Clicks an item with the specified name
     * @param {String} name name to search for
     * @param {Boolean} shift whether shift is being held
     * @param {String} button the mouse button to use
     * @param {Boolean} displayName whether to use display name or registry name
     * @param {Boolean} nameSpecific if true, the name has to exactly match, otherwise it will use includes
     * @returns {Boolean} True if the item was clicked, false otherwise
     * @author Kash MiningModules
     */
    clickItem(name, shift = false, button = 'LEFT', displayName = true, nameSpecific = false) {
        console.log(`Attempting to click on item: ${name}`);

        if (!name || this.guiName() == 'null') return false;

        name = name.toLowerCase();
        const items = Player.getContainer().getItems();
        const slot = items.findIndex((item) => {
            const itemName = displayName ? item?.getName()?.removeFormatting() : item?.type?.getRegistryName();
            const compare = nameSpecific ? itemName?.toLowerCase() === name : itemName?.toLowerCase()?.removeFormatting()?.includes(name);
            return compare;
        });

        if (slot < 0) {
            return false; // item not found
        }

        Player.getContainer().click(slot, shift, button);
        return true;
    }

    /**
     * Clicks the specified slot number
     * @param {Number} slot the slot number to click
     * @param {Boolean} shift whether shift is being held
     * @param {String} button the mouse button to use (MIDDLE by default, or LEFT/RIGHT)
     * @author Kash MiningModules
     */
    clickSlot(slot, shift = false, button = 'LEFT') {
        if (slot == null || slot < 0 || this.guiName() === 'null') return false;
        const container = Player.getContainer();
        const items = container.getItems();
        if (!items || slot >= items.length) return false;
        container.click(slot, shift, button);
        return true;
    }

    /**
     * Loops through an array and clicks the first item it can find.
     * @param {Array<String>} names An array of item names to search for.
     * @param {Boolean} shift Whether shift is being held.
     * @param {String} button The mouse button to use.
     * @param {Boolean} displayName Whether to use display name or registry name.
     * @param {Boolean} nameSpecific If true, the name has to exactly match, otherwise it will use includes.
     * @returns {Boolean} True if all items were attempted to be clicked, false otherwise.
     */
    clickItems(names, shift = false, button = 'LEFT', displayName = true, nameSpecific = false) {
        if (!Array.isArray(names) || names.length === 0) {
            chat.debugMessage('No item names provided or input is not an array.');
            return false;
        }

        let clicked = false;
        for (let i = 0; i < names.length; i++) {
            let name = names[i];
            clicked = this.clickItem(name, shift, button, displayName, nameSpecific);
            if (clicked) {
                return true;
            }
        }
        return false;
    }

    setItemSlot(slot) {
        /*console.log(
            `Swapping hotbar slots from ${Player.getHeldItemIndex()} to ${slot}`
        ); */
        if (slot < 0 || slot > 8) {
            return Chat.message('Invalid slot blocked! Report this ASAP!');
        }

        const currentSlot = Player.getHeldItemIndex();
        if (currentSlot !== slot) {
            Player.setHeldItemIndex(slot);
        }
    }

    getHeldItemStackSize() {
        let item = Player.getHeldItem();
        if (item && item.getStackSize) {
            return item.getStackSize();
        }
        return 0;
    }

    stopInGui() {
        if (this.guiName !== 'null') {
            Keybind.stopMovement();
            Keybind.setKey('shift', false);
            Keybind.setKey('leftclick', false);
            Rotations.stopRotation();
            return;
        }
    }

    /**
     * Gets the name of the current GUI
     * @returns {String} The name of the current GUI
     * @author Kash MiningModules
     */
    guiName() {
        if (!Player.getContainer()) return null;

        return ChatLib.removeFormatting(Player.getContainer().getName().toString());
    }
}

export const Guis = new InventoryUtilsClass();
