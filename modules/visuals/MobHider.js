import { PortalParticle } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';

class MobHider extends ModuleBase {
    constructor() {
        super({
            name: 'Mob Hider',
            subcategory: 'Visuals',
            description: 'Hides mobs of certain types',
            tooltip: 'Prevents seeing mobs or hitting them',
        });

        this.mobsToHide = [];
        this.enabledMobNames = [];
        this.jerryRegex = /^(Green|Blue|Purple|Golden) Jerry$/;

        this.addMultiToggle(
            'Mobs To Hide',
            ['Kalhuikis', 'Sven Pups', 'Jerries', 'Thysts'],
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

        const mobChecks = {
            Kalhuikis: () => cleanName.includes('Kalhuiki'),
            'Sven Pups': () => cleanName.includes('Sven Pup'),
            Thysts: () => cleanName.includes('Thyst') || cleanName.includes('Endermite'),
            Jerries: () => this.jerryRegex.test(cleanName),
        };

        for (const option of enabled) {
            const check = mobChecks[option];
            if (check && check()) {
                return true;
            }
        }

        return false;
    }

    handleMobToggleUpdate(allMobOptions) {
        this.mobsToHide = allMobOptions;

        this.enabledMobNames = allMobOptions.filter((mobObject) => mobObject.enabled).map((mobObject) => mobObject.name);
    }
}

new MobHider();
