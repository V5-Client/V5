import { chatAnnoucement, chatIrc } from '../Chat';
import { Categories } from '../../gui/categories/CategorySystem';

let ircEnabled = true;
let autoMeowEnabled = false;
let randomChoiceMeow = false;
Categories.addSettingsToggle('labels.irc', (v) => (ircEnabled = !!v), 'descriptions.irc', true, 'IRC', 'Discord');
Categories.addSettingsToggle('labels.auto_meow', (v) => (autoMeowEnabled = !!v), 'descriptions.auto_meow', false, 'IRC', 'Discord');
Categories.addSettingsToggle('labels.random_choice_meow', (v) => (randomChoiceMeow = !!v), 'descriptions.random_choice_meow', true, 'IRC', 'Discord');

export const isAutoMeowEnabled = () => autoMeowEnabled;
export const isIrcEnabled = () => ircEnabled;
export const isRandomChoiceMeowEnabled = () => randomChoiceMeow;

export function handleIRCMessage(data) {
    if (data.type === 'message') {
        if (!ircEnabled) return;
        const sender = data.user || 'Unknown';
        const message = `${data.msg ?? ''}`;
        chatIrc(`&9${sender}&r: ${message}`);
        return true;
    }

    if (data.type === 'error') {
        chatIrc(`Error: ${data.code || 'Unknown'}`);
        return true;
    }

    if (data.type === 'system') {
        if (data.code === 'PREFIX_UPDATED') {
            chatIrc('Your prefix has been changed');
        } else if (data.code === 'MUTED') {
            const expiresAt = Number(data.mute_expires_at);
            if (Number.isFinite(expiresAt)) {
                chatIrc('You have been muted until ' + new Date(expiresAt * 1000).toISOString());
            } else {
                chatIrc('You have been muted');
            }
        } else {
            chatIrc(`System: ${data.code || ''}`);
        }
        return true;
    }

    if (data.type === 'announcement') {
        if (!ircEnabled) return;
        chatAnnoucement(`${data.msg ?? ''}`);
        return true;
    }

    return false;
}
