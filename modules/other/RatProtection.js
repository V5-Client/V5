import { ModuleBase } from '../../utils/ModuleBase';
import requestV2 from 'requestV2';

class RatProtection extends ModuleBase {
    constructor() {
        super({
            name: 'Rat Protection',
            subcategory: 'Other',
            description: 'Rate limits mojangs servers to stop people authenticating with your account.',
            tooltip: 'Rate limits mojangs servers to stop people authenticating with your account.',
        });

        this.on('step', () => {
            this.postMojangServer();
        }).setDelay(1);
    }

    postMojangServer() {
        if (!World.isLoaded()) return;
        requestV2({
            url: 'https://sessionserver.mojang.com/session/minecraft/join',
            method: 'POST',
            body: {
                accessToken: Client.getMinecraft().getSession().getAccessToken(),
                selectedProfile: Player.getUUID().toString().replaceAll('-', ''),
                serverId: java.util.UUID.randomUUID().toString().replaceAll('-', ''),
            },
            resolveWithFullResponse: true,
        }).then(() => {});
    }
}

new RatProtection();
