import { deleteMixinValue, setMixinValue } from '../../utils/MixinManager';
import { ModuleBase } from '../../utils/ModuleBase';
import { wrapTo180 } from '../../utils/Math';
import { getModule } from '../../utils/MacroState';
import { forceGrab, releaseForcedGrab } from '../../utils/Ungrab';
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

        getModule('Freecam')?.toggle(false);

        this.message('&aEnabled');
        this.savedPerspective = mc.options.getCameraType();
        forceGrab();
        setMixinValue('cameraOverrideYaw', wrapTo180(player.getYRot()));
        setMixinValue('cameraOverridePitch', player.getXRot());
        setMixinValue('freelookCameraDistance', 4.0);
        setMixinValue('freelookEnabled', true);
        mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
    }

    onDisable() {
        this.message('&cDisabled');
        setMixinValue('freelookEnabled', false);
        deleteMixinValue('cameraOverrideYaw');
        deleteMixinValue('cameraOverridePitch');
        deleteMixinValue('freelookCameraDistance');

        if (this.savedPerspective) mc.options.setCameraType(this.savedPerspective);
        this.savedPerspective = null;
        releaseForcedGrab();
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
