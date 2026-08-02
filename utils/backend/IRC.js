import { sendAnnouncement, sendIrcMessage } from '../Chat';
import { Categories } from '../../gui/categories/CategorySystem';

let ircEnabled = true;
let autoMeowEnabled = false;
let randomChoiceMeow = false;
Categories.addSettingsToggle('IRC', (v) => (ircEnabled = !!v), "Messages can be sent with '#msg'", true, 'IRC', 'Discord');
Categories.addSettingsToggle('Auto Meow', (v) => (autoMeowEnabled = !!v), 'Auto-reply "meow!" when someone sends "meow"', false, 'IRC', 'Discord');
Categories.addSettingsToggle(
    'Random choice meow',
    (v) => (randomChoiceMeow = !!v),
    'Pick a random meow instead of the default "meow!" (REQUIRES AUTO MEOW)',
    true,
    'IRC',
    'Discord'
);

export const isAutoMeowEnabled = () => autoMeowEnabled;
export const isIrcEnabled = () => ircEnabled;
export const isRandomChoiceMeowEnabled = () => randomChoiceMeow;

export function handleIRCMessage(data) {
    if (data.type === 'message') {
        if (!ircEnabled) return;
        const sender = data.user || 'Unknown';
        const message = `${data.msg ?? ''}`;
        sendIrcMessage(`&9${sender}&r: ${message}`);
        return true;
    }

    if (data.type === 'error') {
        sendIrcMessage(`Error: ${data.code || 'Unknown'}`);
        return true;
    }

    if (data.type === 'system') {
        if (data.code === 'PREFIX_UPDATED') {
            sendIrcMessage('Your prefix has been changed');
        } else if (data.code === 'MUTED') {
            const expiresAt = Number(data.mute_expires_at);
            if (Number.isFinite(expiresAt)) {
                sendIrcMessage('You have been muted until ' + new Date(expiresAt * 1000).toISOString());
            } else {
                sendIrcMessage('You have been muted');
            }
        } else {
            sendIrcMessage(`System: ${data.code || ''}`);
        }
        return true;
    }

    if (data.type === 'announcement') {
        if (!ircEnabled) return;
        sendAnnouncement(`${data.msg ?? ''}`);
        return true;
    }

    return false;
}
