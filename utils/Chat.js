import FailsafeUtils from '../failsafes/FailsafeUtils';
import { isDeveloperModeEnabled } from './DeveloperModeState';

const sendGradient = (prefix, ...args) => {
    if (!args.length) return;
    Client.getMinecraft().execute(() => GradientChat.sendGradientMsg(prefix, 0x05b9f9, 0x0539f9, ...args));
};

export const chat = (message) => sendGradient('V5 »', message);

export function sendDebugMessage(message) {
    if (isDeveloperModeEnabled()) sendGradient('V5 Debug »', message);
}

export function sendFailsafeMessage(message, includeIntensity = true) {
    sendGradient('V5 Failsafes »', message);
    if (includeIntensity) sendGradient('V5 Failsafes »', '&c&lCurrent intensity: ' + FailsafeUtils.getIntensity());
}

export const sendIrcMessage = (message) => sendGradient('IRC »', message);
export const sendPathfinderMessage = (message) => sendGradient('V5 Pathfinding »', message);

export function sendAnnouncement(message) {
    if (!message) return;
    Client.getMinecraft().execute(() => GradientChat.sendGradientMsg('V5 Announcement »', 0xf4a261, 0xe76f51, message));
}

export function logMessage(message) {
    if (message) console.log('V5 » ' + message);
}
