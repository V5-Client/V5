import { Mixin } from './MixinManager';
import { Utils } from './Utils';

class CameraUtils {
    /**
     * Override the player's camera position. Pass null/undefined to clear.
     * @param {Vec3d|Object|Array|Player|Entity|BlockPos} vec
     * @returns {boolean} true when a valid override was set, false otherwise
     */
    setCameraPosition(vec) {
        if (vec == null) {
            Mixin.delete('cameraOverridePos');
            return false;
        }

        const converted = Utils.convertToVector(vec);
        if (!converted) return false;

        Mixin.set('cameraOverridePos', converted);
        return true;
    }

    clearCameraPosition() {
        Mixin.delete('cameraOverridePos');
    }

    getCameraPosition() {
        return Mixin.get('cameraOverridePos', null);
    }
}

export const Camera = new CameraUtils();
