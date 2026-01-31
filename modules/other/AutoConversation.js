import { ModuleBase } from '../../utils/ModuleBase';
import { Chat } from '../../utils/Chat';
import { ScheduleTask } from '../../utils/ScheduleTask';

class AutoConversation extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Conversation',
            subcategory: 'Other',
            description: 'auto clicks on npc options in conversations',
        });

        this.delay = 20;

        this.on('chat', (event) => {
            if (!this.enabled) return;
            const unformatted = ChatLib.removeFormatting(new String(event.message)).trim();
            if (!unformatted.startsWith('[NPC]') && !unformatted.startsWith('Select an option:')) return;
            const getAllClickEvents = (comp) => {
                let commands = [];
                if (!comp) return commands;

                const style = comp.getStyle();
                const clickEvent = style ? style.getClickEvent() : null;

                if (clickEvent && clickEvent.getAction().name() === 'RUN_COMMAND') {
                    let value = null;

                    try {
                        value = clickEvent.comp_3506();
                    } catch (e) {
                        console.error('V5 Caught error' + e + e.stack);
                    }

                    if (value) commands.push(value);
                }

                const siblings = comp.getSiblings();
                for (const sibling of siblings) {
                    commands = commands.concat(getAllClickEvents(sibling));
                }

                return commands;
            };

            const commands = getAllClickEvents(event.message);
            if (commands.length === 0) return;

            if (commands.length >= 2 && this.autoSelect) {
                ScheduleTask(this.delay, () => ChatLib.say(commands[0]));
            } else if (commands.length === 1) {
                ScheduleTask(this.delay, () => ChatLib.say(commands[0]));
            }
        });

        this.addSlider('Delay', 0, 100, 20, (v) => (this.delay = v), 'Delay in ticks before clicking');
        this.addToggle(
            'Select First (if multiple)',
            (v) => (this.autoSelect = v),
            'Automatically select the first option if multiple are present',
            this.autoSelect
        );
        this.autoSelect = true;
    }
}

new AutoConversation();
