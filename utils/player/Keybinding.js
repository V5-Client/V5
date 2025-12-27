import { Chat } from '../Chat';
import { Utils, mc } from '../Utils';
import { Vec3d, Direction, BlockHitResult, PlayerInteractBlockC2SPacket } from '../Constants';

const LEFT_CLICK_METHOD = mc.getClass().getDeclaredMethod('method_1536');
const RIGHT_CLICK_METHOD = mc.getClass().getDeclaredMethod('method_1583');
LEFT_CLICK_METHOD.setAccessible(true);
RIGHT_CLICK_METHOD.setAccessible(true);

const BLOCK_POS_CLASS = net.minecraft.util.math.BlockPos;

class ControlSystem {
    constructor() {
        this.guiExitFlag = false;
        this.inputLockoutTicks = 0;
        this.moveCooldown = 0;
        this.lastActionTime = Date.now();
    }

    triggerLeftClick() {
        if (Client.isInGui() && !Client.isInChat()) {
            return Chat.message('Left click suppressed: User in menu.');
        }
        LEFT_CLICK_METHOD.invoke(mc);
    }

    triggerRightClick() {
        if (Client.isInGui() && !Client.isInChat()) {
            return Chat.message('Right click suppressed: User in menu.');
        }
        RIGHT_CLICK_METHOD.invoke(mc);
    }

    delayedRightClick(delayTicks) {
        if (!delayTicks || delayTicks <= 0) {
            this.triggerRightClick();
        } else {
            Client.scheduleTask(delayTicks, () => this.triggerRightClick());
        }
    }

    sendRightClickPacket(delay, x, y, z) {
        const bp = new BLOCK_POS_CLASS(x, y, z);
        const hitResult = new BlockHitResult(new Vec3d(x + 0.5, y + 0.5, z + 0.5), Direction.UP, bp, false);
        const action = () => {
            Client.sendPacket(new PlayerInteractBlockC2SPacket(net.minecraft.util.Hand.MAIN_HAND, hitResult, 0));
        };

        if (!delay || delay <= 0) action();
        else Client.scheduleTask(delay, action);
    }

    updateKeyState(action, isPressed) {
        const guiOpen = Client.isInGui();
        const chatOpen = Client.isInChat();

        if (action === 'leftclick') {
            const attackKey = mc.options.attackKey;
            if (guiOpen || chatOpen) {
                attackKey.setPressed(false);
                if (!this.guiExitFlag) {
                    this.guiExitFlag = true;
                    this.inputLockoutTicks = 0;
                }
                return true;
            }

            if (this.guiExitFlag) {
                this.inputLockoutTicks = 2;
                this.guiExitFlag = false;
            }

            if (this.inputLockoutTicks > 0) {
                attackKey.setPressed(false);
                this.inputLockoutTicks--;
                return true;
            }

            attackKey.setPressed(!!isPressed);
            return true;
        }

        if (guiOpen && !chatOpen) return false;

        const options = mc.options;
        const mapping = {
            w: options.forwardKey,
            s: options.backKey,
            a: options.leftKey,
            d: options.rightKey,
            space: options.jumpKey,
            shift: options.sneakKey,
            sprint: options.sprintKey,
        };

        const keyObj = mapping[action];
        if (keyObj) {
            keyObj.setPressed(!!isPressed);
            return true;
        }
        return false;
    }

    checkKeyDown(key) {
        const options = mc.options;
        const mapping = {
            w: options.forwardKey,
            s: options.backKey,
            a: options.leftKey,
            d: options.rightKey,
            space: options.jumpKey,
            shift: options.sneakKey,
            leftclick: options.attackKey,
            sprint: options.sprintKey,
        };
        return mapping[key] ? mapping[key].isPressed() : false;
    }

    setMovementByYaw(yaw, shouldJump) {
        this.haltMovement();
        if (Client.isInGui() && !Client.isInChat()) return;

        if (yaw > -50 && yaw < 50) this.updateKeyState('w', true);
        if (yaw > -135.5 && yaw < -7) this.updateKeyState('a', true);
        if (yaw > 7 && yaw < 135.5) this.updateKeyState('d', true);
        if (yaw > 135.5 || yaw < -135.5) this.updateKeyState('s', true);

        const motionScale = Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ());
        const timeElapsed = Date.now() - this.lastActionTime;

        if (shouldJump && motionScale < 0.04 && timeElapsed > 500 && Utils.playerIsCollided()) {
            this.updateKeyState('space', true);
        }
    }

    setMovementByYawAlt(yaw, shouldJump) {
        this.haltMovement();
        if (Client.isInGui() && !Client.isInChat()) return;

        if (yaw > -50 && yaw < 50) this.updateKeyState('w', true);
        if (yaw > -135.5 && yaw < -40) this.updateKeyState('a', true);
        if (yaw > 40 && yaw < 135.5) this.updateKeyState('d', true);
        if (yaw > 135.5 || yaw < -135.5) this.updateKeyState('s', true);

        const motionScale = Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ());
        const timeElapsed = Date.now() - this.lastActionTime;

        if (shouldJump && motionScale < 0.02 && timeElapsed > 500 && Utils.playerIsCollided()) {
            this.updateKeyState('space', true);
        }
    }

    setCardinalMovement(yaw, shouldJump) {
        this.haltMovement();
        if (Client.isInGui() && !Client.isInChat()) return;

        const quadrants = [
            { min: -22.5, max: 22.5, keys: ['w'] },
            { min: -67.5, max: -22.5, keys: ['w', 'a'] },
            { min: -112.5, max: -67.5, keys: ['a'] },
            { min: -157.5, max: -112.5, keys: ['a', 's'] },
            { min: -180, max: -157.5, keys: ['s'] },
            { min: 157.5, max: 180, keys: ['s'] },
            { min: 22.5, max: 67.5, keys: ['w', 'd'] },
            { min: 67.5, max: 112.5, keys: ['d'] },
            { min: 112.5, max: 157.5, keys: ['s', 'd'] },
        ];

        for (var i = 0; i < quadrants.length; i++) {
            let q = quadrants[i];
            if (yaw >= q.min && yaw <= q.max) {
                for (var j = 0; j < q.keys.length; j++) {
                    this.updateKeyState(q.keys[j], true);
                }
                break;
            }
        }
    }

    setMovementToCoords(x, y, z, shouldJump) {
        const dx = x - Player.getX();
        const dz = z - Player.getZ();
        let angle = -(Math.atan2(dx, dz) * (180 / Math.PI)) - Player.getYaw();

        while (angle < -180) angle += 360;
        while (angle > 180) angle -= 360;

        this.setCardinalMovement(angle, shouldJump);
    }

    haltMovement() {
        const keys = ['w', 'a', 's', 'd', 'space'];
        for (var i = 0; i < keys.length; i++) {
            this.updateKeyState(keys[i], false);
        }
    }

    fullRelease() {
        this.haltMovement();
        this.updateKeyState('shift', false);
        this.updateKeyState('leftclick', false);
    }

    refreshCooldown() {
        this.lastActionTime = Date.now();
    }
}

const controls = new ControlSystem();

export const Keybind = {
    leftClick: () => controls.triggerLeftClick(),
    rightClick: () => controls.triggerRightClick(),
    rightClickDelay: (t) => controls.delayedRightClick(t),
    rightClickPacket: (t, x, y, z) => controls.sendRightClickPacket(t, x, y, z),
    setKey: (k, d) => controls.updateKeyState(k, d),
    isKeyDown: (k) => controls.checkKeyDown(k),
    setKeysBasedOnYaw: (y, j) => controls.setMovementByYaw(y, j),
    setKeysBasedOnYawTemp: (y, j) => controls.setMovementByYawAlt(y, j),
    setKeysForStraightLine: (y, j) => controls.setCardinalMovement(y, j),
    setKeysForStraightLineCoords: (x, y, z, j) => controls.setMovementToCoords(x, y, z, j),
    setCooldown: () => controls.refreshCooldown(),
    stopMovement: () => controls.haltMovement(),
    unpressKeys: () => controls.fullRelease(),
};
