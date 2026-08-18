import { convertToVector } from './Utils';

export function setCameraPosition(vec) {
    if (vec == null) {
        clearCameraPosition();
        return false;
    }

    const converted = convertToVector(vec);
    if (!converted) return false;

    Client.setCameraPosition(converted);
    return true;
}

export const clearCameraPosition = () => Client.setCameraPosition(null);
