import { getSetting } from '../../GUI/GuiSave';

const { addCategoryItem, addMultiToggle } = global.Categories;

addCategoryItem('Visuals', 'Mob Hider', 'Hides types of mobs');

addMultiToggle('Modules', 'Mob Hider', 'Mobs', [
    'Kalhuikis',
    'Sven Pups',
    'Jerries',
    'Thysts',
]);

class MobHider {
    constructor() {
        this.registered = false;

        this.jerryNames = [
            'Green Jerry',
            'Blue Jerry',
            'Purple Jerry',
            'Golden Jerry',
        ];

        register('step', () => {
            this.MOBS = getSetting('Mob Hider', 'Mobs', [
                'Kalhuikis',
                'Sven Pups',
                'Jerries',
                'Thysts',
            ]);

            if ((!this.MOBS || this.MOBS.length === 0) && this.registered) {
                renderHandler.unregister();
                attackHandler.unregister();
                particleHandler.unregister();
                this.registered = false;
            } else if (this.MOBS?.length > 0 && !this.registered) {
                renderHandler.register();
                attackHandler.register();
                if (this.MOBS.includes('Thysts'))
                    this.particleHandler.register();

                this.registered = true;
            }
        }).setFps(1);

        let renderHandler = register('renderEntity', (ent, pt, event) => {
            let cleanname = ChatLib.removeFormatting(ent.getName());

            if (
                this.MOBS?.includes('Kalhuikis') &&
                cleanname.includes('Kalhuiki')
            )
                cancel(event);

            if (
                this.MOBS?.includes('Sven Pups') &&
                cleanname.includes('Sven Pup')
            )
                cancel(event);

            if (this.MOBS?.includes('Jerries')) {
                if (
                    this.jerryNames.some((name) => ent.getName().includes(name))
                ) {
                    cancel(event);
                }
            }

            if (
                this.MOBS?.includes('Thysts') &&
                (cleanname.includes('Thyst') || cleanname.includes('Endermite'))
            )
                cancel(event);
        }).unregister();

        let attackHandler = register('playerInteract', (action, pos, event) => {
            if (!action.toString().includes('AttackEntity')) return;
            if (!(attackedEntity instanceof Entity)) return;
            let attackedEntity = Player.lookingAt();

            if (
                this.MOBS?.includes('Kalhuikis') &&
                attackedEntity?.toString()?.includes('Kalhuiki')
            ) {
                cancel(event);
            }

            if (
                this.MOBS?.includes('Sven Pups') &&
                attackedEntity?.toString()?.includes('Sven Pup')
            )
                cancel(event);

            if (
                this.MOBS?.includes('Jerries') &&
                attackedEntity?.toString()?.includes('Jerry')
            ) {
                cancel(event);
            }

            if (
                this.MOBS?.includes('Thysts') &&
                (attackedEntity?.toString()?.includes('Thyst') ||
                    attackedEntity?.toString()?.includes('Endermite'))
            )
                cancel(event);
        }).unregister();

        let particleHandler = register('spawnParticle', (particle, event) => {
            if (particle == null) return;
            if (this.MOBS?.includes('Thysts')) {
                if (particle.toString().includes('class_709')) {
                    cancel(event);
                }
            } else particleHandler.unregister();
        }).unregister();
    }
}

new MobHider();
