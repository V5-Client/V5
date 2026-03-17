import { TypingState } from '../../gui/Utils';
import { ModuleBase } from '../../utils/ModuleBase';
import { ClickSlotC2S, CommonPingS2C, OpenScreenS2C } from '../../utils/Packets';
import { ScheduleTask } from '../../utils/ScheduleTask';

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
        const options = Client.getMinecraft().options;
        this.keybinds = [options.forwardKey, options.leftKey, options.rightKey, options.backKey, options.jumpKey, options.sprintKey, options.sneakKey].map(
            (keybind) => ({
                getKeyCode: () => (typeof keybind.getKeyCode === 'function' ? keybind.getKeyCode() : (keybind.boundKey?.code ?? -1)),
                setState: (down) => {
                    if (typeof keybind.setState === 'function') keybind.setState(!!down);
                    else if (typeof keybind.setPressed === 'function') keybind.setPressed(!!down);
                },
            })
        );

        this.on('tick', () => {
            if (!Client.isInGui()) this.clicked = false;
            if (Client.isInChat() || (Client.isInGui() && TypingState.isTyping)) return;
            let sincePing = Date.now() - this.lastPing;
            if ((!this.clicked && sincePing < 125) || Date.now() > this.time + 325 + sincePing) {
                ScheduleTask(0, () => {
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
            ScheduleTask(0, () => {
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

    onDisable() {
        this.clicked = false;
        this.time = 0;
        this.keybinds.forEach((keybind) => keybind.setState(false));
    }
}

new InventoryWalk();
