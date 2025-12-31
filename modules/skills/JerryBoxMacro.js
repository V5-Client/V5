import { Chat } from '../../utils/Chat';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { ModuleBase } from '../../utils/ModuleBase';
import { Mouse } from '../../utils/Ungrab';
import { MacroState } from '../../utils/MacroState';
class JerryBoxMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Jerry Box Macro',
            subcategory: 'Skills',
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
        this.guiWaitMax = 10; // anyone above 500ms should quit skyblock
        this.waitLeft = 0;

        this.addSlider('Delay', 0, 10, 3, (v) => (this.delay = v), 'Ticks between actions');

        this.on('tick', () => {
            if (this.cooldown > 0) {
                this.cooldown--;
                return;
            }

            switch (this.state) {
                case this.STATES.IDLE:
                    this.setState(this.STATES.RIGHT_CLICK);
                    break;

                case this.STATES.RIGHT_CLICK:
                    // Ensure we are holding a Jerry Box; swap if needed, stop if none
                    {
                        const held = Player.getHeldItem();
                        const isHoldingJerry = held?.getName()?.toString()?.includes('Jerry Box');

                        if (!isHoldingJerry) {
                            const slot = Guis.findItemInHotbar('Jerry Box');
                            if (slot === -1) {
                                Chat.message('Out of Jerry Boxes. Disabling.');
                                this.toggle(false);
                                return;
                            }
                            if (Player.getHeldItemIndex() !== slot) {
                                Player.setHeldItemIndex(slot);
                                this.setState(this.STATES.RIGHT_CLICK);
                                return;
                            }
                        }
                    }
                    // If a GUI is open, handle Jerry Box GUI or close others
                    if (Client.isInGui() && !Client.isInChat()) {
                        if (Guis.guiName()?.includes('Open a Jerry Box')) {
                            this.waitLeft = this.guiWaitMax;
                            return this.setState(this.STATES.CLICK_BUTTON);
                        }
                        // Not Jerry Box GUI – close and retry
                        Client.currentGui?.close();
                        this.setState(this.STATES.RIGHT_CLICK);
                        return;
                    }
                    Keybind.rightClick();
                    this.waitLeft = this.guiWaitMax;
                    this.setState(this.STATES.CLICK_BUTTON);
                    break;

                case this.STATES.CLICK_BUTTON: {
                    const container = Player.getContainer();
                    // Check container exists, GUI is jerry box, and Open button exists
                    if (!container || !container.getStackInSlot(22) || !Guis.guiName()?.includes('Open a Jerry Box')) {
                        if (this.waitLeft > 0) {
                            this.waitLeft--;
                        } else {
                            this.setState(this.STATES.RIGHT_CLICK);
                        }
                        break;
                    }
                    // Center slot (22) is the Open button
                    Guis.clickSlot(22, false, 'MIDDLE');
                    this.setState(this.STATES.CLOSE_GUI);
                    break;
                }

                case this.STATES.CLOSE_GUI:
                    if (Client.isInGui() && !Client.isInChat()) {
                        Client.currentGui?.close();
                    }
                    this.setState(this.STATES.RIGHT_CLICK);
                    break;
            }
        });
    }

    onEnable() {
        MacroState.setMacroRunning(true, 'JERRY_BOX');
        Chat.message('Jerry Box Macro enabled.');
        this.state = this.STATES.IDLE;
        this.cooldown = 0;
        Mouse.ungrab();
    }

    onDisable() {
        MacroState.setMacroRunning(false, 'JERRY_BOX');
        Chat.message('Jerry Box Macro disabled.');
        this.state = this.STATES.IDLE;
        this.cooldown = 0;
        Mouse.regrab();
    }

    setState(newState, waitTicks = this.delay) {
        this.state = newState;
        this.cooldown = waitTicks;
    }
}
new JerryBoxMacro();
