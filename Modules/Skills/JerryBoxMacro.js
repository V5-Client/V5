import { Chat } from '../../Utility/Chat';
import { Guis } from '../../Utility/Inventory';
import { Keybind } from '../../Utility/Keybinding';
import { Mouse } from '../../Utility/Ungrab';
import { ModuleBase } from '../../Utility/ModuleBase';

class JerryBoxMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Jerry Box Macro',
            subcategory: 'Other',
            description: 'Automatically opens Jerry Boxes',
            tooltip: 'Right click -> click open -> close GUI -> repeat',
            autoDisableOnWorldUnload: true,
            showEnabledToggle: false,
        });
        this.bindToggleKey();

        this.STATES = {
            IDLE: 0,
            RIGHT_CLICK: 1,
            CLICK_BUTTON: 2,
            CLOSE_GUI: 3,
        };

        this.state = this.STATES.IDLE;
        this.cooldown = 3;
        this.delay = 3;

        this.addSlider(
            'Delay',
            0,
            10,
            3,
            (v) => (this.delay = v),
            'Ticks between actions'
        );

        this.on('tick', () => {
            if (this.cooldown > 0) {
                this.cooldown--;
                return;
            }
            const invName = Guis.guiName();

            switch (this.state) {
                case this.STATES.IDLE:
                    this.setState(this.STATES.RIGHT_CLICK);
                    break;

                case this.STATES.RIGHT_CLICK:
                    // Ensure we are holding a Jerry Box; swap if needed, stop if none
                    {
                        const held = Player.getHeldItem();
                        const isHoldingJerry =
                            held?.getName &&
                            held.getName().toString().includes('Jerry Box');

                        if (!isHoldingJerry) {
                            const slot = Guis.findItemInHotbar('Jerry Box');
                            if (slot === -1) {
                                Chat.message('Out of Jerry Boxes. Disabling.');
                                this.toggle(false);
                                return;
                            }
                            if (Player.getHeldItemIndex() !== slot) {
                                Player.setHeldItemIndex(slot);
                                // give the swap a tick to register
                                this.setState(this.STATES.RIGHT_CLICK, 1);
                                return;
                            }
                        }
                    }
                    if (Client.isInGui() && !Client.isInChat()) {
                        return this.setState(this.STATES.CLICK_BUTTON);
                    }
                    Keybind.rightClick();
                    this.setState(this.STATES.CLICK_BUTTON);
                    break;

                case this.STATES.CLICK_BUTTON: {
                    if (
                        !invName?.includes('Open a Jerry Box') ||
                        !Player.getContainer()
                    ) {
                        break;
                    }
                    // Center slot (22) is the Open button
                    Guis.clickSlot(22, false, 'MIDDLE');
                    this.setState(this.STATES.CLOSE_GUI);
                    break;
                }

                case this.STATES.CLOSE_GUI:
                    // Close Jery Box and repeat
                    Client.currentGui?.close();
                    this.setState(this.STATES.RIGHT_CLICK);
                    break;
            }
        });
    }

    onEnable() {
        Chat.message('Jerry Box Macro enabled.');
        this.state = this.STATES.IDLE;
        this.cooldown = 0;
        Mouse.Ungrab();
    }

    onDisable() {
        Chat.message('Jerry Box Macro disabled.');
        this.state = this.STATES.IDLE;
        this.cooldown = 0;
        Mouse.Regrab();
    }

    setState(newState, waitTicks = this.delay) {
        this.state = newState;
        this.cooldown = waitTicks;
    }
}
new JerryBoxMacro();
