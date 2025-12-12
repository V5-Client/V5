import { Utils } from './Utils';
import { Chat } from './Chat';
let { Version } = global;

import { URL, DataOutputStream, Toolkit, DataFlavor } from './Constants';

// TODO
// Failsafe
// Periodic report

class Webhooks {
    constructor() {
        this.webhookUrl = null;
        this.userId = null;
        this.isEnabled = false;

        try {
            const webhookFile = Utils.getConfigFile('webhook.json');
            if (webhookFile) {
                this.webhookUrl = webhookFile.url || null;
                this.userId = webhookFile.userId || null;
                this.isEnabled = !!this.webhookUrl;
            }
        } catch (e) {
            Chat.message('Webhook: ' + '&cFailed to load webhook config');
        }

        register('gameLoad', () => this.gameLoadEmbed());

        register('command', () => {
            try {
                let url = Toolkit.getDefaultToolkit().getSystemClipboard().getData(DataFlavor.stringFlavor);
                this.setWebhook(url);
            } catch (e) {
                Chat.message('Webhook: ' + '&cFailed to get clipboard data');
                return;
            }
        })
            .setName('setwh', true)
            .setAliases(['setwebhook', 'setdiscordwebhook']);

        register('command', (userId) => {
            if (!userId) {
                Chat.message('&cUsage: /setuserid <discord_id>');
                return;
            }
            this.setUserId(userId);
        })
            .setName('setid', true)
            .setAliases(['setuserid', 'setdiscordid', 'setdiscorduser', 'setdiscorduserid']);
    }

    saveConfig() {
        try {
            Utils.writeConfigFile('webhook.json', {
                url: this.webhookUrl,
                userId: this.userId,
            });
        } catch (e) {
            Chat.message('&cFailed to save webhook config: ' + e);
        }
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

        this.saveConfig();
        Chat.message('&aWebhook saved successfully!');
    }

    /**
     * @function setUserId
     * @description Sets the Discord user ID for pinging and saves it to the configuration file.
     * @param {string} userId - The Discord user ID.
     */
    setUserId(userId) {
        this.userId = userId;
        this.saveConfig();
        Chat.message('&aUser ID saved successfully!');
    }

    sendEmbed(embeds, ping = true) {
        if (!this.webhookUrl || !this.isEnabled) return;
        new Thread(() => {
            try {
                let url = new URL(this.webhookUrl);
                let conn = url.openConnection();
                conn.setRequestMethod('POST');
                conn.setRequestProperty('Content-Type', 'application/json');
                conn.setRequestProperty(`User-Agent`, `Mozilla/5.0 V5/${Version}`);
                conn.setDoOutput(true);

                let payload = {
                    avatar_url: `https://minotar.net/cube/${Player.getUUID().toString().replace(/-/g, '')}/100.png`,
                    username: `${Player.getName()}`,
                    embeds: embeds,
                };

                if (this.userId && ping) {
                    payload.content = `<@${this.userId}>`;
                }

                let json = JSON.stringify(payload);
                let wr = new DataOutputStream(conn.getOutputStream());
                wr.writeBytes(json);
                wr.flush();
                wr.close();
                conn.getInputStream();
            } catch (e) {
                if (e.toString().substr(0, 45) === 'JavaException: java.io.FileNotFoundException:') {
                    Chat.message('&cWebhook URL is invalid!');
                } else {
                    Chat.message('&cThere was an unknown error! ' + e);
                }
            }
        }).start();
    }

    gameLoadEmbed() {
        try {
            let embeds;
            if (Utils.area() === undefined) {
                // I dont think this works as intended but i cba
                embeds = [
                    {
                        title: '**Game successfully loaded!**',
                        description: `Module loaded with game launch!`,
                        color: 8388608,
                        footer: { text: `Client ${Version}` },
                        timestamp: new Date().toISOString(),
                    },
                ];
            } else {
                embeds = [
                    {
                        title: '**Client successfully reloaded!**',
                        description: `**Module was reloaded with no error!**
                            Area: ${Utils.area()}
                            Subarea: ${Utils.subArea()}`,
                        color: 8388608,
                        footer: { text: `Client ${Version}` },
                        timestamp: new Date().toISOString(),
                    },
                ];
            }
            this.sendEmbed(embeds);
        } catch (e) {
            Chat.message('&cThere was an error! ' + e);
        }
    }
}

export const Webhook = new Webhooks();
