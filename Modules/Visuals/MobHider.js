import { getSetting } from '../../GUI/GuiSave';

const { addCategoryItem, addMultiToggle } = global.Categories;

class MobHider {
    constructor() {
        addCategoryItem(
            'Visuals',
            'Mob Hider',
            'Hides types of mobs',
            'Hides mobs client-side.'
        );

        this.mobsToHide = new Set();
        this.jerryRegex = /^(Green|Blue|Purple|Golden) Jerry$/;

        const shouldHideEntity = (entityName) => {
            if (this.mobsToHide.size === 0) return false;

            const cleanName = ChatLib.removeFormatting(entityName);

            if (
                this.mobsToHide.has('Kalhuikis') &&
                cleanName.includes('Kalhuiki')
            )
                return true;
            if (
                this.mobsToHide.has('Sven Pups') &&
                cleanName.includes('Sven Pup')
            )
                return true;
            if (
                this.mobsToHide.has('Thysts') &&
                (cleanName.includes('Thyst') || cleanName.includes('Endermite'))
            )
                return true;
            if (
                this.mobsToHide.has('Jerries') &&
                this.jerryRegex.test(cleanName)
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

        this.toggle = () => {
            const selectedMobs = getSetting('Mob Hider', 'Mobs', [
                'Kalhuikis',
                'Sven Pups',
                'Jerries',
                'Thysts',
            ]);
            this.mobsToHide = new Set(selectedMobs);

            if (this.mobsToHide.size > 0) {
                renderHandler.register();
                attackHandler.register();
            } else {
                renderHandler.unregister();
                attackHandler.unregister();
            }

            if (this.mobsToHide.has('Thysts')) {
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
            false,
            this.toggle,
            'What mobs to hide.'
        );

        Client.scheduleTask(1, this.toggle);
    }
}

new MobHider();
