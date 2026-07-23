// Credits: Kash - MiningModules

import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { ServerboundSwingPacket, ServerboundPlayerActionPacket } from '../../utils/Packets';
import { Utils } from '../../utils/Utils';

class Pingless extends ModuleBase {
    constructor() {
        super({
            name: 'Pingless Miner',
            subcategory: 'Mining',
            description: 'Breaks hardstone quicker in the Crystal Hollows',
            tooltip: 'Removes hardstone instantly client-side.',
        });

        this.mining = false;
        this.tickDelay = 1;
        this.tickCount = 0;

        this.on('packetSent', (packet) => {
            if (Utils.area() !== 'Crystal Hollows') return;

            let action = packet?.getAction()?.toString();
            if (action === 'START_DESTROY_BLOCK') {
                const pos = packet?.getPos();
                if (!pos) return;
                this.mining = false;
                this.pos = null;
                const { x, y, z } = pos;

                const player = Player.getPlayer();
                if (!player || !player.onGround()) return;

                if (
                    !Player.getHeldItem()
                        ?.getName()
                        ?.toLowerCase()
                        ?.match(/pick|drill|gauntlet/)
                )
                    return; // tools only

                const block = World.getBlockAt(x, y, z);
                const blockName = block?.type?.getRegistryName() || '';
                if ((block?.type?.getID() !== 1 && !blockName.includes('ore')) || blockName.includes('redstone')) return;

                this.pos = pos;
                this.tickCount = this.tickDelay;
                this.mining = true;
            }
        }).setFilteredClass(ServerboundPlayerActionPacket);

        this.on('packetSent', () => {
            if (Utils.area() !== 'Crystal Hollows') return;
            if (!this.mining || !this.pos) return;

            if (this.tickCount > 0) {
                this.tickCount--;
            } else {
                MiningUtils.GhostBlock(this.pos);
                this.mining = false;
                this.pos = null;
            }
        }).setFilteredClass(ServerboundSwingPacket);

        this.addSlider('Tick Delay', 0, 5, 1, (v) => (this.tickDelay = v), 'How long to wait before removing hardstone.');
    }

    onDisable() {
        this.mining = false;
        this.pos = null;
    }
}

new Pingless();
