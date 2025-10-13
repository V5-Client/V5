import { unlockCursor, setLocked, stopMovement } from '../mixins';

class ungrabClass {
    constructor() {
        this.ungrabbed = true;
        this.Regrab();
    }

    Ungrab() {
        if (this.ungrabbed) return;

        unlockCursor.attach((instance, cir) => {
            if (!this.ungrabbed) return;
            cir.cancel();
        });

        setLocked.attach((instance, cir) => {
            if (!this.ungrabbed) return;

            if (Client.getMinecraft()?.currentScreen == null) {
                cir.setReturnValue(true);
                cir.cancel();
            }
        });

        stopMovement.attach((instance, cir) => {
            if (!this.ungrabbed) return;
            cir.cancel();
        });

        this.ungrabbed = true;
    }

    Regrab() {
        if (!this.ungrabbed) return;
        unlockCursor.attach((instance, cir) => {});
        setLocked.attach((instance, cir) => {});
        stopMovement.attach((instance, cir) => {});
        this.ungrabbed = false;
    }
}

export const Mouse = new ungrabClass();
