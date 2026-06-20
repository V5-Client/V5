import { OverlayManager } from '../../gui/OverlayUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Guis } from '../../utils/player/Inventory';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { Utils } from '../../utils/Utils';
import { v5Command } from '../../utils/V5Commands';
import { File, Vec3d } from '../../utils/Constants';

const CONFIG_DIR = 'V5Config';
const CONFIG_PATH = 'WynnProfession/route.json';

const BLACKSMITH_LOCATIONS = [
    { x: -2005, y: 75, z: -4462 },
    { x: -2003, y: 75, z: -4484 },
    { x: -1971, y: 75, z: -4483 },
    { x: -1875, y: 51, z: -4568 },
    { x: -1763, y: 64, z: -5520 },
    { x: -1604, y: 67, z: -2915 },
    { x: -1602, y: 35, z: -2369 },
    { x: -1479, y: 40, z: -4747 },
    { x: -1431, y: 40, z: -4734 },
    { x: -1146, y: 63, z: -2405 },
    { x: -982, y: 45, z: -5282 },
    { x: -868, y: 120, z: -4921 },
    { x: -858, y: 65, z: -1549 },
    { x: -850, y: 74, z: -917 },
    { x: -833, y: 65, z: -1586 },
    { x: -825, y: 65, z: -1495 },
    { x: -727, y: 88, z: -636 },
    { x: -727, y: 98, z: -6444 },
    { x: -719, y: 63, z: -1020 },
    { x: -683, y: 33, z: -3163 },
    { x: -657, y: 35, z: -3074 },
    { x: -657, y: 36, z: -3060 },
    { x: -628, y: 36, z: -3046 },
    { x: -620, y: 87, z: -1416 },
    { x: -618, y: 51, z: -3056 },
    { x: -574, y: 46, z: -1924 },
    { x: -565, y: 65, z: -1597 },
    { x: -464, y: 47, z: -4926 },
    { x: -464, y: 47, z: -4918 },
    { x: -459, y: 47, z: -4929 },
    { x: -297, y: 101, z: -4468 },
    { x: -289, y: 41, z: -1157 },
    { x: -219, y: 21, z: -363 },
    { x: -215, y: 22, z: -345 },
    { x: -199, y: 22, z: -352 },
    { x: -3, y: 73, z: -1184 },
    { x: 91, y: 38, z: -2184 },
    { x: 96, y: 36, z: -2244 },
    { x: 112, y: 36, z: -2246 },
    { x: 113, y: 71, z: -785 },
    { x: 116, y: 36, z: -2237 },
    { x: 117, y: 64, z: -3158 },
    { x: 206, y: 27, z: -5259 },
    { x: 348, y: 30, z: -5481 },
    { x: 487, y: 65, z: -1597 },
    { x: 755, y: 162, z: -4433 },
    { x: 806, y: 73, z: -5077 },
    { x: 941, y: 65, z: -1957 },
    { x: 945, y: 112, z: -5486 },
    { x: 988, y: 74, z: -744 },
    { x: 989, y: 71, z: -664 },
    { x: 1002, y: 110, z: -4538 },
    { x: 1010, y: 36, z: -3487 },
    { x: 1055, y: 16, z: -5146 },
    { x: 1096, y: 105, z: -4555 },
    { x: 1096, y: 105, z: -4543 },
    { x: 1123, y: 39, z: -3121 },
    { x: 1260, y: 29, z: -1341 },
    { x: 1267, y: 29, z: -1358 },
    { x: 1274, y: 29, z: -1349 },
    { x: 1496, y: 42, z: -5300 },
];

const STATES = {
    IDLE: 0,
    PATHING: 1,
    ROTATING: 2,
    WAITING_BREAK_SOUND: 3,
    REPAIR_PATHING: 4,
    REPAIR_ROTATING: 5,
    REPAIR_OPENING: 6,
    REPAIR_SELECTING_ITEM: 7,
};

class WynnProfessionMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Wynn Profession',
            subcategory: 'Skills',
            description: 'Loops a Wynncraft profession route and clicks each route node.',
            tooltip: '/v5 wynn add [left|right]',
            theme: '#3fbf7f',
            isMacro: true,
            autoDisableOnWorldUnload: true,
        });

        this.route = this.loadRoute();
        this.currentIndex = 0;
        this.state = STATES.IDLE;
        this.waitStartedAt = 0;
        this.lastRepairActionAt = 0;

        this.bindToggleKey();

        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        Route: () => this.getRouteProgressDisplay(),
                        State: () => this.getStateName(),
                    },
                },
                {
                    title: 'Performance',
                    data: {
                        Total: () => this.formatNumber(this.getTotal()),
                        '/hr': () => this.getPerHour(),
                    },
                },
            ],
            {
                sessionTrackedValues: {
                    total: 0,
                },
            }
        );

        this.on('tick', () => this.onTick());
        this.on('soundPlay', (_pos, name) => this.onSoundPlay(name));
        this.on('chat', (event) => this.onChat(event));

        this.when(
            () => this.enabled && this.route.length > 0,
            'postRenderWorld',
            () => this.renderRoute()
        );

        v5Command('wynn', (...args) => this.handleCommand(args));
    }

    onEnable() {
        this.route = this.loadRoute();
        if (!this.route.length) {
            this.message('&cRoute is empty. Add points with &f/v5 wynn add [left|right]');
            this.toggle(false);
            return;
        }

        this.currentIndex = this.getClosestPointIndex();
        this.state = STATES.IDLE;
        this.startCurrentPoint();
    }

    onDisable() {
        this.state = STATES.IDLE;
        this.waitStartedAt = 0;
        this.lastRepairActionAt = 0;
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Keybind.unpressKeys();
        Rotations.stop();
    }

    onTick() {
        if (this.isRepairState()) {
            this.handleRepairTick();
            return;
        }

        if (this.state === STATES.WAITING_BREAK_SOUND) {
            if (Date.now() - this.waitStartedAt >= 10_000) {
                this.message('&eNo profession pickup sound heard after 10s, moving on.');
                this.advancePoint();
            }
        }
    }

    // prob should do a better check like expected distance aswell but who cares, not an issue rn.
    onSoundPlay(name) {
        if (!name || this.state !== STATES.WAITING_BREAK_SOUND) return;
        if (name !== 'minecraft:entity.experience_orb.pickup') return;

        OverlayManager.incrementTrackedValue(this.oid, 'total');
        this.advancePoint();
    }

    onChat(event) {
        const message = event?.message?.getUnformattedText?.();
        if (!message?.includes('Your tool has 0 durability left')) return;

        this.startRepairDetour();
    }

    handleCommand(args) {
        const action = `${args[0] || ''}`.toLowerCase();
        if (!action) return this.showUsage();

        if (action === 'add') return this.addPoint(args.slice(1));
        if (action === 'remove') return this.removePoint(args[1]);
        if (action === 'list') return this.listRoute();
        if (action === 'clear') return this.clearRoute();
        if (action === 'start') return this.startFromCommand();
        if (action === 'toggle') return this.requestToggleFromUser();
        if (action === 'stop') return this.toggle(false);

        this.showUsage();
    }

    startFromCommand() {
        if (this.enabled) return this.message('&eWynn profession macro is already running.');
        this.requestToggleFromUser();
    }

    showUsage() {
        this.message('&7/v5 wynn add [left|right] [index]');
        this.message('&7/v5 wynn remove [index] &8| &7/v5 wynn list &8| &7/v5 wynn clear');
        this.message('&7/v5 wynn start &8| &7/v5 wynn stop');
    }

    addPoint(args) {
        let click = 'LEFT';
        let index = null;

        for (const arg of args) {
            const text = `${arg}`.toLowerCase();
            if (text === 'left' || text === 'l') {
                click = 'LEFT';
                continue;
            }
            if (text === 'right' || text === 'r') {
                click = 'RIGHT';
                continue;
            }

            const parsed = Number.parseInt(text);
            if (!Number.isNaN(parsed) && parsed >= 1) index = parsed;
        }

        const point = {
            x: Player.getX(),
            y: Player.getY(),
            z: Player.getZ(),
            click,
        };

        if (index !== null && index <= this.route.length) {
            this.route.splice(index - 1, 0, point);
            this.message(`&aAdded ${click.toLowerCase()} point at #${index}.`);
        } else {
            this.route.push(point);
            this.message(`&aAdded ${click.toLowerCase()} point at #${this.route.length}.`);
        }

        this.saveRoute();
    }

    removePoint(indexArg) {
        if (!this.route.length) return this.message('&cRoute is already empty.');

        const index = Number.parseInt(indexArg);
        const removeIndex = !Number.isNaN(index) && index >= 1 && index <= this.route.length ? index - 1 : this.route.length - 1;
        this.route.splice(removeIndex, 1);
        this.currentIndex = Math.min(this.currentIndex, Math.max(0, this.route.length - 1));
        this.saveRoute();
        this.message(`&aRemoved point #${removeIndex + 1}.`);
    }

    listRoute() {
        if (!this.route.length) return this.message('&eRoute is empty.');

        this.message(`&aWynn route has ${this.route.length} point(s):`);
        this.route.forEach((point, index) => {
            this.message(`&7#${index + 1}: &f${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)} &8| &f${point.click.toLowerCase()}`);
        });
    }

    clearRoute() {
        this.route = [];
        this.currentIndex = 0;
        this.saveRoute();
        if (this.enabled) this.toggle(false);
        this.message('&aCleared Wynn profession route.');
    }

    startCurrentPoint() {
        if (!this.route.length) return;

        const point = this.route[this.currentIndex];
        if (!this.isValidPoint(point)) {
            this.message(`&cInvalid point #${this.currentIndex + 1}, skipping.`);
            this.advancePoint();
            return;
        }

        this.state = STATES.PATHING;

        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Pathfinder.findPath(this.buildPathGoals(point), (success) => {
            if (!success) {
                this.message(`&cPathfinding failed at point #${this.currentIndex + 1}.`);
                this.toggle(false);
                return;
            }

            this.rotateAndClick(point);
        });
    }

    rotateAndClick(point) {
        if (!this.enabled) return;

        this.state = STATES.ROTATING;
        Keybind.unpressKeys();

        Rotations.lookAtVector(new Vec3d(point.x, point.y + 1.62, point.z), { speedMultiplier: 1.0 });
        Rotations.onComplete(() => {
            if (!this.enabled) return;

            if (point.click === 'RIGHT') Keybind.rightClick();
            else Keybind.leftClick();

            this.state = STATES.WAITING_BREAK_SOUND;
            this.waitStartedAt = Date.now();
        });
    }

    advancePoint() {
        if (!this.enabled || !this.route.length) return;

        this.currentIndex++;
        if (this.currentIndex >= this.route.length) this.currentIndex = 0;

        this.state = STATES.IDLE;
        this.waitStartedAt = 0;
        this.startCurrentPoint();
    }

    startRepairDetour() {
        if (!this.enabled || !this.route.length || this.isRepairState()) return;

        this.waitStartedAt = 0;
        this.lastRepairActionAt = 0;
        this.state = STATES.REPAIR_PATHING;

        this.message('&eTool durability is empty, pathing to the nearest blacksmith.');

        if (Pathfinder.isPathing()) Pathfinder.resetPath();
        Keybind.unpressKeys();
        Rotations.stop();

        Pathfinder.findPath(this.buildBlacksmithPathGoals(), (success) => {
            if (!success) {
                this.message('&cPathfinding to a blacksmith failed.');
                this.toggle(false);
                return;
            }

            this.rotateAndOpenBlacksmith();
        });
    }

    rotateAndOpenBlacksmith() {
        if (!this.enabled) return;

        this.state = STATES.REPAIR_ROTATING;
        Keybind.unpressKeys();

        const target = this.getClosestBlacksmith();
        const aimPoint = new Vec3d(target.x + 0.5, target.y + 2.62, target.z + 0.5);
        Rotations.lookAtVector(aimPoint, { speedMultiplier: 1.0 });

        Rotations.onComplete(() => {
            if (!this.enabled) return;

            Keybind.rightClick();
            this.state = STATES.REPAIR_OPENING;
            this.lastRepairActionAt = Date.now();
        });
    }

    handleRepairTick() {
        if (this.state === STATES.REPAIR_PATHING || this.state === STATES.REPAIR_ROTATING) return;

        const now = Date.now();
        if (now - this.lastRepairActionAt < 250) return;

        const container = Player.getContainer();
        if (!container) return;

        if (this.state === STATES.REPAIR_OPENING) {
            const slot = this.findSlotByName(container, 'Repair Items');
            if (slot < 0) return;

            if (Guis.clickSlot(slot, false, 'LEFT')) {
                this.state = STATES.REPAIR_SELECTING_ITEM;
                this.lastRepairActionAt = now;
            }
            return;
        }

        if (this.state === STATES.REPAIR_SELECTING_ITEM) {
            const slot = this.findFirstRepairableSlot(container);
            if (slot < 0) return;

            if (Guis.clickSlot(slot, false, 'LEFT')) {
                this.lastRepairActionAt = now;
                ScheduleTask(3, () => this.finishRepairDetour());
            }
        }
    }

    finishRepairDetour() {
        if (!this.enabled) return;

        Guis.closeInv();
        this.currentIndex = this.getClosestPointIndex();
        this.lastRepairActionAt = 0;
        this.state = STATES.IDLE;
        this.startCurrentPoint();
    }

    buildPathGoals(point) {
        return [
            [Math.floor(point.x), Math.floor(point.y) - 1, Math.floor(point.z)],
            [Math.floor(point.x), Math.floor(point.y), Math.floor(point.z)],
            [Math.floor(point.x), Math.floor(point.y) + 1, Math.floor(point.z)],
        ];
    }

    buildBlacksmithPathGoals() {
        return BLACKSMITH_LOCATIONS.map((point) => this.buildPathGoals(point));
    }

    getClosestBlacksmith() {
        let closest = BLACKSMITH_LOCATIONS[0];
        let closestDistance = Infinity;

        for (const point of BLACKSMITH_LOCATIONS) {
            const distance = Math.hypot(Player.getX() - point.x, Player.getY() - point.y, Player.getZ() - point.z);
            if (distance < closestDistance) {
                closest = point;
                closestDistance = distance;
            }
        }

        return closest;
    }

    getClosestPointIndex() {
        let closestIndex = 0;
        let closestDistance = Infinity;

        for (let i = 0; i < this.route.length; i++) {
            const point = this.route[i];
            if (!this.isValidPoint(point)) continue;

            const distance = Math.hypot(Player.getX() - point.x, Player.getY() - point.y, Player.getZ() - point.z);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    renderRoute() {
        for (let i = 0; i < this.route.length; i++) {
            const point = this.route[i];
            if (!this.isValidPoint(point)) continue;

            const color = i === this.currentIndex ? new RenderColor(85, 255, 85, 120) : new RenderColor(63, 191, 127, 80);
            RenderUtils.drawStyledBox(
                new Vec3d(Math.floor(point.x), Math.floor(point.y) - 1, Math.floor(point.z)),
                color,
                new RenderColor(63, 191, 127, 255),
                3,
                false
            );

            const next = this.route[(i + 1) % this.route.length];
            if (!this.isValidPoint(next)) continue;
            RenderUtils.drawLine(new Vec3d(point.x, point.y, point.z), new Vec3d(next.x, next.y, next.z), new RenderColor(63, 191, 127, 180), 2, false);
        }
    }

    getRouteProgressDisplay() {
        if (!this.route.length) return '0/0';
        return `${this.currentIndex + 1}/${this.route.length}`;
    }

    getStateName() {
        switch (this.state) {
            case STATES.PATHING:
                return 'Pathing';
            case STATES.ROTATING:
                return 'Rotating';
            case STATES.WAITING_BREAK_SOUND:
                return 'Waiting sound';
            case STATES.REPAIR_PATHING:
                return 'Pathing to blacksmith';
            case STATES.REPAIR_ROTATING:
                return 'Rotating to blacksmith';
            case STATES.REPAIR_OPENING:
                return 'Opening blacksmith';
            case STATES.REPAIR_SELECTING_ITEM:
                return 'Selecting item to repair';
            case STATES.IDLE:
            default:
                return 'Idle';
        }
    }

    getTotal() {
        return OverlayManager.getTrackedValue(this.oid, 'total', 0);
    }

    getPerHour() {
        const elapsedMs = OverlayManager.getSessionElapsedMs(this.oid);
        if (elapsedMs <= 0) return '0';

        return this.formatNumber(this.getTotal() / (elapsedMs / 3600000));
    }

    formatNumber(value) {
        if (!Number.isFinite(value)) return '0';

        const rounded = Math.round(value);
        return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    loadRoute() {
        const routeFile = new File(`./config/ChatTriggers/modules/V5Config/WynnProfession/route.json`);
        if (!routeFile.exists()) return [];

        let data = [];
        try {
            const raw = FileLib.read(CONFIG_DIR, CONFIG_PATH);
            data = raw && raw.trim() ? JSON.parse(raw) : [];
        } catch (e) {
            this.message('&cFailed to read Wynn route. Resetting to an empty route.');
            console.error('V5 Caught error' + e + e.stack);
            return [];
        }

        const rawRoute = Array.isArray(data) ? data : Array.isArray(data?.points) ? data.points : [];

        return rawRoute.map((point) => this.normalizePoint(point)).filter((point) => point !== null);
    }

    saveRoute() {
        Utils.writeConfigFile('WynnProfession/route.json', this.route);
    }

    normalizePoint(point) {
        if (!point) return null;

        const x = Number(point.x);
        const y = Number(point.y);
        const z = Number(point.z);
        const click = point.click;

        if (![x, y, z].every((value) => Number.isFinite(value))) return null;

        return {
            x,
            y,
            z,
            click,
        };
    }

    isValidPoint(point) {
        return point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z);
    }

    isRepairState() {
        return (
            this.state === STATES.REPAIR_PATHING ||
            this.state === STATES.REPAIR_ROTATING ||
            this.state === STATES.REPAIR_OPENING ||
            this.state === STATES.REPAIR_SELECTING_ITEM
        );
    }

    findSlotByName(container, targetName) {
        const items = container?.getItems?.();
        if (!items) return -1;

        for (let slot = 0; slot < items.length; slot++) {
            const name = this.getCleanItemName(items[slot]);
            if (name === targetName) return slot;
        }

        return -1;
    }

    findFirstRepairableSlot(container) {
        const items = container?.getItems?.();
        if (!items) return -1;

        for (let slot = 0; slot < items.length; slot++) {
            const lore = this.getCleanLore(items[slot]);
            if (lore.some((line) => line.includes('Click to repair'))) return slot;
        }

        return -1;
    }

    getCleanItemName(item) {
        const rawName = item?.getName?.() ?? item?.name ?? '';
        return ChatLib.removeFormatting(`${rawName}`).trim();
    }

    getCleanLore(item) {
        return item?.getLore?.()?.map((line) => ChatLib.removeFormatting(`${line}`).trim()) ?? [];
    }
}

new WynnProfessionMacro();
