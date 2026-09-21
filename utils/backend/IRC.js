import { returnDiscord } from '../NetworkUtils';
import { v5Command } from '../V5Commands';
import { Categories } from '../../gui/categories/CategorySystem';

Categories.addSettingsToggle('IRC', (v) => V5Irc.setEnabled(!!v), "Messages can be sent with '#msg'", true, 'IRC', 'Discord');
Categories.addSettingsToggle('Auto Meow', (v) => V5Irc.setAutoMeow(!!v), 'Auto-reply "meow!" when someone sends "meow"', false, 'IRC', 'Discord');
Categories.addSettingsToggle(
    'Random choice meow',
    (v) => V5Irc.setRandomChoiceMeow(!!v),
    'Pick a random meow instead of the default "meow!" (REQUIRES AUTO MEOW)',
    true,
    'IRC',
    'Discord'
);

v5Command('irc', () => V5Irc.reconnect());
v5Command('irc reconnect', () => V5Irc.reconnect());

new java.lang.Thread(() => {
    const token = V5Auth.getFreshJwtToken();
    if (token) returnDiscord(token);
}).start();
