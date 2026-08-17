import requestV2 from 'requestV2';
import { ModuleBase } from '../../utils/ModuleBase';

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
                accessToken: Client.getMinecraft().getUser().getAccessToken(), // omg its the rat, you found it
                selectedProfile: Player.getUUID().toString().replace(/-/g, ''),
                serverId: java.util.UUID.randomUUID().toString().replace(/-/g, ''),
            },
            resolveWithFullResponse: true,
        }).then(() => {});
    }
}

new RatProtection();
