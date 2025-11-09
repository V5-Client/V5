import { IsCursorLocked } from '../Mixins/UngrabMixin';
import { attachMixin } from './AttachMixin';

class ungrabClass {
    constructor() {
        this.ungrabbed = true;
        this.Regrab();
        
        register('command', () => {
            if (this.ungrabbed) {
                this.Regrab();
            } else {
                this.Ungrab();
            }
        }).setName("hi")
    }

    Ungrab() {
        if (this.ungrabbed) return;

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
        this.ungrabbed = false;
    }
}

export const Mouse = new ungrabClass();