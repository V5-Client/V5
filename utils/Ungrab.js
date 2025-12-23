import { IsCursorLocked, LockCursor, UpdateMouse } from '../mixins/UngrabMixin';
import { HandleInputEvents, OnMouseScroll } from '../mixins/SlotChangeMixin';
import { attachMixin } from './AttachMixin';

class UngrabManager {
    constructor() {
        this.ungrabbed = false;
        this.inputLocked = false;
        this.mixinsInitialized = false;

        this.initMixins();
    }

    /**
     * Attaches all necessary mixins with logic that checks the current state.
     */
    initMixins() {
        if (this.mixinsInitialized) return;

        attachMixin(HandleInputEvents, 'HandleInputEvents', (instance) => {
            if (!this.inputLocked) return;

            instance.options.hotbarKeys.forEach((key) => {
                if (key.wasPressed()) key.setPressed(false);
            });
        });

        attachMixin(OnMouseScroll, 'OnMouseScroll', (instance, cir) => {
            if (this.inputLocked && Client.getMinecraft().world) {
                cir.cancel();
            }
        });

        attachMixin(LockCursor, 'LockCursor', (instance, cir) => {
            if (this.ungrabbed) cir.cancel();
        });

        attachMixin(UpdateMouse, 'UpdateMouse', (instance, cir) => {
            if (this.ungrabbed) {
                Client.getMinecraft().mouse.unlockCursor();
                cir.cancel();
            }
        });

        this.mixinsInitialized = true;
    }

    /**
     * Prevents the player from controlling the camera and locks inventory interaction.
     */
    ungrab() {
        if (this.ungrabbed) return;

        this.ungrabbed = true;
        this.inputLocked = true;
    }

    /**
     * Returns control to the player.
     */
    regrab() {
        if (!this.ungrabbed) return;

        this.ungrabbed = false;
        this.inputLocked = false;

        if (Player.getPlayer()) Client.getMinecraft().mouse.lockCursor();
    }
}

export const Mouse = new UngrabManager();
