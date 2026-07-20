import { BP, BlockHitResult, Direction, MCHand, Vec3d } from '../Constants';
import { ServerboundUseItemOnPacket } from '../Packets';
import { ScheduleTask } from '../ScheduleTask';
import { Utils, mc } from '../Utils';

class ControlSystem {
    constructor() {
        this.lastActionTime = Date.now();
    }

    isGuiOpen() {
        return Client.isInGui() && !Client.isInChat();
    }

    triggerLeftClick() {
        if (this.isGuiOpen()) return;
        ScheduleTask(() => {
            Client.leftClick();
        });
    }

    triggerRightClick() {
        if (this.isGuiOpen()) return;
        ScheduleTask(() => {
            Client.rightClick();
        });
    }

    updateKeyState(action, isPressed) {
        const guiOpen = this.isGuiOpen();

        if (action === 'leftclick') {
            const attackKey = mc.options.keyAttack;

            if (isPressed && guiOpen) return false;

            if (isPressed) Client.getMinecraft().mouseHandler.grabMouse();

            ScheduleTask(() => {
                attackKey.setDown(!!isPressed);
            });

            return true;
        }

        if (guiOpen && isPressed) return false;

        const options = mc.options;
        const mapping = {
            w: options.keyUp,
            s: options.keyDown,
            a: options.keyLeft,
            d: options.keyRight,
            space: options.keyJump,
            shift: options.keyShift,
            sprint: options.keySprint,
            rightclick: options.keyUse,
        };

        const keyObj = mapping[action];
        if (keyObj) {
            ScheduleTask(() => {
                keyObj.setDown(!!isPressed);
            });
            return true;
        }
        return false;
    }

    checkKeyDown(key) {
        const options = mc.options;
        const mapping = {
            w: options.keyUp,
            s: options.keyDown,
            a: options.keyLeft,
            d: options.keyRight,
            space: options.keyJump,
            shift: options.keyShift,
            leftclick: options.keyAttack,
            sprint: options.keySprint,
            rightclick: options.keyUse,
        };
        return mapping[key] ? mapping[key].isDown() : false;
    }

    setMovementByYaw(yaw, shouldJump) {
        this.haltMovement();
        if (this.isGuiOpen()) return;

        if (yaw > -50 && yaw < 50) this.updateKeyState('w', true);
        if (yaw > -135.5 && yaw < -7) this.updateKeyState('a', true);
        if (yaw > 7 && yaw < 135.5) this.updateKeyState('d', true);
        if (yaw > 135.5 || yaw < -135.5) this.updateKeyState('s', true);

        const motionScale = Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ());
        const timeElapsed = Date.now() - this.lastActionTime;

        if (shouldJump && motionScale < 0.04 && timeElapsed > 500 && Utils.playerIsCollided()) {
            this.updateKeyState('space', true);
            this.refreshCooldown();
        }
    }

    setCardinalMovement(yaw, shouldJump, ignoreBottomSlab) {
        this.haltMovement();
        if (this.isGuiOpen()) return;

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

        for (const q of quadrants) {
            if (yaw >= q.min && yaw <= q.max) {
                q.keys.forEach((key) => this.updateKeyState(key, true));
                break;
            }
        }

        this.updateKeyState('space', shouldJump && Utils.playerIsCollided(!!ignoreBottomSlab));
    }

    setMovementToCoords(x, y, z, shouldJump, ignoreBottomSlab) {
        if (this.isGuiOpen()) return;

        const dx = x - Player.getX();
        const dz = z - Player.getZ();
        let angle = -(Math.atan2(dx, dz) * (180 / Math.PI)) - Player.getYaw();

        while (angle < -180) angle += 360;
        while (angle > 180) angle -= 360;

        this.setCardinalMovement(angle, shouldJump, ignoreBottomSlab);
    }

    haltMovement() {
        const keys = ['w', 'a', 's', 'd', 'space'];
        keys.forEach((key) => this.updateKeyState(key, false));
    }

    fullRelease() {
        this.haltMovement();
        this.updateKeyState('shift', false);
        this.updateKeyState('leftclick', false);
        this.updateKeyState('rightclick', false);
    }

    refreshCooldown() {
        this.lastActionTime = Date.now();
    }
}

const controls = new ControlSystem();

export const Keybind = {
    leftClick: () => controls.triggerLeftClick(),
    rightClick: () => controls.triggerRightClick(),
    setKey: (k, d) => controls.updateKeyState(k, d),
    isKeyDown: (k) => controls.checkKeyDown(k),
    setKeysBasedOnYaw: (y, j) => controls.setMovementByYaw(y, j),
    setKeysForStraightLine: (y, j, ignoreBottomSlab) => controls.setCardinalMovement(y, j, ignoreBottomSlab),
    setKeysForStraightLineCoords: (x, y, z, j, ignoreBottomSlab) => controls.setMovementToCoords(x, y, z, j, ignoreBottomSlab),
    stopMovement: () => controls.haltMovement(),
    unpressKeys: () => controls.fullRelease(),
    isGuiOpen: () => controls.isGuiOpen(),
};
