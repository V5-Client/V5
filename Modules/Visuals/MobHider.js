import { getSetting } from '../../GUI/GuiSave';

const { addCategoryItem, addMultiToggle } = global.Categories;

class MobHider {
    constructor() {
        addCategoryItem('Visuals', 'Mob Hider', 'Hides types of mobs');

        this.MOBS = [];
        this.jerryNames = [
            'Green Jerry',
            'Blue Jerry',
            'Purple Jerry',
            'Golden Jerry',
        ];

        const shouldHideEntity = (entityName) => {
            if (!this.MOBS || this.MOBS.length === 0) return false;

            const cleanName = ChatLib.removeFormatting(entityName);

            if (
                this.MOBS.includes('Kalhuikis') &&
                cleanName.includes('Kalhuiki')
            )
                return true;
            if (
                this.MOBS.includes('Sven Pups') &&
                cleanName.includes('Sven Pup')
            )
                return true;
            if (
                this.MOBS.includes('Jerries') &&
                this.jerryNames.some((jerry) => cleanName.includes(jerry))
            )
                return true;
            if (
                this.MOBS.includes('Thysts') &&
                (cleanName.includes('Thyst') || cleanName.includes('Endermite'))
            )
                return true;

            return false;
        };

        let renderHandler = register('renderEntity', (entity, pt, event) => {
            if (shouldHideEntity(entity.getName())) {
                cancel(event);
            }
        }).unregister();

        let attackHandler = register('playerInteract', (action, pos, event) => {
            if (action.toString() !== 'ATTACK') return;

            const attackedEntity = Player.lookingAt();
            if (!(attackedEntity instanceof Entity)) return;

            if (shouldHideEntity(attackedEntity.getName())) {
                cancel(event);
            }
        }).unregister();

        let particleHandler = register('spawnParticle', (particle, event) => {
            if (particle == null) return;
            if (particle.toString().includes('class_709')) {
                cancel(event);
            }
        }).unregister();

        this.toggle = (mobs) => {
            this.MOBS = mobs;

            if (this.MOBS && this.MOBS.length > 0) {
                renderHandler.register();
                attackHandler.register();
            } else {
                renderHandler.unregister();
                attackHandler.unregister();
            }

            if (this.MOBS && this.MOBS.includes('Thysts')) {
                particleHandler.register();
            } else {
                particleHandler.unregister();
            }
        };

        addMultiToggle(
            'Modules',
            'Mob Hider',
            'Mobs',
            ['Kalhuikis', 'Sven Pups', 'Jerries', 'Thysts'],
            this.toggle
        );

        Client.scheduleTask(0, () =>
            this.toggle(getSetting('Mob Hider', 'Mobs', []))
        );
    }
}

new MobHider();
