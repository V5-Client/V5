import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import Render from '../../utils/render/Render';

class ESP extends ModuleBase {
    constructor() {
        super({
            name: 'Player ESP',
            subcategory: 'Visuals',
            description: 'Shows players through walls',
            tooltip: 'Shows players through walls',
        });

        this.rgba = [255, 0, 0, 255];

        this.showNames = false;

        this.addToggle(
            'Show Names',
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
                this.rgba = Render.Color(color.getRed(), color.getGreen(), color.getBlue(), color.getAlpha());
            },
            'Color of the ESP box'
        );

        this.on('postRenderWorld', () => {
            let players = World.getAllPlayers();

            for (const player of players) {
                if (player.getUUID().equals(Player.getUUID())) continue;
                if (player.getUUID().version() !== 4) continue;

                Render.drawHitbox(player.toMC(), this.rgba, 4, false);

                let vec = new Vec3d(player.x, player.y + 2.3, player.z);
                if (this.showNames) Render.drawText(player.getName(), vec, 1.2, true, false, true);
            }
        });
    }
}

new ESP();
