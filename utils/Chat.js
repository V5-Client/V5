import FailsafeUtils from '../failsafes/FailsafeUtils';
import { isDeveloperModeEnabled } from './DeveloperModeState';

const sendGradient = (prefix, ...args) => {
    if (!args.length) return;
    Client.getMinecraft().execute(() => GradientChat.sendGradientMsg(prefix, 0x05b9f9, 0x0539f9, ...args));
};

export const chat = (message) => sendGradient('V5 »', message);

export function chatDebug(message) {
    if (isDeveloperModeEnabled()) sendGradient('V5 Debug »', message);
}

export function chatFailsafe(message, includeIntensity = true) {
    sendGradient('V5 Failsafes »', message);
    if (includeIntensity) sendGradient('V5 Failsafes »', '&c&lCurrent intensity: ' + FailsafeUtils.getIntensity());
}

export const chatIrc = (message) => sendGradient('IRC »', message);
export const chatPathfinder = (message) => sendGradient('V5 Pathfinding »', message);

export function chatAnnoucement(message) {
    if (!message) return;
    Client.getMinecraft().execute(() => GradientChat.sendGradientMsg('V5 Announcement »', 0xf4a261, 0xe76f51, message));
}
