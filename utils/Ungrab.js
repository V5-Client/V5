import { IsCursorLocked, LockCursor } from '../mixins/UngrabMixin';
import { HandleInputEvents, OnMouseScroll } from '../mixins/SlotChangeMixin';
import { attachMixin } from './AttachMixin';

class ungrabClass {
    constructor() {
        this.ungrabbed = true;
        this.inputLocked = false;
        this.mixinsInitialized = false;
        this.regrab();
    }

    /**
     * Prevents the player from interacting with the inventory.
     */
    initMixins() {
        if (this.mixinsInitialized) return;

        attachMixin(HandleInputEvents, 'HandleInputEvents', (instance, cir) => {
            if (!this.inputLocked) return;

            let hotbarKeys = instance.options.hotbarKeys;
            for (const key of hotbarKeys) {
                if (key.wasPressed()) key.setPressed(false);
            }
        });

        attachMixin(OnMouseScroll, 'OnMouseScroll', (instance, cir) => {
            if (!this.inputLocked) return;

            if (Client.getMinecraft().world != null) {
                cir.cancel();
            }
        });

        this.mixinsInitialized = true;
    }

    /**
     * Allows the player to interact with the inventory.
     */
    EnableUserInput() {
        this.inputLocked = false;
    }

    /**
     * Attaches both mixins to prevent mouse input by the player.
     */
    ungrab() {
        if (this.ungrabbed) return;

        this.initMixins();
        this.inputLocked = true;

        attachMixin(LockCursor, 'LockCursor', (instance, cir) => {
            cir.cancel();
        });

        attachMixin(IsCursorLocked, 'IsCursorLocked', (instance, cir) => {
            Client.getMinecraft().mouse.unlockCursor();
            cir.setReturnValue(false);
            cir.cancel();
        });

        this.ungrabbed = true;
    }

    /**
     * Resets both mixins to reallow mouse input by the player.
     */
    regrab() {
        if (!this.ungrabbed) return;
        attachMixin(IsCursorLocked, 'IsCursorLocked', (instance, cir) => {});
        attachMixin(LockCursor, 'LockCursor', (instance, cir) => {});
        this.EnableUserInput();
        if (Player.getPlayer()) Client.getMinecraft().mouse.lockCursor();
        this.ungrabbed = false;
    }
}

export const Mouse = new ungrabClass();
