import { Utils } from './Utils';
import { Chat } from './Chat';
let { Version } = global;

import { URL, DataOutputStream, Toolkit, DataFlavor } from './Constants';

// TODO
// Failsafe
// Periodic report

class Webhooks {
    constructor() {
        this.webhookUrl = '';
        this.userID = '';
        this.isEnabled = false;

        try {
            const webhookFile = Utils.getConfigFile('webhook.json');
            if (webhookFile) {
                this.webhookUrl = webhookFile.url || '';
                this.userID = webhookFile.userId || ''; // Load userId if exists
                this.isEnabled = true;
                Chat.debugMessage('&aLoaded webhook from config');
            }
        } catch (e) {
            Chat.message('Webhook: ' + '&cFailed to load webhook config');
        }

        register('gameLoad', () => {
            this.gameLoadEmbed();
        });

        register('command', () => {
            try {
                url = Toolkit.getDefaultToolkit()
                    .getSystemClipboard()
                    .getData(DataFlavor.stringFlavor);
            } catch (e) {
                chat.message('Webhook: ' + '&cFailed to get clipboard data');
                return;
            }
            this.setWebhook(url);
        }).setName('setwh');

        register('command', (userId) => {
            if (!userId) {
                Chat.message('&cUsage: /setwhuser <discord_id>');
                return;
            }
            this.setUserId(userId);
        }).setName('setid');
    }

    /**
     * @function setWebhook
     * @description Sets the Discord webhook URL and saves it to a configuration file.
     * @param {string} url - The Discord webhook URL.
     */
    setWebhook(url) {
        if (!url.startsWith('https://discord.com/api/webhooks/')) {
            Chat.message('&cInvalid Discord webhook URL!');
            return;
        }

        this.webhookUrl = url;
        this.isEnabled = true;

        // Save webhook to file
        try {
            Utils.writeConfigFile('webhook.json', { url: url });
            Chat.message('&aWebhook saved successfully!');
        } catch (e) {
            Chat.message('&cFailed to save webhook: ' + e);
        }
    }

    /**
     * @function setUserId
     * @description Sets the Discord user ID for pinging and saves it to the configuration file.
     * @param {string} userId - The Discord user ID.
     */
    setUserId(userId) {
        this.userId = userId;

        // Save webhook and userId to file
        try {
            Utils.writeConfigFile('webhook.json', {
                url: this.webhookUrl,
                userId: userId,
            }); // Updated to .json
            Chat.message('&aUser ID saved successfully!');
        } catch (e) {
            Chat.message('&cFailed to save user ID: ' + e);
        }
    }

    gameLoadEmbed() {
        try {
            let url = new URL(this.webhookUrl);
            let conn = url.openConnection();
            conn.setRequestMethod('POST');
            conn.setRequestProperty('Content-Type', 'application/json');
            conn.setDoOutput(true);

            if (Utils.area() === undefined) {
                this.payload = {
                    avatar_url: `https://minotar.net/cube/${Player.getUUID()
                        .toString()
                        .replace(/-/g, '')}/100.png`,
                    username: `${Player.getName()}`,
                    embeds: [
                        {
                            title: '**Game successfully loaded!**',
                            description: `Module loaded with game launch!`,
                            color: 8388608,
                            footer: { text: `Client ${Version}` },
                            timestamp: new Date().toISOString(),
                        },
                    ],
                };
            } else {
                this.payload = {
                    avatar_url: `https://minotar.net/cube/${Player.getUUID()
                        .toString()
                        .replace(/-/g, '')}/100.png`,
                    username: `${Player.getName()}`,
                    embeds: [
                        {
                            title: '**Client successfully reloaded!**',
                            description: `**Module was reloaded with no error!**

              Area: ${Utils.area()}
              Subarea: ${Utils.subArea()}`,
                            color: 8388608,
                            footer: { text: `Client ${Version}` },
                            timestamp: new Date().toISOString(),
                        },
                    ],
                };
            }

            let json = JSON.stringify(this.payload);

            let wr = new DataOutputStream(conn.getOutputStream());
            wr.writeBytes(json);
            wr.flush();
            wr.close();

            conn.getInputStream();
        } catch (e) {
            Chat.message('&cThere was an error! ' + e);
        }
    }
}

export const Webhook = new Webhooks();
