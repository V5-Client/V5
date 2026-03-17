import { Chat } from './Chat';
import { BlockUpdateS2C } from './Packets';

class FlowstateUtilsClass {
    constructor() {
        this.countdown = 0;
        this.multiplier = 1;
        this.flowstateBlocksBroken = 0;
        this.isMax = false;

        this.block = { x: 0, y: 0, z: 0 };
        this.currentBlock = null;

        register('playerInteract', (action, object) => {
            if (String(action) === 'AttackBlock') {
                const typeName = object?.type?.name ? String(object.type.name).toLowerCase() : '';
                if (typeName && !typeName.includes('bedrock')) {
                    this.block.x = object.getX();
                    this.block.y = object.getY();
                    this.block.z = object.getZ();
                    this.currentBlock = object;
                } else {
                    this.block.x = this.block.y = this.block.z = 0;
                }
            }
        });

        register('packetReceived', (packet) => {
            if (Player.getHeldItem() === null) return;

            let lore = Player.getHeldItem()
                .getLore()
                .map((l) => ChatLib.removeFormatting(l))
                .join(' ');

            let match = lore.match(/flowstate\s*(i{1,3})/i);
            const roman = { I: 1, II: 2, III: 3 };
            let bonus = match ? roman[match[1].toUpperCase()] || 0 : 0;

            if (
                match &&
                packet?.getPos()?.getX() == this.block.x &&
                packet?.getPos()?.getY() == this.block.y &&
                packet?.getPos()?.getZ() == this.block.z &&
                (packet?.getState()?.getBlock()?.toString()?.includes('bedrock') || packet?.getState()?.getBlock()?.toString()?.includes('air'))
            ) {
                this.flowstateBlocksBroken += bonus;
                this.countdown = 10;

                if (this.isMax) return;

                if (this.flowstateBlocksBroken > 100 * this.multiplier) {
                    if (this.multiplier === 6) {
                        this.isMax = true;
                        return Chat.message('Reached max Flowstate!');
                    }

                    this.multiplier++;

                    let rounded = Math.floor(this.flowstateBlocksBroken / 100) * 100;
                    Chat.message(`Current Flowstate: ${rounded}`);
                }
            }
        }).setFilteredClass(BlockUpdateS2C);

        register('step', () => {
            if (this.countdown === 0) {
                if (this.flowstateBlocksBroken > 100) {
                    Chat.message(`Flowstate lost at ${this.flowstateBlocksBroken} blocks`);
                }
                this.isMax = false;
                this.flowstateBlocksBroken = 0;
            }

            if (this.countdown > 0) this.countdown--;
            if (this.isMax) this.flowstateBlocksBroken = 600;
        }).setFps(1);
    }

    CurrentFlowstate() {
        return Math.min(600, this.flowstateBlocksBroken);
    }
}

export const Flowstate = new FlowstateUtilsClass();
