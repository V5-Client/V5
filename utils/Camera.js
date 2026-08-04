import { deleteMixinValue, setMixinValue } from './MixinManager';
import { convertToVector } from './Utils';

export function setCameraPosition(vec) {
    if (vec == null) {
        clearCameraPosition();
        return false;
    }

    const converted = convertToVector(vec);
    if (!converted) return false;

    setMixinValue('cameraOverridePos', converted);
    return true;
}

export const clearCameraPosition = () => deleteMixinValue('cameraOverridePos');
