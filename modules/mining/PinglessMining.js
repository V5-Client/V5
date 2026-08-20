// Credits: Kash - MiningModules

import { setGhostBlock } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { ServerboundSwingPacket, ServerboundPlayerActionPacket } from '../../utils/Packets';
import { area } from '../../utils/Utils';

class Pingless extends ModuleBase {
    constructor() {
        super({
            name: 'modules.pingless_miner.name',
            subcategory: 'Mining',
            description: 'modules.pingless_miner.description',
            tooltip: 'modules.pingless_miner.tooltip',
        });

        this.mining = false;
        this.tickDelay = 1;
        this.tickCount = 0;

        this.on('packetSent', (packet) => {
            if (area() !== 'Crystal Hollows') return;

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
            if (area() !== 'Crystal Hollows') return;
            if (!this.mining || !this.pos) return;

            if (this.tickCount > 0) {
                this.tickCount--;
            } else {
                setGhostBlock(this.pos);
                this.mining = false;
                this.pos = null;
            }
        }).setFilteredClass(ServerboundSwingPacket);

        this.addSlider('labels.tick_delay', 0, 5, 1, (v) => (this.tickDelay = v), 'descriptions.tick_delay_pingless');
    }

    onDisable() {
        this.mining = false;
        this.pos = null;
    }
}

new Pingless();
