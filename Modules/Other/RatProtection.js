import { ModuleBase } from '../../utils/ModuleBase';
import RequestV2 from 'RequestV2';

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
        RequestV2({
            url: 'https://sessionserver.mojang.com/session/minecraft/join',
            method: 'POST',
            body: {
                accessToken: ssid,
                selectedProfile: Player.getUUID().toString().replaceAll('-', ''),
                serverId: java.util.UUID.randomUUID().toString().replaceAll('-', ''),
            },
            resolveWithFullResponse: true,
        }).then((response) => {
            //console.log(JSON.stringify(response));
        });
    }
}

new RatProtection();
