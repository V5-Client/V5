import { PortalParticle } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';

class MobHider extends ModuleBase {
    constructor() {
        super({
            name: 'modules.mob_hider.name',
            subcategory: 'Visuals',
            description: 'modules.mob_hider.description',
            tooltip: 'modules.mob_hider.tooltip',
        });

        this.enabledMobNames = [];
        this.jerryRegex = /^(Green|Blue|Purple|Golden) Jerry$/;

        this.addMultiToggle(
            'labels.mobs_to_hide',
            ['options.kalhuikis', 'options.sven_pups', 'options.jerries', 'options.thysts'],
            false,
            (v) => this.handleMobToggleUpdate(v),
            'The Mobs you want to hide'
        );

        this.on('renderEntity', (entity, pt, event) => {
            if (this.shouldHideEntity(entity.getName())) {
                cancel(event);
            }
        });

        this.on('spawnParticle', (particle, event) => {
            if (particle == null) return;
            if (this.enabledMobNames.includes('Thysts') && particle instanceof PortalParticle) {
                cancel(event);
            }
        });

        this.on('playerInteract', (action, pos, event) => {
            const attackedEntity = Player.lookingAt();
            if (!(attackedEntity instanceof Entity)) return;

            if (this.shouldHideEntity(attackedEntity.getName())) cancel(event);
        });
    }

    shouldHideEntity(entityName) {
        const enabled = this.enabledMobNames;
        if (enabled.length === 0) return false;

        const cleanName = ChatLib.removeFormatting(entityName);

        for (const option of enabled) {
            if (option === 'Kalhuikis' && cleanName.includes('Kalhuiki')) return true;
            if (option === 'Sven Pups' && cleanName.includes('Sven Pup')) return true;
            if (option === 'Thysts' && (cleanName.includes('Thyst') || cleanName.includes('Endermite'))) return true;
            if (option === 'Jerries' && this.jerryRegex.test(cleanName)) return true;
        }

        return false;
    }

    handleMobToggleUpdate(allMobOptions) {
        this.enabledMobNames = allMobOptions.filter((mobObject) => mobObject.enabled).map((mobObject) => mobObject.name);
    }
}

new MobHider();
