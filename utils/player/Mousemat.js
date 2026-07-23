import { ScheduleTask } from '../ScheduleTask';
import { Sign } from '../Sign';
import { Utils } from '../Utils';
import { Guis } from './Inventory';
import { farmingDelays } from '../../modules/farming/FarmingDelays';

const CLICK_COOLDOWN_MS = 3_050;

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

    isAtRotation(yaw, pitch) {
        const player = Player.getPlayer();
        if (!player) return false;

        const yawDifference = Math.abs(((((player.getYRot() - yaw + 180) % 360) + 360) % 360) - 180);
        return yawDifference <= 0.01 && Math.abs(player.getXRot() - pitch) <= 0.01;
    }

    getSelectedRotation(slot) {
        const item = Player.getInventory()?.getStackInSlot(slot);
        const lore = ChatLib.removeFormatting(item?.getLore?.().join('\n') || '');
        const yaw = lore.match(/Selected Yaw: (-?[\d.]+)/);
        const pitch = lore.match(/Selected Pitch: (-?[\d.]+)/);
        return yaw && pitch ? { yaw: Number(yaw[1]), pitch: Number(pitch[1]) } : null;
    }

    rotateTo(yaw, pitch) {
        const targetYaw = (((((yaw + 180) % 360) + 360) % 360) - 180).toFixed(2);
        const targetPitch = Math.max(-90, Math.min(90, pitch)).toFixed(2);

        this.stop();
        if (this.isAtRotation(Number(targetYaw), Number(targetPitch))) {
            const rotation = (this.rotation = { originalSlot: Player.getHeldItemIndex() });
            ScheduleTask(() => this.complete(rotation));
            return true;
        }

        const slot = Guis.findItemInHotbar('Squeaky Mousemat');
        if (slot < 0) return false;

        const rotation = (this.rotation = {
            yaw: targetYaw,
            pitch: targetPitch,
            originalSlot: Player.getHeldItemIndex(),
            waitingForSign: false,
            waitingForClose: false,
        });

        Guis.setItemSlot(slot);
        const selectedRotation = this.getSelectedRotation(slot);
        if (selectedRotation && selectedRotation.yaw === Number(rotation.yaw) && selectedRotation.pitch === Number(rotation.pitch)) {
            this.snap(rotation, this.getActionDelay());
            return true;
        }

        ScheduleTask(this.getActionDelay(), () => {
            if (this.rotation !== rotation) return;

            rotation.waitingForSign = true;
            Client.rightClick();
        });
        return true;
    }

    restore() {
        const slot = Guis.findItemInHotbar('Squeaky Mousemat');
        if (slot < 0) return false;

        this.stop();
        const selectedRotation = this.getSelectedRotation(slot);
        if (!selectedRotation) return false;
        const rotation = (this.rotation = { originalSlot: Player.getHeldItemIndex(), ...selectedRotation });
        Guis.setItemSlot(slot);
        this.snap(rotation, this.getActionDelay());
        return true;
    }

    onComplete(callback) {
        if (typeof callback === 'function') this.callbacks.push(callback);
    }

    getActionDelay() {
        return Utils.randomInt(farmingDelays.mousematActionDelayMin, farmingDelays.mousematActionDelayMax);
    }

    complete(rotation) {
        if (this.rotation !== rotation) return;

        const callbacks = this.callbacks;
        this.rotation = null;
        this.callbacks = [];
        Guis.setItemSlot(rotation.originalSlot);
        callbacks.forEach((callback) => ScheduleTask(callback));
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
            if (!Client.isInGui()) this.snap(rotation, this.getActionDelay());
            return;
        }
        if (!rotation.waitingForSign) return;

        if (!String(Client.currentGui?.getClassName?.() || '').includes('Sign')) return;

        rotation.waitingForSign = false;
        rotation.waitingForClose = true;
        Sign.setLine(1, rotation.yaw);
        Sign.setLine(4, rotation.pitch);
        Client.currentGui.close();
    }

    snap(rotation, delay = 0) {
        if (this.rotation !== rotation) return;

        rotation.waitingForClose = false;
        const checkRotation = (ticks = 1) => {
            if (this.rotation !== rotation) return;
            const yaw = Number(rotation.yaw);
            const pitch = Number(rotation.pitch);
            if (!Number.isFinite(yaw) || !Number.isFinite(pitch) || this.isAtRotation(yaw, pitch)) return this.complete(rotation);
            if (ticks >= 10) return click(true);
            ScheduleTask(() => checkRotation(ticks + 1));
        };
        const click = (retry = false) => {
            if (this.rotation !== rotation) return;

            const cooldown = this.lastClickAt + CLICK_COOLDOWN_MS - Date.now();
            if (!retry && cooldown > 0) return ScheduleTask(Math.ceil(cooldown / 50), click);

            Client.leftClick();
            this.lastClickAt = Date.now();
            ScheduleTask(checkRotation);
        };
        if (delay > 0) ScheduleTask(delay, click);
        else click();
    }
}

export const Mousemat = new MousematController();
