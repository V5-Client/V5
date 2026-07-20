import { Mixin } from '../../utils/MixinManager';
import { ModuleBase } from '../../utils/ModuleBase';
import { MathUtils } from '../../utils/Math';
import { Mouse } from '../../utils/Ungrab';
import { mc } from '../../utils/Utils';

const Perspective = net.minecraft.client.CameraType;

class Freelook extends ModuleBase {
    constructor() {
        super({
            name: 'Freelook',
            subcategory: 'Visuals',
            description: 'Look around independently while the camera stays with your player.',
            tooltip: 'Client-side third-person freelook.',
            theme: '#5fb0ff',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
        });

        this.bindToggleKey();
        this.savedPerspective = null;
        this.on('renderWorld', () => this.updateCamera());
    }

    onEnable() {
        const player = Player.getPlayer();
        if (!World.isLoaded() || !player) return this.toggle(false);

        this.message('&aEnabled');
        this.savedPerspective = mc.options.getCameraType();
        Mouse.forceGrab();
        Mixin.set('cameraOverrideYaw', MathUtils.wrapTo180(player.getYRot()));
        Mixin.set('cameraOverridePitch', player.getXRot());
        Mixin.set('freelookCameraDistance', 4.0);
        Mixin.set('freelookEnabled', true);
        mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
    }

    onDisable() {
        this.message('&cDisabled');
        Mixin.set('freelookEnabled', false);
        Mixin.delete('cameraOverrideYaw');
        Mixin.delete('cameraOverridePitch');
        Mixin.delete('freelookCameraDistance');

        if (this.savedPerspective) mc.options.setCameraType(this.savedPerspective);
        this.savedPerspective = null;
        Mouse.releaseForcedGrab();
    }

    updateCamera() {
        const player = Player.getPlayer();
        if (!player) return;

        if (mc.options.getCameraType() !== Perspective.THIRD_PERSON_BACK) {
            mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
        }
    }
}

new Freelook();
