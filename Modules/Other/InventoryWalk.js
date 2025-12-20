import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';

class InventoryWalk extends ModuleBase {
    constructor() {
        super({
            name: 'Inventory Walk',
            subcategory: 'Other',
            description: 'Use at your own risk!\nTested on 150 ping and no ban but idk',
            tooltip: 'Use at your own risk.',
        });

        this.clicked = false;
        this.time = Date.now();
        this.lastPing = Date.now();
        this.keybinds = [
            new KeyBind(Client.getMinecraft().options.forwardKey),
            new KeyBind(Client.getMinecraft().options.leftKey),
            new KeyBind(Client.getMinecraft().options.rightKey),
            new KeyBind(Client.getMinecraft().options.backKey),
            new KeyBind(Client.getMinecraft().options.jumpKey),
        ];

        this.on('tick', () => {
            if (!Player.getContainer()) this.clicked = false;
            if ((!this.clicked && Date.now() - this.lastPing > 125) || Date.now() > this.time + 325 + (Date.now() - this.lastPing)) {
                Client.scheduleTask(0, () => {
                    this.keybinds.forEach((keybind) => {
                        let down = Keyboard.isKeyDown(keybind.getKeyCode()) && !Client.isInChat();
                        keybind.setState(down);
                    });
                });
            } else {
                this.keybinds.forEach((keybind) => {
                    keybind.setState(false);
                });
            }
        });

        this.on('packetSent', (packet) => {
            this.clicked = true;
            this.time = Date.now();
            this.keybinds.forEach((keybind) => {
                keybind.setState(false);
            });
        }).setFilteredClass(net.minecraft.network.packet.c2s.play.ClickSlotC2SPacket);

        this.on('packetReceived', (packet) => {
            this.clicked = false;
            Client.scheduleTask(0, () => {
                this.keybinds.forEach((keybind) => {
                    let down = Keyboard.isKeyDown(keybind.getKeyCode()) && !Client.isInChat();
                    keybind.setState(down);
                });
            });
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.OpenScreenS2CPacket);

        this.on('packetReceived', (packet) => {
            this.lastPing = Date.now();
        }).setFilteredClass(net.minecraft.network.packet.s2c.common.CommonPingS2CPacket);
    }
}

new InventoryWalk();
