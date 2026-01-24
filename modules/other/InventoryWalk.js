import { Chat } from '../../utils/Chat';
import { ModuleBase } from '../../utils/ModuleBase';
import { ClickSlotC2S, OpenScreenS2C, CommonPingS2C } from '../../utils/Packets';
import { TypingState } from '../../gui/Utils';

class InventoryWalk extends ModuleBase {
    constructor() {
        super({
            name: 'Inventory Walk',
            subcategory: 'Other',
            description: 'Use at your own risk!\nTested on 150 ping and no ban but idk',
            tooltip: 'Use at your own risk.',
        });

        this.clicked = false;
        this.time = 0;
        this.lastPing = Date.now();
        this.keybinds = [
            new KeyBind(Client.getMinecraft().options.forwardKey),
            new KeyBind(Client.getMinecraft().options.leftKey),
            new KeyBind(Client.getMinecraft().options.rightKey),
            new KeyBind(Client.getMinecraft().options.backKey),
            new KeyBind(Client.getMinecraft().options.jumpKey),
            new KeyBind(Client.getMinecraft().options.sprintKey),
            new KeyBind(Client.getMinecraft().options.sneakKey),
        ];

        this.on('tick', () => {
            if (!Client.isInGui()) this.clicked = false;
            if (Client.isInChat() || (Client.isInGui() && TypingState.isTyping)) return;
            if ((!this.clicked && Date.now() - this.lastPing < 125) || Date.now() > this.time + 325 + (Date.now() - this.lastPing)) {
                Client.scheduleTask(0, () => {
                    this.keybinds.forEach((keybind) => {
                        let down = Keyboard.isKeyDown(keybind.getKeyCode());
                        if (down) keybind.setState(down);
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
        }).setFilteredClass(ClickSlotC2S);

        this.on('packetReceived', (packet) => {
            this.clicked = false;
            Client.scheduleTask(0, () => {
                this.keybinds.forEach((keybind) => {
                    let down = Keyboard.isKeyDown(keybind.getKeyCode()) && !Client.isInChat();
                    keybind.setState(down);
                });
            });
        }).setFilteredClass(OpenScreenS2C);

        this.on('packetReceived', (packet) => {
            this.lastPing = Date.now();
        }).setFilteredClass(CommonPingS2C);
    }
}

new InventoryWalk();
