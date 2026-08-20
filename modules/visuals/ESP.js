import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';

class ESP extends ModuleBase {
    constructor() {
        super({
            name: 'modules.player_esp.name',
            subcategory: 'Visuals',
            description: 'modules.player_esp.description',
            tooltip: 'modules.player_esp.tooltip',
        });

        this.rgba = new RenderColor(255, 0, 0, 255);

        this.showNames = true;
        this.disableEspWithinDistance = 2;

        this.addToggle(
            'labels.show_names',
            (value) => {
                this.showNames = value;
            },
            'descriptions.show_names',
            true
        );

        this.addColorPicker(
            'labels.esp_color',
            java.awt.Color.RED,
            (color) => {
                this.rgba = new RenderColor(color.getRed(), color.getGreen(), color.getBlue(), color.getAlpha());
            },
            'descriptions.esp_color'
        );

        this.addSlider(
            'labels.disable_esp_distance',
            0,
            10,
            this.disableEspWithinDistance,
            (value) => {
                this.disableEspWithinDistance = value;
            },
            'descriptions.disable_esp_distance'
        );

        this.on('postRenderWorld', () => {
            const players = World.getAllPlayers();
            const self = Player.getPlayer();
            const disableEspWithinDistanceSq = this.disableEspWithinDistance * this.disableEspWithinDistance;

            for (const player of players) {
                if (player.getUUID().equals(Player.getUUID())) continue;
                if (player.getUUID().version() !== 4) continue;

                const entity = player.toMC();
                const distanceSq = self.distanceToSqr(entity);

                if (distanceSq <= disableEspWithinDistanceSq) continue;

                Render3D.drawHitbox(entity, this.rgba, 4, false);

                if (!this.showNames) continue;

                if (distanceSq <= 32 * 32) continue;
                if (distanceSq > 64 * 64) continue;
                if (distanceSq <= 64 * 64 && !self.hasLineOfSight(entity)) continue;

                const vec = new Vec3d(player.x, player.y + 2.3, player.z);
                Render3D.drawText(player.getName(), vec, 1.2, true, false, true);
            }
        });
    }
}

new ESP();
