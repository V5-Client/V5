import { Vec3d } from '../../utils/Constants';
import { Camera } from '../../utils/Camera';
import { Mixin } from '../../utils/MixinManager';
import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';
import { mc } from '../../utils/Utils';

const STEP_FPS = 100;
const STEP_SCALE = 20 / STEP_FPS;
const Perspective = net.minecraft.client.option.Perspective;
const THIRD_PERSON_DISTANCE = 4.0;

class Freecam extends ModuleBase {
    constructor() {
        super({
            name: 'Freecam',
            subcategory: 'Other',
            description: 'Detach your camera and fly it around locally.',
            tooltip: 'Client-side freecam.',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
        });

        this.bindToggleKey();
        this.setTheme('#5fb0ff');

        this.moveSpeed = 1.2;
        this.cameraPos = null;
        this.velocity = new Vec3d(0, 0, 0);
        this.savedPerspective = null;

        this.addSlider('Move Speed', 1, 30, Math.round(this.moveSpeed * 5), (value) => (this.moveSpeed = Number(value) / 5), 'Freecam move speed.');

        this.on('step', () => this.onTick()).setFps(STEP_FPS);
    }

    onEnable() {
        const player = Player.getPlayer();
        if (!World.isLoaded() || !player) {
            this.cameraPos = null;
            this.velocity = new Vec3d(0, 0, 0);
            this.savedPerspective = null;
            Mixin.set('freecamEnabled', false);
            Camera.clearCameraPosition();
            Mixin.delete('freecamFrozenYaw');
            Mixin.delete('freecamFrozenPitch');
            Mixin.delete('cameraOverrideYaw');
            Mixin.delete('cameraOverridePitch');
            return;
        }

        this.message('Enabled');
        this.cameraPos = this.getInitialCameraPos(player, player.getYaw(), player.getPitch());
        this.velocity = new Vec3d(0, 0, 0);
        this.savedPerspective = mc.options.getPerspective();
        Keybind.unpressKeys();
        Mixin.set('freecamEnabled', true);
        Mixin.delete('freecamFrozenYaw');
        Mixin.delete('freecamFrozenPitch');
        Mixin.delete('cameraOverrideYaw');
        Mixin.delete('cameraOverridePitch');
        mc.options.setPerspective(Perspective.THIRD_PERSON_BACK);
        Camera.setCameraPosition(this.cameraPos);
    }

    onDisable() {
        this.message('Disabled');
        this.cameraPos = null;
        this.velocity = new Vec3d(0, 0, 0);
        Keybind.unpressKeys();
        Mixin.set('freecamEnabled', false);
        Mixin.delete('freecamFrozenYaw');
        Mixin.delete('freecamFrozenPitch');
        Mixin.delete('cameraOverrideYaw');
        Mixin.delete('cameraOverridePitch');
        Camera.clearCameraPosition();

        if (this.savedPerspective) {
            mc.options.setPerspective(this.savedPerspective);
        }

        this.savedPerspective = null;
    }

    onTick() {
        if (!this.enabled) return;
        if (!World.isLoaded()) return;

        const player = Player.getPlayer();
        if (!player) return;

        if (!this.cameraPos) {
            this.cameraPos = this.getInitialCameraPos(player, player.getYaw(), player.getPitch());
        }

        if (mc.options.getPerspective() !== Perspective.THIRD_PERSON_BACK) {
            mc.options.setPerspective(Perspective.THIRD_PERSON_BACK);
        }

        const options = mc.options;
        const yaw = (player.getYaw() * Math.PI) / 180;

        let moveX = 0;
        let moveY = 0;
        let moveZ = 0;

        const forwardX = -Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const leftX = Math.cos(yaw);
        const leftZ = Math.sin(yaw);

        if (options.forwardKey.isPressed()) {
            moveX += forwardX;
            moveZ += forwardZ;
        }
        if (options.backKey.isPressed()) {
            moveX -= forwardX;
            moveZ -= forwardZ;
        }
        if (options.leftKey.isPressed()) {
            moveX += leftX;
            moveZ += leftZ;
        }
        if (options.rightKey.isPressed()) {
            moveX -= leftX;
            moveZ -= leftZ;
        }
        if (options.jumpKey.isPressed()) {
            moveY += 1;
        }
        if (options.sneakKey.isPressed()) {
            moveY -= 1;
        }

        const magnitude = Math.hypot(moveX, moveY, moveZ) || 1;
        const hasInput = Math.abs(moveX) > 0 || Math.abs(moveY) > 0 || Math.abs(moveZ) > 0;

        const targetSpeed = this.moveSpeed * STEP_SCALE;
        const targetX = hasInput ? (moveX / magnitude) * targetSpeed : 0;
        const targetY = hasInput ? (moveY / magnitude) * targetSpeed : 0;
        const targetZ = hasInput ? (moveZ / magnitude) * targetSpeed : 0;

        const smoothing = hasInput ? 0.35 : 0.12;

        this.velocity = new Vec3d(
            this.velocity.x + (targetX - this.velocity.x) * smoothing,
            this.velocity.y + (targetY - this.velocity.y) * smoothing,
            this.velocity.z + (targetZ - this.velocity.z) * smoothing
        );

        const velocityMagnitude = Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z);
        if (velocityMagnitude < 0.0005) {
            this.velocity = new Vec3d(0, 0, 0);
            Camera.setCameraPosition(this.cameraPos);
            return;
        }

        this.cameraPos = new Vec3d(this.cameraPos.x + this.velocity.x, this.cameraPos.y + this.velocity.y, this.cameraPos.z + this.velocity.z);

        Camera.setCameraPosition(this.cameraPos);
    }

    getInitialCameraPos(player, yaw, pitch) {
        const eyePos = player.getEyePos();
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pitch * Math.PI) / 180;
        const cosPitch = Math.cos(pitchRad);
        const lookX = -Math.sin(yawRad) * cosPitch;
        const lookY = -Math.sin(pitchRad);
        const lookZ = Math.cos(yawRad) * cosPitch;

        return new Vec3d(eyePos.x - lookX * THIRD_PERSON_DISTANCE, eyePos.y - lookY * THIRD_PERSON_DISTANCE, eyePos.z - lookZ * THIRD_PERSON_DISTANCE);
    }
}

new Freecam();
