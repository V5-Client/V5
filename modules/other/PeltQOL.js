import { Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Utils } from '../../utils/Utils';
import { Guis } from '../../utils/player/Inventory';

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

const ABIPHONE = {
    IDLE: 0,
    FIND_ABIPHONE: 1,
    RIGHT_CLICK: 2,
    FIND_TREVOR: 3,
    CLICK_TREVOR: 4,
    DONE: 5,
};

class PeltQOL extends ModuleBase {
    constructor() {
        super({
            name: 'Pelt QOL',
            subcategory: 'Other',
            description: 'Highlights Trevor hunt animals.',
            tooltip: 'Highlights Trevor hunt animals.',
            theme: '#d99a3e',
        });

        this.autoAcceptQuest = true;
        this.callMode = '/call';
        this.rezarAbicaseAccessory = true;
        this.renderESP = true;
        this.animals = [];
        this.huntCompleted = false;
        this.rarityRgb = WHITE;
        this.abiphoneState = ABIPHONE.IDLE;
        this.abiphoneWait = 0;
        this.abiphoneSlot = -1;
        this.trevorSlot = -1;
        this.actionToken = 0;

        this.addToggle('Auto Accept Quest', (value) => (this.autoAcceptQuest = !!value), "Automatically clicks Trevor's YES prompt to start a hunt.", true);
        this.addMultiToggle(
            'Call Mode',
            ['Disabled', '/call', 'Abiphone'],
            true,
            (options) => {
                this.callMode = options.find((o) => o.enabled)?.name || '/call';
            },
            'How to call Trevor when a hunt completes.',
            '/call'
        );
        this.addToggle(
            'Rezar Abicase Accessory',
            (value) => (this.rezarAbicaseAccessory = !!value),
            'Use the shorter Trevor recall delay when the Rezar Abicase Accessory is equipped.'
        );
        this.addToggle('ESP', (value) => (this.renderESP = !!value), 'ESP to Trevor animals.', true);

        this.on('chat', ({ message }) => this.handleChat(message));
        this.on('tick', () => {
            this.scan();
            this.tick();
        });
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
        this.renderESP = true;
        this.toggle(true);
    }

    reset() {
        this.actionToken++;
        this.animals = [];
        this.huntCompleted = false;
        this.rarityRgb = WHITE;
        this.abiphoneState = ABIPHONE.IDLE;
        this.abiphoneWait = 0;
    }

    run(command, delay = 0) {
        command = `${command || ''}`.trim().replace(/^\//, '');
        if (!command) return;
        if (delay > 0) {
            const token = this.actionToken;
            ScheduleTask(delay, () => {
                if (this.enabled && token === this.actionToken) ChatLib.command(command);
            });
            return;
        }
        ChatLib.command(command);
    }

    findStart(message) {
        const event = message.getStyle().getClickEvent();
        const command = event && event.action().name() === 'RUN_COMMAND' && event.command();
        if (command && /^\s*\/chatprompt\b.*\byes\s*$/i.test(command)) return command;
        for (const child of message.getSiblings()) {
            const found = this.findStart(child);
            if (found) return found;
        }
    }

    callTrevor(delay = 0, scheduleAbiphone = false) {
        if (this.callMode === '/call') return this.run('call trevor', delay);
        if (this.callMode === 'Abiphone') {
            if (scheduleAbiphone) {
                const token = this.actionToken;
                return ScheduleTask(delay - 20, () => {
                    if (this.enabled && token === this.actionToken && this.callMode === 'Abiphone') this.startAbiphoneCall();
                });
            }
            this.startAbiphoneCall();
        }
    }

    startAbiphoneCall() {
        this.abiphoneState = ABIPHONE.FIND_ABIPHONE;
        this.abiphoneWait = 0;
    }

    tick() {
        if (this.abiphoneState === ABIPHONE.IDLE) return;
        if (this.abiphoneWait > 0) {
            this.abiphoneWait--;
            return;
        }

        switch (this.abiphoneState) {
            case ABIPHONE.FIND_ABIPHONE: {
                const inv = Player.getInventory();
                this.abiphoneSlot = -1;
                for (let i = 0; i < 9; i++) {
                    const item = inv.getStackInSlot(i);
                    if (item && item.getName().includes('Abiphone')) {
                        this.abiphoneSlot = i;
                        break;
                    }
                }
                if (this.abiphoneSlot !== -1) {
                    Guis.setItemSlot(this.abiphoneSlot);
                    this.abiphoneWait = 5;
                    this.abiphoneState = ABIPHONE.RIGHT_CLICK;
                    return;
                }
                this.message('Abiphone not found in hotbar!');
                this.abiphoneState = ABIPHONE.IDLE;
                break;
            }
            case ABIPHONE.RIGHT_CLICK: {
                Client.rightClick();
                this.abiphoneWait = 10;
                this.abiphoneState = ABIPHONE.FIND_TREVOR;
                break;
            }
            case ABIPHONE.FIND_TREVOR: {
                if (Guis.guiName()?.includes('Abiphone')) {
                    this.trevorSlot = Guis.findFirst(Player.getContainer(), 'Trevor');
                    if (this.trevorSlot !== -1) {
                        this.abiphoneWait = 5;
                        this.abiphoneState = ABIPHONE.CLICK_TREVOR;
                        return;
                    }
                }
                this.abiphoneWait = 5;
                break;
            }
            case ABIPHONE.CLICK_TREVOR: {
                Guis.clickSlot(this.trevorSlot, false, 'LEFT');
                this.abiphoneWait = 5;
                this.abiphoneState = ABIPHONE.DONE;
                break;
            }
            case ABIPHONE.DONE: {
                this.abiphoneState = ABIPHONE.IDLE;
                break;
            }
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
            this.callTrevor();
            return;
        }

        if (this.callMode === 'Disabled') return;
        if (RETRY.some((hint) => lower.includes(hint))) {
            this.callTrevor();
            return;
        }

        const cooldown = lower.match(/\[npc\] trevor: try coming back in.*?(\d+)\s*s\b/);
        if (cooldown) {
            const delay = Math.max(+cooldown[1] * 20 - 80, 0);
            this.callTrevor(this.callMode === '/call' && this.rezarAbicaseAccessory ? delay - 40 : delay, true);
        }
    }

    scan() {
        if (!this.enabled || Utils.area() !== 'The Farming Islands' || this.huntCompleted) return (this.animals = []);
        this.animals = World.getAllEntities().filter((e) => {
            if (!NAMES.has(e.getName()) || e.isDead()) return false;
            const maxHp = e.getMaxHP();
            return HP.has(maxHp) || (maxHp % 2 === 0 && HP.has(maxHp / 2));
        });
    }

    render() {
        const [r, g, b] = this.rarityRgb;
        const fill = new RenderColor(r, g, b, 90);
        const line = new RenderColor(r, g, b, 255);

        this.animals.forEach((e) => {
            const w = e.getWidth();
            const h = e.getHeight();
            const x = e.getX();
            const y = e.getY();
            const z = e.getZ();
            RenderUtils.drawSizedBox(new Vec3d(x, y, z), w, h, w, fill, true, 1, false);
            RenderUtils.drawTracer(new Vec3d(x, y + h / 2, z), line, 2, false);
        });
    }
}

export const PeltQOLModule = new PeltQOL();
