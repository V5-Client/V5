import { ModuleBase } from '../../utils/ModuleBase';

class AutoConversation extends ModuleBase {
    constructor() {
        super({
            name: 'AutoConversation',
            subcategory: 'Other',
            description: 'auto clicks on npc options in conversations',
        });

        this.delay = 20;

        this.on('chat', (ev) => {
            if (!this.enabled) return;
            const uf = ChatLib.removeFormatting(new String(ev.message)).trim();
            if (!uf.startsWith('[NPC]') && !uf.startsWith('Select an option:')) return;
            const getAllClickEvents = (comp) => {
                let commands = [];
                if (!comp) return commands;

                const style = comp.getStyle();
                const clickEvent = style ? style.getClickEvent() : null;

                if (clickEvent && clickEvent.getAction().name() === 'RUN_COMMAND') {
                    let value = null;
                    if (typeof clickEvent.getValue === 'function') value = clickEvent.getValue(); // likely redundant! but oh well!
                    else if (typeof clickEvent.comp_3506 === 'function') value = clickEvent.comp_3506();
                    else if (clickEvent.getValue) value = clickEvent.getValue;
                    else if (clickEvent.value) value = clickEvent.value;
                    else if (clickEvent.command) value = clickEvent.command;

                    if (value) commands.push(value);
                }

                const siblings = comp.getSiblings();
                for (const sibling of siblings) {
                    commands = commands.concat(getAllClickEvents(sibling));
                }

                return commands;
            };

            const commands = getAllClickEvents(ev.message);
            if (commands.length === 0) return;

            if (commands.length >= 2 && this.autoSelect) {
                Client.scheduleTask(this.delay, () => ChatLib.say(commands[0]));
            } else if (commands.length === 1) {
                Client.scheduleTask(this.delay, () => ChatLib.say(commands[0]));
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
