import { Chat } from './Chat';
import { Time } from './Timing';
import { Utils } from './Utils';
import { mc } from './Utils';
import { Vec3d } from './Constants';

const LeftClickMouse = mc.getClass().getDeclaredMethod('method_1536');
LeftClickMouse.setAccessible(true);

const RightClickMouse = mc.getClass().getDeclaredMethod('method_1583');
RightClickMouse.setAccessible(true);

const BP = net.minecraft.util.math.BlockPos;

let justExitedGui = false;
let clickReenableTimer = 0;

class Keybinding {
    /**
     * Performs a left click using ChatTriggers API instead of reflection
     * @returns {boolean} Success status
     */
    leftClick() {
        if (Client.isInGui() && !Client.isInChat()) return Chat.message('Attempted left click while in GUI. Report this ASAP!');
        LeftClickMouse.invoke(mc);
    }

    /**
     * Performs a right click using ChatTriggers API instead of reflection
     * @returns {boolean} Success status
     */
    rightClick() {
        if (Client.isInGui() && !Client.isInChat()) return Chat.message('Attempted right click while in GUI. Report this ASAP!');
        RightClickMouse.invoke(mc);
    }

    /**
     * Right clicks with a specified amount of ticks using proper scheduling
     * @param {number} ticks - Number of ticks to delay (default: 0)
     * @returns {boolean} Success status
     */
    rightClickDelay(ticks = 0) {
        if (ticks === 0) {
            this.rightClick();
        } else {
            Client.scheduleTask(ticks, () => {
                this.rightClick();
            });
        }
    }

    /**
     * Sends a right click packet
     * @param {*} ticks
     */
    rightClickPacket(ticks = 0, x, y, z) {
        let blockPos = new BP(x, y, z);
        let direction = net.minecraft.util.math.Direction.UP;
        let hitVec = new Vec3d(x + 0.5, y + 0.5, z + 0.5);

        let blockHitResult = new net.minecraft.util.hit.BlockHitResult(hitVec, direction, blockPos, false);

        let hand = net.minecraft.util.Hand.MAIN_HAND;
        let sequence = 0;

        if (ticks === 0) {
            Client.sendPacket(new net.minecraft.network.packet.c2s.play.PlayerInteractBlockC2SPacket(hand, blockHitResult, sequence));
        } else {
            Client.scheduleTask(ticks, () => {
                Client.sendPacket(new net.minecraft.network.packet.c2s.play.PlayerInteractBlockC2SPacket(hand, blockHitResult, sequence));
            });
        }
    }

    /**
     * @param {string} key - Key identifier
     * @param {boolean} down - Whether the key should be pressed
     * @returns {boolean} Success status
     */
    setKey(key, down) {
        let isGuiOpen = Client.isInGui();
        let isChatOpen = Client.isInChat();
        let shouldBlockInput = isGuiOpen || isChatOpen;

        if (key === 'leftclick') {
            const attackKey = mc.options.attackKey;

            if (shouldBlockInput) {
                attackKey.setPressed(false);

                if (!justExitedGui) {
                    justExitedGui = true;
                    clickReenableTimer = 0;
                }
                return true;
            }

            if (justExitedGui) {
                if (clickReenableTimer === 0) clickReenableTimer = 2;
                justExitedGui = false;
            }

            if (clickReenableTimer > 0) {
                attackKey.setPressed(false);
                clickReenableTimer--;
                return true;
            }

            attackKey.setPressed(down);
            return true;
        }

        if (isGuiOpen && !isChatOpen) return false;

        const keyMap = {
            a: mc.options.leftKey,
            d: mc.options.rightKey,
            s: mc.options.backKey,
            w: mc.options.forwardKey,
            space: mc.options.jumpKey,
            shift: mc.options.sneakKey,
            sprint: mc.options.sprintKey,
        };

        const targetKey = keyMap[key];
        if (targetKey) {
            targetKey.setPressed(down);
            return true;
        }
        return false;
    }

    /**
     * @param {string} key - Key identifier
     * @returns {boolean} Whether the key is pressed
     */
    isKeyDown(key) {
        const keyMap = {
            a: mc.options.leftKey,
            d: mc.options.rightKey,
            s: mc.options.backKey,
            w: mc.options.forwardKey,
            space: mc.options.jumpKey,
            shift: mc.options.sneakKey,
            leftclick: mc.options.attackKey,
            sprint: mc.options.sprintKey,
        };
        return keyMap[key] ? keyMap[key].isPressed() : false;
    }

    setKeysBasedOnYaw(yaw, jump = true) {
        this.stopMovement();
        if (Client.isInGui() && !Client.isInChat()) return;
        if (yaw >= -50.0 && yaw <= 50.0) this.setKey('w', true);
        if (yaw >= -135.5 && yaw <= -7.0) this.setKey('a', true);
        if (yaw >= 7.0 && yaw <= 135.5) this.setKey('d', true);
        if (yaw <= -135.5 || yaw >= 135.5) this.setKey('s', true);

        this.setKey(
            'space',
            Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.04 && this.cooldown.hasReached(500) && jump && Utils.playerIsCollided()
        );
    }

    setKeysBasedOnYawTemp(yaw, jump = true) {
        this.stopMovement();
        if (Client.isInGui() && !Client.isInChat()) return;
        if (yaw >= -50.0 && yaw <= 50.0) this.setKey('w', true);
        if (yaw >= -135.5 && yaw <= -40.0) this.setKey('a', true);
        if (yaw >= 40.0 && yaw <= 135.5) this.setKey('d', true);
        if (yaw <= -135.5 || yaw >= 135.5) this.setKey('s', true);

        this.setKey(
            'space',
            Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) < 0.02 && this.cooldown.hasReached(500) && jump && Utils.playerIsCollided()
        );
    }

    setKeysForStraightLine(yaw, jump = false) {
        this.stopMovement();
        if (Client.isInGui() && !Client.isInChat()) return;
        if (22.5 > yaw && yaw > -22.5) {
            // Forwards
            this.setKey('w', true);
        } else if (-22.5 > yaw && yaw > -67.5) {
            // Forwards+Right
            this.setKey('w', true);
            this.setKey('a', true);
        } else if (-67.5 > yaw && yaw > -112.5) {
            // Right
            this.setKey('a', true);
        } else if (-112.5 > yaw && yaw > -157.5) {
            // Backwards + Right
            this.setKey('a', true);
            this.setKey('s', true);
        } else if ((-157.5 > yaw && yaw > -180) || (180 > yaw && yaw > 157.5)) {
            // Backwards
            this.setKey('s', true);
        } else if (67.5 > yaw && yaw > 22.5) {
            // Forwards + Left
            this.setKey('w', true);
            this.setKey('d', true);
        } else if (112.5 > yaw && yaw > 67.5) {
            // Left
            this.setKey('d', true);
        } else if (157.5 > yaw && yaw > 112.5) {
            // Backwards+Left
            this.setKey('s', true);
            this.setKey('d', true);
        }
        /*this.setKey(
            'space',
            Player.asPlayerMP().isInWater() ||
                (Math.abs(Player.getMotionX()) + Math.abs(Player.getMotionZ()) <
                    0.02 &&
                    this.cooldown.hasReached(500) &&
                    jump) //&&
            // Utils.playerIsCollided()
        ); */
    }

    setKeysForStraightLineCoords(x, y, z, jump = false) {
        const dx = x - Player.getX();
        const dz = z - Player.getZ();
        let yaw = -(Math.atan2(dx, dz) * (180.0 / Math.PI)) - Player.getYaw();
        if (yaw < -180) yaw += 360;
        if (yaw > 180) yaw += -360;
        this.setKeysForStraightLine(yaw, jump);
    }

    setCooldown() {
        this.cooldown.reset();
    }

    stopMovement() {
        this.setKey('a', false);
        this.setKey('s', false);
        this.setKey('d', false);
        this.setKey('w', false);
        this.setKey('space', false);
    }

    unpressKeys() {
        this.stopMovement();
        this.setKey('shift', false);
    }
}

export const Keybind = new Keybinding();
