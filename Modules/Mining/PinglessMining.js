// Credits: Kash - MiningModules

import { MiningUtils } from '../../utils/MiningUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import { PlayerActionC2SPacket, HandSwingC2SPacket } from '../../utils/Constants';

class Pingless extends ModuleBase {
    constructor() {
        super({
            name: 'Pingless Miner',
            subcategory: 'Mining',
            description: 'Breaks hardstone quicker in the Crystal Hollows',
            tooltip: 'Removes hardstone instantly client-side.',
        });

        this.mining = false;
        let x;
        let y;
        let z;

        this.on('packetSent', (packet) => {
            if (Utils.area() !== 'Crystal Hollows') return;

            let action = packet.getAction().toString();
            if (action === 'START_DESTROY_BLOCK') {
                this.pos = packet.getPos();

                x = this.pos.x;
                y = this.pos.y;
                z = this.pos.z;

                if (!Player.getPlayer().isOnGround()) return;
                if (this.ticks < 4 && World.getBlockAt(x, y, z)?.type?.getRegistryName().includes('stained_glass')) return; // i dont think this affects anymore ?

                if (
                    !Player.getHeldItem()
                        ?.getName()
                        ?.toLowerCase()
                        ?.match(/pick|drill|gauntlet/)
                )
                    return; // tools only

                let blockName = World.getBlockAt(x, y, z)?.type?.getRegistryName();
                if ((World.getBlockAt(x, y, z)?.type?.getID() !== 1 && !blockName.includes('ore')) || blockName.includes('redstone')) return;

                this.mining = true;
            }
        }).setFilteredClass(PlayerActionC2SPacket);

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
        }).setFilteredClass(HandSwingC2SPacket);

        this.addSlider('Tick Delay', 0, 5, 1, (v) => (this.tickCount = v), 'How long to wait before removing hardstone.');
    }
}

new Pingless();
