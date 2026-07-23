import { ModuleBase } from '../../utils/ModuleBase';
import { ScheduleTask } from '../../utils/ScheduleTask';

class AutoConversation extends ModuleBase {
    constructor() {
        super({
            name: 'Auto Conversation',
            subcategory: 'Other',
            description: 'auto clicks on npc options in conversations',
        });

        this.autoSelect = true;
        this.actionToken = 0;

        this.on('chat', (event) => {
            if (!this.enabled) return;
            const unformatted = ChatLib.removeFormatting(String(event.message)).trim();
            if (!unformatted.startsWith('[NPC]') && !unformatted.startsWith('Select an option:')) return;
            const getAllClickEvents = (comp) => {
                let commands = [];
                if (!comp) return commands;

                const style = comp.getStyle();
                const clickEvent = style ? style.getClickEvent() : null;

                if (clickEvent && clickEvent.action().name() === 'RUN_COMMAND') {
                    let value = null;

                    try {
                        value = clickEvent.command();
                    } catch (e) {
                        console.error('V5 Caught error' + e + e.stack);
                    }

                    if (value) commands.push(value);
                }

                const siblings = comp.getSiblings?.() || [];
                for (const sibling of siblings) {
                    commands = commands.concat(getAllClickEvents(sibling));
                }

                return commands;
            };

            const commands = getAllClickEvents(event.message);
            if (commands.length === 0) return;

            if (commands.length === 1 || this.autoSelect) {
                const token = this.actionToken;
                ScheduleTask(1, () => {
                    if (this.enabled && token === this.actionToken) ChatLib.command(commands[0].replace(/^\//, ''));
                });
            }
        });

        this.addToggle(
            'Select First (if multiple)',
            (v) => (this.autoSelect = v),
            'Automatically select the first option if multiple are present',
            this.autoSelect
        );
    }

    onDisable() {
        this.actionToken++;
    }
}

new AutoConversation();
