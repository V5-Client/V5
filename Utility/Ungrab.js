import { LockCursor, IsCursorLocked, OnCursorPos } from '../Mixins/UngrabMixin';
import { attachMixin } from './AttachMixin';

class ungrabClass {
    constructor() {
        this.ungrabbed = true;
        this.Regrab();
    }

    Ungrab() {
        if (this.ungrabbed) return;

        attachMixin(LockCursor, 'LockCursor', (instance, cir) => {
            if (!this.ungrabbed) return;
            cir.cancel();
        });

        attachMixin(IsCursorLocked, 'IsCursorLocked', (instance, cir) => {
            if (!this.ungrabbed) return;

            if (Client.getMinecraft()?.currentScreen == null) {
                cir.setReturnValue(true);
                cir.cancel();
            }
        });

        attachMixin(OnCursorPos, 'OnCursorPos', (instance, cir) => {
            if (!this.ungrabbed) return;
            cir.cancel();
        });

        this.ungrabbed = true;
    }

    Regrab() {
        if (!this.ungrabbed) return;
        attachMixin(LockCursor, 'LockCursor', (instance, cir) => {});
        attachMixin(IsCursorLocked, 'IsCursorLocked', (instance, cir) => {});
        attachMixin(OnCursorPos, 'OnCursorPos', (instance, cir) => {});
        this.ungrabbed = false;
    }
}

export const Mouse = new ungrabClass();
