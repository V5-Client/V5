import { TypingState } from '../../gui/Utils';
import { ModuleBase } from '../../utils/ModuleBase';
import { ClientboundOpenScreenPacket, ServerboundContainerClickPacket } from '../../utils/Packets';
import { ScheduleTask } from '../../utils/ScheduleTask';

class InventoryWalk extends ModuleBase {
    constructor() {
        super({
            name: 'modules.inventory_walk.name',
            subcategory: 'Other',
            description: 'modules.inventory_walk.description',
            tooltip: 'modules.inventory_walk.tooltip',
        });

        this.clicked = false;
        this.time = 0;
        this.lastPacketTime = Date.now();
        this.actionToken = 0;
        this.keybinds = [
            new KeyBind(Client.getMinecraft().options.keyUp),
            new KeyBind(Client.getMinecraft().options.keyLeft),
            new KeyBind(Client.getMinecraft().options.keyRight),
            new KeyBind(Client.getMinecraft().options.keyDown),
            new KeyBind(Client.getMinecraft().options.keyJump),
            new KeyBind(Client.getMinecraft().options.keySprint),
            new KeyBind(Client.getMinecraft().options.keyShift),
        ];

        this.on('tick', () => {
            if (!Client.isInGui()) this.clicked = false;
            if (Client.isInChat() || (Client.isInGui() && TypingState.isTyping)) return;
            const sincePing = Date.now() - this.lastPacketTime;
            if ((!this.clicked && sincePing < 100) || Date.now() > this.time + 350 + sincePing) {
                const token = this.actionToken;
                ScheduleTask(0, () => {
                    if (!this.enabled || token !== this.actionToken) return;
                    this.keybinds.forEach((keybind) => {
                        const down = Keyboard.isKeyDown(keybind.getKeyCode());
                        if (down) keybind.setState(down);
                    });
                });
            } else {
                this.keybinds.forEach((keybind) => {
                    keybind.setState(false);
                });
            }
        });

        this.on('packetSent', () => {
            this.clicked = true;
            this.time = Date.now();
            this.keybinds.forEach((keybind) => {
                keybind.setState(false);
            });
        }).setFilteredClass(ServerboundContainerClickPacket);

        this.on('packetReceived', () => {
            this.clicked = false;
            const token = this.actionToken;
            ScheduleTask(0, () => {
                if (!this.enabled || token !== this.actionToken) return;
                this.keybinds.forEach((keybind) => {
                    const down = Keyboard.isKeyDown(keybind.getKeyCode()) && !Client.isInChat();
                    keybind.setState(down);
                });
            });
        }).setFilteredClass(ClientboundOpenScreenPacket);

        this.on('packetReceived', () => {
            this.lastPacketTime = Date.now();
        });
    }

    onDisable() {
        this.actionToken++;
        this.clicked = false;
        this.time = 0;
        this.keybinds.forEach((keybind) => keybind.setState(false));
    }
}

new InventoryWalk();
