import { ModuleBase } from '../../utils/ModuleBase';
import { wrapTo180 } from '../../utils/Math';
import { getModule } from '../../utils/MacroState';
import { forceGrab, releaseForcedGrab } from '../../utils/Ungrab';
import { mc } from '../../utils/Utils';

const Perspective = net.minecraft.client.CameraType;

class Freelook extends ModuleBase {
    constructor() {
        super({
            name: 'modules.freelook.name',
            subcategory: 'Visuals',
            description: 'modules.freelook.description',
            tooltip: 'modules.freelook.tooltip',
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

        this.message('messages.common.enabled');
        this.savedPerspective = mc.options.getCameraType();
        forceGrab();
        Client.setCameraRotation(wrapTo180(player.getYRot()), player.getXRot());
        Client.setFreelookDistance(4.0);
        Client.setFreelook(true);
        mc.options.setCameraType(Perspective.THIRD_PERSON_BACK);
    }

    onDisable() {
        this.message('messages.common.disabled');
        Client.setFreelook(false);
        Client.clearCameraRotation();

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
