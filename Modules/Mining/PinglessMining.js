// Credits: Kash - MiningModules

import { Utils } from '../../Utility/Utils';
import { MiningUtils } from '../../Utility/MiningUtils';

const { addCategoryItem, addToggle, addSlider } = global.Categories;

class Pingless {
    constructor() {
        this.mining = false;
        let x;
        let y;
        let z;

        let playerAction = register('packetSent', (packet) => {
            if (!this.enabled || Utils.area() !== 'Crystal Hollows') return;

            let action = packet.getAction().toString();
            if (action === 'START_DESTROY_BLOCK') {
                this.pos = packet.getPos();

                x = this.pos.x;
                y = this.pos.y;
                z = this.pos.z;

                if (!Player.getPlayer().isOnGround()) return;
                if (
                    this.ticks < 4 &&
                    World.getBlockAt(x, y, z)
                        ?.type?.getRegistryName()
                        .includes('stained_glass')
                )
                    return; // i dont think this affects anymore ?

                if (
                    !Player.getHeldItem()
                        ?.getName()
                        ?.toLowerCase()
                        ?.match(/pick|drill|gauntlet/)
                )
                    return; // tools only

                let blockName = World.getBlockAt(
                    x,
                    y,
                    z
                )?.type?.getRegistryName();
                if (
                    (World.getBlockAt(x, y, z)?.type?.getID() !== 1 &&
                        !blockName.includes('ore')) ||
                    blockName.includes('redstone')
                )
                    return;

                this.mining = true;
            }
        })
            .setFilteredClass(
                net.minecraft.network.packet.c2s.play.PlayerActionC2SPacket
            )
            .unregister();

        let handSwing = register('packetSent', () => {
            if (!this.enabled || Utils.area() !== 'Crystal Hollows') return;

            if (this.mining) {
                if (this.tickCount > 0) {
                    this.tickCount--;
                } else {
                    MiningUtils.GhostBlock(this.pos);
                    this.mining = false;
                }
            }
        })
            .setFilteredClass(
                net.minecraft.network.packet.c2s.play.HandSwingC2SPacket
            )
            .unregister();

        addCategoryItem(
            'Mining',
            'Pingless Miner',
            'Breaks hardstone quicker in the Crystal Hollows',
            'Removes hardstone instantly client-side.'
        );
        addToggle(
            'Modules',
            'Pingless Miner',
            'Enabled',
            (value) => {
                value ? playerAction.register() : playerAction.unregister();
                value ? handSwing.register() : handSwing.unregister();
            },
            'Toggles pingless miner'
        );
        addSlider(
            'Modules',
            'Pingless Miner',
            'Tick Delay',
            0,
            5,
            1,
            (value) => {
                this.tickCount = value;
            },
            'How long to wait before removing hardstone.'
        );
    }
}

new Pingless();
