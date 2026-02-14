import { Chat } from './Chat';
import { BlockUpdateS2C } from './Packets';

class FlowstateUtilsClass {
    constructor() {
        this.countdown = 0;
        this.multiplier = 1;
        this.flowstateBlocksBroken = 0;

        let blockx = 0;
        let blocky = 0;
        let blockz = 0;
        let currentBlock = null;

        register('playerInteract', (action, object) => {
            if (action.toString() === 'AttackBlock') {
                if (!object.type.name.toLowerCase().includes('bedrock')) {
                    blockx = object.getX();
                    blocky = object.getY();
                    blockz = object.getZ();
                    currentBlock = object;
                } else {
                    blockx = blocky = blockz = 0;
                }
            }
        });

        register('PacketReceived', (packet) => {
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
                packet?.getPos()?.getX() == blockx &&
                packet?.getPos()?.getY() == blocky &&
                packet?.getPos()?.getZ() == blockz &&
                (packet?.getState()?.getBlock()?.toString()?.includes('bedrock') || packet?.getState()?.getBlock()?.toString()?.includes('air'))
            ) {
                this.countdown = 10;
                this.flowstateBlocksBroken += bonus;
                if (this.flowstateBlocksBroken > 100 * this.multiplier) {
                    if (this.multiplier === 6) {
                        this.isMax = true;
                        Chat.message('Reached max Flowstate! (600)');
                        this.multiplier++;
                        return;
                    }
                    let rounded = Math.floor(this.flowstateBlocksBroken / 100) * 100;
                    Chat.message(`Current Flowstate: ${rounded}`);
                    this.multiplier++;
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
