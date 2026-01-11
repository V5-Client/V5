import { ModuleBase } from '../../utils/ModuleBase';
//import { Chat } from '../../utils/Chat';
import requestV2 from 'requestV2';

class RatProtection extends ModuleBase {
    constructor() {
        super({
            name: 'Rat Protection',
            subcategory: 'Other',
            description: 'Rate limits mojangs servers to stop people authenticating with your account. MAY CAUSE IRC ISSUES',
            tooltip: 'Rate limits mojangs servers to stop people authenticating with your account. MAY CAUSE IRC ISSUES',
        });

        this.on('step', () => {
            this.postMojangServer();
        }).setDelay(1);
    }

    postMojangServer() {
        if (!this.enabled) return;
        const ssid = Client.getMinecraft().getSession().getAccessToken();
        requestV2({
            url: 'https://sessionserver.mojang.com/session/minecraft/join',
            method: 'POST',
            body: {
                accessToken: ssid,
                selectedProfile: Player.getUUID().toString().replaceAll('-', ''),
                serverId: java.util.UUID.randomUUID().toString().replaceAll('-', ''),
            },
            resolveWithFullResponse: true,
        }).then((response) => {
            //Chat.log(JSON.stringify(response));
        });
    }
}

new RatProtection();
