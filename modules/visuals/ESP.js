import RenderUtils from '../../utils/render/RendererUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { Vec3d } from '../../utils/Constants';

class ESP extends ModuleBase {
    constructor() {
        super({
            name: ' Player ESP',
            subcategory: 'Visuals',
            description: 'Shows players through walls',
            tooltip: 'Shows players through walls',
        });

        this.rgba = [255, 0, 0, 255];

        this.showNames = false;

        this.addToggle(
            'show Names',
            (value) => {
                this.showNames = value;
            },
            'Shows player names',
            true
        );

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

                let vec = new Vec3d(player.x, player.y + 2.3, player.z);
                if (this.showNames) RenderUtils.drawText(player.getName(), vec, 1.2, true, false, true);
            }
        });
    }
}

new ESP();
