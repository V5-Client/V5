import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Utils } from '../../utils/Utils';
import Render from '../../utils/render/Render';

const NAMES = new Set(['Cow', 'Pig', 'Sheep', 'Chicken', 'Rabbit', 'Horse', 'Mooshroom', 'Dinnerbone']);
const HP = new Set([100, 200, 500, 1000, 2000, 5000, 10000, 1024, 20000, 30000, 60000]);
const WHITE = [255, 255, 255];
const RGB = {
    0: [0, 0, 0],
    1: [0, 0, 170],
    2: [0, 170, 0],
    3: [0, 170, 170],
    4: [170, 0, 0],
    5: [170, 0, 170],
    6: [255, 170, 0],
    7: [170, 170, 170],
    8: [85, 85, 85],
    9: [85, 85, 255],
    a: [85, 255, 85],
    b: [85, 255, 255],
    c: [255, 85, 85],
    d: [255, 85, 255],
    e: [255, 255, 85],
    f: [255, 255, 255],
};
const FINISH = ['killing the animal rewarded you', 'your mob died randomly, you are rewarded'];
const RETRY = ["[npc] trevor: i couldn't locate any animals. come back in a little bit!", "[npc] trevor: i'm currently hunting! don't call again!"];

class PeltQOL extends ModuleBase {
    constructor() {
        super({
            name: 'Pelt QOL',
            subcategory: 'Farming',
            description: 'Highlights Trevor hunt animals.',
            tooltip: 'Highlights Trevor hunt animals.',
            theme: '#d99a3e',
        });

        this.autoAcceptQuest = true;
        this.autoCallTrevor = true;
        this.rezarAbicaseAccessory = true;
        this.renderESP = true;
        this.animals = [];
        this.huntCompleted = false;
        this.rarityRgb = WHITE;

        this.addToggle('Auto Accept Quest', (value) => (this.autoAcceptQuest = !!value), "Automatically clicks Trevor's YES prompt to start a hunt.", true);
        this.addToggle('Auto Call Trevor', (value) => (this.autoCallTrevor = !!value), 'Automatically runs /call trevor when a hunt completes.', true);
        this.addToggle(
            'Rezar Abicase Accessory',
            (value) => (this.rezarAbicaseAccessory = !!value),
            'Use the shorter Trevor recall delay when the Rezar Abicase Accessory is equipped.',
            true
        );
        this.addToggle('ESP', (value) => (this.renderESP = !!value), 'ESP to Trevor animals.', true);

        this.on('chat', ({ message }) => this.handleChat(message));
        this.on('tick', () => this.scan());
        this.on('worldUnload', () => this.reset());
        this.when(
            () => this.enabled && this.renderESP && Utils.area() === 'The Farming Islands' && this.animals.length,
            'postRenderWorld',
            () => this.render()
        );
    }

    onDisable() {
        this.reset();
    }

    ensureForceEnabled() {
        this.autoAcceptQuest = true;
        this.autoCallTrevor = true;
        this.renderESP = true;
        this.toggle(true);
    }

    reset() {
        this.animals = [];
        this.huntCompleted = false;
        this.rarityRgb = WHITE;
    }

    run(command, delay = 0) {
        command = `${command || ''}`.trim().replace(/^\//, '');
        if (!command) return;
        if (delay > 0) {
            ScheduleTask(delay, () => ChatLib.command(command));
            return;
        }
        ChatLib.command(command);
    }

    findStart(message) {
        const event = message.getStyle().getClickEvent();
        const command = event && event.getAction().name() === 'RUN_COMMAND' && event.comp_3506();
        if (command && /^\s*\/chatprompt\b.*\byes\s*$/i.test(command)) return command;
        for (const child of message.getSiblings()) {
            const found = this.findStart(child);
            if (found) return found;
        }
    }

    handleChat(message) {
        if (!this.enabled || Utils.area() !== 'The Farming Islands') return;

        const formatted = message.getFormattedText();
        const lower = ChatLib.removeFormatting(message.getUnformattedText()).trim().toLowerCase();
        const color = lower.includes('[npc] trevor: you can find your') && lower.includes('animal near the') && formatted.match(/§([0-9a-f])§l[^\s]+/i);
        if (color) this.rarityRgb = RGB[color[1].toLowerCase()] || WHITE;

        const start = this.findStart(message);
        if (start) {
            this.huntCompleted = false;
            if (this.autoAcceptQuest) this.run(start);
        }

        if (FINISH.some((hint) => lower.includes(hint))) {
            this.huntCompleted = true;
            this.animals = [];
            if (this.autoCallTrevor) this.run('call trevor');
            return;
        }

        if (this.autoCallTrevor && RETRY.some((hint) => lower.includes(hint))) return this.run('call trevor');

        const cooldown = this.autoCallTrevor && lower.match(/\[npc\] trevor: try coming back in.*?(\d+)\s*s\b/);
        if (cooldown) {
            const delayOffset = this.rezarAbicaseAccessory ? 40 : 80;
            this.run('call trevor', Math.max(+cooldown[1] * 20 - delayOffset, 0));
        }
    }

    scan() {
        if (!this.enabled || Utils.area() !== 'The Farming Islands' || this.huntCompleted) return (this.animals = []);
        this.animals = World.getAllEntities().filter((e) => NAMES.has(e.getName()) && !e.isDead() && HP.has(e.getMaxHP()));
    }

    render() {
        const [r, g, b] = this.rarityRgb;
        const fill = Render.Color(r, g, b, 90);
        const line = Render.Color(r, g, b, 255);

        this.animals.forEach((e) => {
            const w = e.getWidth();
            const h = e.getHeight();
            const x = e.getX();
            const y = e.getY();
            const z = e.getZ();
            Render.drawSizedBox(new Vec3d(x, y, z), w, h, w, fill, true, 1, false);
            Render.drawTracer(new Vec3d(x, y + h / 2, z), line, 2, false);
        });
    }
}

export const PeltQOLModule = new PeltQOL();
