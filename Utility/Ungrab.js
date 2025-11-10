import { IsCursorLocked, LockCursor } from '../Mixins/UngrabMixin';
import { attachMixin } from './AttachMixin';

class ungrabClass {
    constructor() {
        this.ungrabbed = true;
        this.Regrab();
    }

    Ungrab() {
        if (this.ungrabbed) return;

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

    Regrab() {
        if (!this.ungrabbed) return;
        attachMixin(IsCursorLocked, 'IsCursorLocked', (instance, cir) => {});
        attachMixin(LockCursor, 'LockCursor', (instance, cir) => {});
        if (Player.getPlayer()) Client.getMinecraft().mouse.lockCursor();
        this.ungrabbed = false;
    }
}

export const Mouse = new ungrabClass();
