import { Chat } from '../Chat';
import { Categories } from '../../gui/categories/CategorySystem';

let ircEnabled = true;
Categories.addSettingsToggle('IRC', (v) => (ircEnabled = !!v), "Messages can be sent with '#msg'", true, 'IRC', 'Discord');

export function handleIRCMessage(data) {
    if (data.type === 'message') {
        if (!ircEnabled) return;
        const sender = data.user || 'Unknown';
        Chat.messageIrc(`&9${sender}&r: ${data.msg}`);
        return true;
    }

    if (data.type === 'error') {
        Chat.messageIrc(`Error: ${data.code || 'Unknown'}`);
        return true;
    }

    if (data.type === 'system') {
        if (data.code === 'PREFIX_UPDATED') {
            Chat.messageIrc('Your prefix has been changed');
        } else if (data.code === 'MUTED') {
            Chat.messageIrc('You have been muted until ' + new Date(data.mute_expires_at * 1000).toISOString());
        } else {
            Chat.messageIrc(`System: ${data.code || ''}`);
        }
        return true;
    }

    return false;
}
