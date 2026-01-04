import RenderUtils from '../../utils/render/RendererUtils';
import { ModuleBase } from '../../utils/ModuleBase';

class ESP extends ModuleBase {
    constructor() {
        super({
            name: 'ESP',
            subcategory: 'Visuals',
            description: 'Shows players through walls',
            tooltip: 'Shows players through walls',
        });

        this.rgba = [255, 0, 0, 255];

        this.addColorPicker(
            'ESP Color',
            java.awt.Color.RED,
            (color) => {
                this.rgba = [color.getRed(), color.getGreen(), color.getBlue(), color.getAlpha()];
            },
            'Color of the ESP box'
        );

        this.on('postRenderWorld', () => {
            let players = World.getAllPlayers();

            for (let i = 0; i < players.length; i++) {
                let player = players[i];

                if (player.getUUID().equals(Player.getUUID())) continue;
                if (player.getUUID().version() !== 4) continue;

                RenderUtils.drawEntityHitbox(player.toMC(), this.rgba, 4, false);
            }
        });
    }
}

new ESP();
