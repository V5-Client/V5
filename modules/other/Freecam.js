import { ClipContext, GLFW, Vec3d } from '../../utils/Constants';
import { clearCameraPosition, setCameraPosition } from '../../utils/Camera';
import { ModuleBase } from '../../utils/ModuleBase';
import { wrapTo180 } from '../../utils/Math';
import { getModule } from '../../utils/MacroState';
import { forceGrab, releaseForcedGrab } from '../../utils/Ungrab';
import { mc } from '../../utils/Utils';

const Perspective = net.minecraft.client.CameraType;
const InputConstants = com.mojang.blaze3d.platform.InputConstants;
class Freecam extends ModuleBase {
    constructor() {
        super({
            name: 'Freecam',
            subcategory: 'Visuals',
            description: 'Fly around, right click an entity to spectate.',
            theme: '#5fb0ff',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
        });

        this.bindToggleKey();

        this.moveSpeed = 0.8;
        this.cameraPos = null;
        this.velocity = new Vec3d(0, 0, 0);
        this.savedPerspective = null;
        this.lastRenderAt = 0;
        this.possessedUUID = null;
        this.rightClickWasDown = false;

        this.addSlider('Move Speed', 5, 30, 10, (value) => (this.moveSpeed = Number(value) / 25), 'Freecam move speed.');

        this.on('tick', () => {
            const rightClickDown = this.isRightClickDown();
            if (World.isLoaded() && !Client.isInGui() && rightClickDown && !this.rightClickWasDown) {
                if (this.possessedUUID) this.releasePossession();
                else this.tryPossessPlayer();
            }
            this.rightClickWasDown = rightClickDown;
        });
        this.on('renderWorld', () => this.onRender());
        this.on('renderEntity', (entity, partialTicks, event) => {
            if (this.possessedUUID && entity.getUUID().equals(this.possessedUUID)) cancel(event);
        });
    }

    onEnable() {
        const player = Player.getPlayer();
        if (!World.isLoaded() || !player) {
            this.resetCameraState();
            return;
        }
        getModule('Freelook')?.toggle(false);
        this.message('&aEnabled &7(Right-click an entity to spectate)');
        this.cameraPos = this.getInitialCameraPos(player, wrapTo180(player.getYRot()), player.getXRot());
        this.velocity = new Vec3d(0, 0, 0);
        this.savedPerspective = mc.options.getCameraType();
        this.lastRenderAt = Date.now();
        this.possessedUUID = null;
        this.rightClickWasDown = this.isRightClickDown();
        forceGrab();
        Client.setCameraRotation(wrapTo180(player.getYRot()), player.getXRot());
        Client.setFreecam(true);
        mc.setCameraEntity(player);
        mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
        setCameraPosition(this.cameraPos);
        Client.reloadWorldRenderer();
    }

    onDisable() {
        this.message('&cDisabled');
        this.resetCameraState();
        if (World.isLoaded()) Client.reloadWorldRenderer();
        releaseForcedGrab();
    }

    resetCameraState() {
        const player = Player.getPlayer();
        if (player) mc.setCameraEntity(player);

        this.cameraPos = null;
        this.velocity = new Vec3d(0, 0, 0);
        this.possessedUUID = null;
        this.rightClickWasDown = false;
        Client.setUngrabbed(false);
        Client.setFreecam(false);
        Client.setSpectatedEntity(null);
        Client.clearCameraRotation();
        clearCameraPosition();

        if (this.savedPerspective) mc.options.setCameraType(this.savedPerspective);
        this.savedPerspective = null;
    }

    onRender() {
        if (!this.enabled || !World.isLoaded()) return;
        if (this.possessedUUID) {
            this.syncPossessedCamera();
            return;
        }

        const player = Player.getPlayer();
        if (!player) return;

        if (!this.cameraPos) {
            this.cameraPos = this.getInitialCameraPos(player, wrapTo180(player.getYRot()), player.getXRot());
        }

        if (mc.options.getCameraType() !== Perspective.THIRD_PERSON_BACK) {
            mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
        }

        const options = mc.options;
        const yaw = (Number(Client.getCameraYaw() ?? player.getYRot()) * Math.PI) / 180;

        let moveX = 0;
        let moveY = 0;
        let moveZ = 0;

        const sinYaw = Math.sin(yaw);
        const cosYaw = Math.cos(yaw);

        if (this.isKeyDown(options.keyUp)) {
            moveX -= sinYaw;
            moveZ += cosYaw;
        }
        if (this.isKeyDown(options.keyDown)) {
            moveX += sinYaw;
            moveZ -= cosYaw;
        }
        if (this.isKeyDown(options.keyLeft)) {
            moveX += cosYaw;
            moveZ += sinYaw;
        }
        if (this.isKeyDown(options.keyRight)) {
            moveX -= cosYaw;
            moveZ -= sinYaw;
        }
        if (this.isKeyDown(options.keyJump)) moveY += 1;
        if (this.isKeyDown(options.keyShift)) moveY -= 1;

        const magnitude = Math.hypot(moveX, moveY, moveZ) || 1;
        const hasInput = Math.abs(moveX) > 0 || Math.abs(moveY) > 0 || Math.abs(moveZ) > 0;
        const targetX = hasInput ? (moveX / magnitude) * this.moveSpeed : 0;
        const targetY = hasInput ? (moveY / magnitude) * this.moveSpeed : 0;
        const targetZ = hasInput ? (moveZ / magnitude) * this.moveSpeed : 0;
        const now = Date.now();
        const frames = Math.min(5, Math.max(0.1, (now - this.lastRenderAt) / 10));
        this.lastRenderAt = now;
        const smoothing = 1 - Math.pow(hasInput ? 0.65 : 0.88, frames);

        this.velocity = new Vec3d(
            this.velocity.x() + (targetX - this.velocity.x()) * smoothing,
            this.velocity.y() + (targetY - this.velocity.y()) * smoothing,
            this.velocity.z() + (targetZ - this.velocity.z()) * smoothing
        );

        if (Math.hypot(this.velocity.x(), this.velocity.y(), this.velocity.z()) < 0.0005) {
            this.velocity = new Vec3d(0, 0, 0);
            setCameraPosition(this.cameraPos);
            return;
        }

        this.cameraPos = new Vec3d(
            this.cameraPos.x() + this.velocity.x() * frames,
            this.cameraPos.y() + this.velocity.y() * frames,
            this.cameraPos.z() + this.velocity.z() * frames
        );
        setCameraPosition(this.cameraPos);
    }

    tryPossessPlayer() {
        const target = this.getPlayerUnderCrosshair();
        if (!target) return;

        this.possessedUUID = target.getUUID();
        this.velocity = new Vec3d(0, 0, 0);
        Client.setUngrabbed(true);
        Client.setSpectatedEntity(target.toMC());
        this.syncPossessedCamera();
        this.message(`&aSpectating &f${target.getName()} &7(Right-click to release)`);
    }

    releasePossession(silent = false) {
        const entity = this.getPossessedPlayer();
        if (entity) {
            const partialTicks = mc.getDeltaTracker().getGameTimeDeltaPartialTick(false);
            this.cameraPos = entity.getEyePosition(partialTicks);
            Client.setCameraRotation(entity.getViewYRot(partialTicks), entity.getViewXRot(partialTicks));
        }

        this.possessedUUID = null;
        this.velocity = new Vec3d(0, 0, 0);
        Client.setUngrabbed(false);
        Client.setSpectatedEntity(null);
        forceGrab();
        mc.setCameraEntity(Player.getPlayer());
        mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
        if (this.cameraPos) setCameraPosition(this.cameraPos);
        if (!silent) this.message('&7Released spectating');
    }

    syncPossessedCamera() {
        const entity = this.getPossessedPlayer();
        if (!entity) {
            this.releasePossession(true);
            this.message('&cThat entity is no longer loaded');
            return;
        }

        const partialTicks = mc.getDeltaTracker().getGameTimeDeltaPartialTick(false);
        this.cameraPos = entity.getEyePosition(partialTicks);
        mc.options.setCameraType(Perspective.FIRST_PERSON);
        setCameraPosition(this.cameraPos);
        Client.setCameraRotation(entity.getViewYRot(partialTicks), entity.getViewXRot(partialTicks));
    }

    getPossessedPlayer() {
        if (!this.possessedUUID) return null;
        return World.getWorld()?.getPlayerByUUID(this.possessedUUID) || null;
    }

    getPlayerUnderCrosshair() {
        if (!this.cameraPos) return null;

        const yaw = Number(Client.getCameraYaw() ?? 0);
        const pitch = Number(Client.getCameraPitch() ?? 0);
        const yawRad = (yaw * Math.PI) / 180;
        const pitchRad = (pitch * Math.PI) / 180;
        const cosPitch = Math.cos(pitchRad);
        const direction = new Vec3d(-Math.sin(yawRad) * cosPitch, -Math.sin(pitchRad), Math.cos(yawRad) * cosPitch);
        const end = this.cameraPos.add(direction.scale(128));
        const selfUUID = Player.getUUID();
        let nearest = null;
        const blockHit = World.getWorld().clip(new ClipContext(this.cameraPos, end, ClipContext.Block.OUTLINE, ClipContext.Fluid.NONE, Player.getPlayer()));
        let nearestDistanceSq = String(blockHit.getType()) === 'MISS' ? Infinity : this.cameraPos.distanceToSqr(blockHit.getLocation());

        for (const player of World.getAllPlayers()) {
            if (player.getUUID().equals(selfUUID)) continue;

            const hit = player.toMC().getBoundingBox().inflate(0.15).clip(this.cameraPos, end);
            if (!hit.isPresent()) continue;

            const distanceSq = this.cameraPos.distanceToSqr(hit.get());
            if (distanceSq < nearestDistanceSq) {
                nearest = player;
                nearestDistanceSq = distanceSq;
            }
        }

        return nearest;
    }

    isRightClickDown() {
        return GLFW.glfwGetMouseButton(mc.getWindow().handle(), GLFW.GLFW_MOUSE_BUTTON_RIGHT) === GLFW.GLFW_PRESS;
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

        return new Vec3d(eyePos.x() - lookX * 4.0, eyePos.y() - lookY * 4.0, eyePos.z() - lookZ * 4.0);
    }
}

new Freecam();
