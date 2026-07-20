import { Vec3d } from '../../utils/Constants';
import { Camera } from '../../utils/Camera';
import { Mixin } from '../../utils/MixinManager';
import { ModuleBase } from '../../utils/ModuleBase';
import { MathUtils } from '../../utils/Math';
import { Mouse } from '../../utils/Ungrab';
import { mc } from '../../utils/Utils';

const Perspective = net.minecraft.client.CameraType;
const InputConstants = com.mojang.blaze3d.platform.InputConstants;
const THIRD_PERSON_DISTANCE = 4.0;

class Freecam extends ModuleBase {
    constructor() {
        super({
            name: 'Freecam',
            subcategory: 'Visuals',
            description: 'Detach your camera and fly it around locally.',
            tooltip: 'Client-side freecam.',
            theme: '#5fb0ff',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
        });

        this.bindToggleKey();

        this.moveSpeed = 10;
        this.cameraPos = null;
        this.velocity = new Vec3d(0, 0, 0);
        this.savedPerspective = null;
        this.lastRenderAt = 0;

        this.addSlider('Move Speed', 10, 35, 20, (value) => (this.moveSpeed = Number(value) / 25), 'Freecam move speed.');

        this.on('renderWorld', () => this.onRender());
    }

    onEnable() {
        const player = Player.getPlayer();
        if (!World.isLoaded() || !player) {
            this.cameraPos = null;
            this.velocity = new Vec3d(0, 0, 0);
            this.savedPerspective = null;
            Mixin.set('freecamEnabled', false);
            Camera.clearCameraPosition();
            Mixin.delete('cameraOverrideYaw');
            Mixin.delete('cameraOverridePitch');
            return;
        }

        this.message('&aEnabled');
        this.cameraPos = this.getInitialCameraPos(player, MathUtils.wrapTo180(player.getYRot()), player.getXRot());
        this.velocity = new Vec3d(0, 0, 0);
        this.savedPerspective = mc.options.getCameraType();
        this.lastRenderAt = Date.now();
        Mouse.forceGrab();
        Mixin.set('cameraOverrideYaw', MathUtils.wrapTo180(player.getYRot()));
        Mixin.set('cameraOverridePitch', player.getXRot());
        Mixin.set('freecamEnabled', true);
        mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
        Camera.setCameraPosition(this.cameraPos);
    }

    onDisable() {
        this.message('&cDisabled');
        this.cameraPos = null;
        this.velocity = new Vec3d(0, 0, 0);
        Mixin.set('freecamEnabled', false);
        Mixin.delete('cameraOverrideYaw');
        Mixin.delete('cameraOverridePitch');
        Camera.clearCameraPosition();

        if (this.savedPerspective) {
            mc.options.setCameraType(this.savedPerspective);
        }

        this.savedPerspective = null;
        Mouse.releaseForcedGrab();
    }

    onRender() {
        if (!this.enabled) return;
        if (!World.isLoaded()) return;

        const player = Player.getPlayer();
        if (!player) return;

        if (!this.cameraPos) {
            this.cameraPos = this.getInitialCameraPos(player, MathUtils.wrapTo180(player.getYRot()), player.getXRot());
        }

        if (mc.options.getCameraType() !== Perspective.THIRD_PERSON_BACK) {
            mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
        }

        const options = mc.options;
        const yaw = (Number(Mixin.get('cameraOverrideYaw', player.getYRot())) * Math.PI) / 180;

        let moveX = 0;
        let moveY = 0;
        let moveZ = 0;

        const forwardX = -Math.sin(yaw);
        const forwardZ = Math.cos(yaw);
        const leftX = Math.cos(yaw);
        const leftZ = Math.sin(yaw);

        if (this.isKeyDown(options.keyUp)) {
            moveX += forwardX;
            moveZ += forwardZ;
        }
        if (this.isKeyDown(options.keyDown)) {
            moveX -= forwardX;
            moveZ -= forwardZ;
        }
        if (this.isKeyDown(options.keyLeft)) {
            moveX += leftX;
            moveZ += leftZ;
        }
        if (this.isKeyDown(options.keyRight)) {
            moveX -= leftX;
            moveZ -= leftZ;
        }
        if (this.isKeyDown(options.keyJump)) {
            moveY += 1;
        }
        if (this.isKeyDown(options.keyShift)) {
            moveY -= 1;
        }

        const magnitude = Math.hypot(moveX, moveY, moveZ) || 1;
        const hasInput = Math.abs(moveX) > 0 || Math.abs(moveY) > 0 || Math.abs(moveZ) > 0;

        const targetSpeed = this.moveSpeed;
        const targetX = hasInput ? (moveX / magnitude) * targetSpeed : 0;
        const targetY = hasInput ? (moveY / magnitude) * targetSpeed : 0;
        const targetZ = hasInput ? (moveZ / magnitude) * targetSpeed : 0;

        const now = Date.now();
        const frames = Math.min(5, Math.max(0.1, (now - this.lastRenderAt) / 10));
        this.lastRenderAt = now;
        const smoothing = 1 - Math.pow(hasInput ? 0.65 : 0.88, frames);

        this.velocity = new Vec3d(
            this.velocity.x() + (targetX - this.velocity.x()) * smoothing,
            this.velocity.y() + (targetY - this.velocity.y()) * smoothing,
            this.velocity.z() + (targetZ - this.velocity.z()) * smoothing
        );

        const velocityMagnitude = Math.hypot(this.velocity.x(), this.velocity.y(), this.velocity.z());
        if (velocityMagnitude < 0.0005) {
            this.velocity = new Vec3d(0, 0, 0);
            Camera.setCameraPosition(this.cameraPos);
            return;
        }

        this.cameraPos = new Vec3d(
            this.cameraPos.x() + this.velocity.x() * frames,
            this.cameraPos.y() + this.velocity.y() * frames,
            this.cameraPos.z() + this.velocity.z() * frames
        );

        Camera.setCameraPosition(this.cameraPos);
    }

    isKeyDown(keybind) {
        return mc.screen == null && InputConstants.isKeyDown(mc.getWindow(), InputConstants.getKey(keybind.saveString()).getValue());
    }

    getInitialCameraPos(player, yaw, pitch) {
        const eyePos = player.getEyePosition();
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pitch * Math.PI) / 180;
        const cosPitch = Math.cos(pitchRad);
        const lookX = -Math.sin(yawRad) * cosPitch;
        const lookY = -Math.sin(pitchRad);
        const lookZ = Math.cos(yawRad) * cosPitch;

        return new Vec3d(eyePos.x() - lookX * THIRD_PERSON_DISTANCE, eyePos.y() - lookY * THIRD_PERSON_DISTANCE, eyePos.z() - lookZ * THIRD_PERSON_DISTANCE);
    }
}

new Freecam();
