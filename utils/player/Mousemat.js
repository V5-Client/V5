import { ScheduleTask } from '../ScheduleTask';
import { Sign } from '../Sign';
import { Guis } from './Inventory';
import { Keybind } from './Keybinding';

const CLICK_COOLDOWN_MS = 6_000;

class MousematController {
    constructor() {
        this.rotation = null;
        this.callbacks = [];
        this.lastClickAt = 0;
        register('tick', () => this.tick());
    }

    get active() {
        return this.rotation !== null;
    }

    rotateTo(yaw, pitch) {
        const slot = Guis.findItemInHotbar('Squeaky Mousemat');
        if (slot < 0) return false;

        this.stop();
        const rotation = (this.rotation = {
            yaw: (((((yaw + 180) % 360) + 360) % 360) - 180).toFixed(2),
            pitch: Math.max(-90, Math.min(90, pitch)).toFixed(2),
            originalSlot: Player.getHeldItemIndex(),
            waitingForSign: false,
            waitingForClose: false,
        });

        Guis.setItemSlot(slot);
        const item = Player.getInventory()?.getStackInSlot(slot);
        const lore = ChatLib.removeFormatting(item?.getLore?.().join('\n') || '');
        const selectedYaw = lore.match(/Selected Yaw: (-?[\d.]+)/);
        const selectedPitch = lore.match(/Selected Pitch: (-?[\d.]+)/);
        if (selectedYaw && selectedPitch && Number(selectedYaw[1]) === Number(rotation.yaw) && Number(selectedPitch[1]) === Number(rotation.pitch)) {
            this.snap(rotation, 6);
            return true;
        }

        ScheduleTask(6, () => {
            if (this.rotation !== rotation) return;

            rotation.waitingForSign = true;
            Keybind.rightClick();
        });
        return true;
    }

    restore() {
        const slot = Guis.findItemInHotbar('Squeaky Mousemat');
        if (slot < 0) return false;

        this.stop();
        const rotation = (this.rotation = { originalSlot: Player.getHeldItemIndex() });
        Guis.setItemSlot(slot);
        this.snap(rotation, 6);
        return true;
    }

    onComplete(callback) {
        if (typeof callback === 'function') this.callbacks.push(callback);
    }

    stop() {
        if (this.rotation) Guis.setItemSlot(this.rotation.originalSlot);
        this.rotation = null;
        this.callbacks = [];
    }

    tick() {
        const rotation = this.rotation;
        if (!rotation) return;
        if (rotation.waitingForClose) {
            if (!Client.isInGui()) this.snap(rotation, 6);
            return;
        }
        if (!rotation.waitingForSign) return;

        const gui = Client.currentGui;
        const screen = gui && gui.get ? gui.get() : null;
        if (!screen || !screen.class || !String(screen.class.simpleName || '').includes('Sign')) return;

        rotation.waitingForSign = false;
        rotation.waitingForClose = true;
        Sign.setLine(1, rotation.yaw);
        Sign.setLine(4, rotation.pitch);
        gui.close();
    }

    snap(rotation, delay = 0) {
        if (this.rotation !== rotation) return;

        rotation.waitingForClose = false;
        const click = () => {
            if (this.rotation !== rotation) return;

            const cooldown = this.lastClickAt + CLICK_COOLDOWN_MS - Date.now();
            if (cooldown > 0) return ScheduleTask(Math.ceil(cooldown / 50), click);

            Keybind.leftClick();
            this.lastClickAt = Date.now();
            ScheduleTask(2, () => {
                if (this.rotation !== rotation) return;

                const callbacks = this.callbacks;
                this.rotation = null;
                this.callbacks = [];
                Guis.setItemSlot(rotation.originalSlot);
                callbacks.forEach((callback) => ScheduleTask(callback));
            });
        };
        if (delay > 0) ScheduleTask(delay, click);
        else click();
    }
}

export const Mousemat = new MousematController();
