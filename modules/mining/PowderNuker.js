// vibecoded slop! but it works okay.
import { BP, Direction } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { setKeysForStraightLineCoords } from '../../utils/player/Movement';
import { Rotations } from '../../utils/player/Rotations';
import { getArea } from '../../utils/TabListUtils';
import { registerSkyblockEvent } from '../../utils/SkyblockEvents';
import { Nuker } from './Nuker';
import { refuel } from '../../utils/MiningUtils';
import {
    ClientboundBlockUpdatePacket,
    ClientboundSectionBlocksUpdatePacket,
    ServerboundPlayerActionPacket,
    ServerboundPlayerActionPacket$Action,
} from '../../utils/Packets';

const AREAS = {
    Jungle: [202, 512, 202, 512],
    'Mines of Divan': [513, 823, 202, 512],
    'Goblin Hideout': [202, 512, 513, 823],
    'Precursor Remnants': [513, 823, 513, 823],
};
const HARDSTONE = ['stone', 'cyan_terracotta', 'coal_ore', 'iron_ore', 'gold_ore', 'lapis_ore', 'redstone_ore', 'diamond_ore', 'emerald_ore'].map(
    (name) => `minecraft:${name}`
);

class PowderNuker extends ModuleBase {
    constructor() {
        super({
            name: 'Powder Nuker',
            subcategory: 'Mining',
            description: 'Nukes hardstone along bounded rows, detouring around gemstones.',
            isMacro: true,
            autoDisableOnWorldUnload: true,
        });
        this.bindToggleKey();
        this.area = 'Goblin Hideout';
        this.snailMode = false;
        this.addMultiToggle(
            'Area',
            Object.keys(AREAS),
            true,
            (value) => {
                this.area = value.find((option) => option.enabled)?.name ?? 'Goblin Hideout';
                if (this.enabled) this.toggle(false);
            },
            'Stay in this region and avoid the Crystal Nucleus.',
            this.area
        );
        this.addToggle('Snail Mode', (value) => (this.snailMode = value), 'Do not sneak while moving.');
        this.on('tick', () => this.tick());
        this.on('packetSent', (packet) => {
            if (packet.getAction() !== ServerboundPlayerActionPacket$Action.START_DESTROY_BLOCK) return;
            const pos = packet.getPos();
            const now = Date.now();
            for (const [key, time] of this.pendingBreaks) if (now - time > 10000) this.pendingBreaks.delete(key);
            for (let x = pos.getX() - 1; x <= pos.getX() + 1; x++) {
                for (let y = pos.getY() - 1; y <= pos.getY() + 1; y++) {
                    for (let z = pos.getZ() - 1; z <= pos.getZ() + 1; z++) {
                        if (HARDSTONE.includes(World.getBlockAt(x, y, z)?.type?.getRegistryName())) this.pendingBreaks.set(`${x},${y},${z}`, now);
                    }
                }
            }
        }).setFilteredClass(ServerboundPlayerActionPacket);
        this.on('packetReceived', (packet) => this.recordBreak(packet.getPos(), packet.getBlockState())).setFilteredClass(ClientboundBlockUpdatePacket);
        this.on('packetReceived', (packet) => packet.runUpdates((pos, state) => this.recordBreak(pos, state))).setFilteredClass(
            ClientboundSectionBlocksUpdatePacket
        );
        registerSkyblockEvent('emptydrill', () => {
            if (!this.enabled || this.refueling) return;
            const refueling = (this.refueling = {});
            Client.stopMovement();
            Client.setKey('shift', false);
            Rotations.stop();
            Nuker.toggle(false, true);
            this.message('&eDrill empty! Refueling...');
            refuel(
                (success) => {
                    if (!this.enabled || this.refueling !== refueling) return;
                    if (!success) return this.stop('&cRefueling failed!');
                    this.message('&aRefueling successful!');
                    this.refueling = false;
                    this.breaks.clear();
                    this.pendingBreaks.clear();
                    this.breakWindowStart = Date.now();
                    this.lastProgress = Date.now();
                    if (this.descent) this.descent.deadline = Date.now() + 10000;
                    Nuker.toggle(true, true);
                },
                { allowNpc: false }
            );
        });
    }

    inside(x, z, margin = 0) {
        const [minX, maxX, minZ, maxZ] = AREAS[this.area];
        return (
            x >= minX + margin &&
            x <= maxX - margin &&
            z >= minZ + margin &&
            z <= maxZ - margin &&
            !(x >= 472 - margin && x <= 554 + margin && z >= 472 - margin && z <= 554 + margin)
        );
    }

    onEnable() {
        if (getArea() !== 'Crystal Hollows') return this.stop('Start in the Crystal Hollows.');
        if (!this.inside(Player.getX(), Player.getZ(), 1)) return this.stop('Start inside the selected region, away from its border and the Nucleus.');
        if (!Nuker.isHoldingMiningTool()) return this.stop('Hold a drill, gauntlet, or pickaxe.');
        this.savedNuker = {
            enabled: Nuker.enabled,
            parentManaged: Nuker.isParentManaged,
            customBlockList: Nuker.customBlockList,
            nukeBelow: Nuker.nukeBelow,
            blockFilter: Nuker.blockFilter,
            targetMode: Nuker.targetMode,
        };
        Nuker.customBlockList = HARDSTONE.map((registryName) => ({ registryName, name: registryName }));
        Nuker.nukeBelow = true;
        Nuker.targetMode = 'Closest';
        this.descent = null;
        this.breaks = new Map();
        this.pendingBreaks = new Map();
        this.breakWindowStart = Date.now();
        Nuker.blockFilter = (x, y, z) =>
            this.inside(x, z) &&
            (this.descent
                ? x >= this.descent.minX &&
                  x <= this.descent.maxX &&
                  z >= this.descent.minZ &&
                  z <= this.descent.maxZ &&
                  y >= this.descent.y &&
                  y < Math.floor(Player.getY())
                : y >= Math.floor(Player.getY()));
        Nuker.init();
        Nuker.toggle(true, true);
        this.makeRoute();
        this.path = [];
        this.search = null;
        this.blocked = new Set();
        this.lastPosition = [Player.getX(), Player.getZ()];
        this.lastProgress = Date.now();
        this.failures = 0;
        this.message('&aEnabled');
    }

    makeRoute() {
        const heading = ((Math.round(Player.getYaw() / 90) % 4) + 4) % 4;
        this.axis = heading % 2 ? 'x' : 'z';
        this.crossAxis = heading % 2 ? 'z' : 'x';
        this.direction = heading === 0 || heading === 3 ? 1 : -1;
        this.row = this.crossAxis === 'x' ? Player.getX() : Player.getZ();
        const bounds = AREAS[this.area];
        const offset = this.crossAxis === 'x' ? 0 : 2;
        this.rowMin = bounds[offset] + 1.5;
        this.rowMax = bounds[offset + 1] - 1.5;
        this.rowStep = this.row < (this.rowMin + this.rowMax) / 2 ? 4 : -4;
        this.route = [{ [this.axis]: this.rowBounds(this.row)[this.direction > 0 ? 1 : 0], [this.crossAxis]: this.row, mining: true }];
        this.lastDensityCheck = Date.now();
    }

    recordBreak(pos, state) {
        if (!state.isAir() || !this.breaks) return;
        const key = Nuker.posToString(pos);
        const attempted = this.pendingBreaks.get(key);
        this.pendingBreaks.delete(key);
        if (attempted !== undefined && Date.now() - attempted <= 10000) this.breaks.set(key, Date.now());
    }

    startDescent() {
        const top = Math.floor(Player.getY());
        const y = Math.max(65, top - 3);
        if (y >= top) return false;
        const shaft = {
            minX: Math.floor(Player.getX() - 0.31),
            maxX: Math.floor(Player.getX() + 0.31),
            minZ: Math.floor(Player.getZ() - 0.31),
            maxZ: Math.floor(Player.getZ() + 0.31),
            y,
            deadline: Date.now() + 10000,
        };
        const world = World.getWorld();
        for (let x = shaft.minX; x <= shaft.maxX; x++) {
            for (let z = shaft.minZ; z <= shaft.maxZ; z++) {
                const floor = new BP(x, y - 1, z);
                if (!this.inside(x, z, 1) || !world.hasChunkAt(floor) || !world.getBlockState(floor).isFaceSturdy(world, floor, Direction.UP)) return false;
                for (let height = y; height < top; height++) {
                    const pos = new BP(x, height, z);
                    const state = world.getBlockState(pos);
                    if (!state.isAir() && !HARDSTONE.includes(World.getBlockAt(x, height, z)?.type?.getRegistryName())) return false;
                    for (const [dx, dz] of [
                        [0, 0],
                        [1, 0],
                        [-1, 0],
                        [0, 1],
                        [0, -1],
                    ]) {
                        if (
                            !world
                                .getBlockState(new BP(x + dx, height, z + dz))
                                .getFluidState()
                                .isEmpty()
                        )
                            return false;
                    }
                }
            }
        }
        Client.stopMovement();
        this.descent = shaft;
        Nuker.nukeBelow = false;
        Nuker.init();
        this.path = [];
        this.search = null;
        this.message(`Mining down ${top - y} blocks.`);
        return true;
    }

    tickDescent() {
        Client.stopMovement();
        Client.setKey('shift', false);
        Rotations.lookAtAngles(Player.getYaw(), 90);
        if ((Player.getY() <= this.descent.y + 0.1 && Player.asPlayerMP().isOnGround()) || Date.now() >= this.descent.deadline) {
            this.descent = null;
            Nuker.nukeBelow = true;
            Nuker.init();
            this.blocked.clear();
            this.breaks.clear();
            this.breakWindowStart = Date.now();
            this.lastProgress = Date.now();
            Rotations.stop();
        }
    }

    rowBounds(row) {
        const bounds = AREAS[this.area];
        const offset = this.axis === 'x' ? 0 : 2;
        let min = bounds[offset] + 1.5,
            max = bounds[offset + 1] - 1.5;
        if (row >= 470 && row <= 556) {
            if (bounds[offset + 1] <= 512) max = 469.5;
            else min = 556.5;
        }
        return [min, max];
    }

    advance() {
        this.route.shift();
        if (!this.route.length) {
            if (this.row + this.rowStep < this.rowMin || this.row + this.rowStep > this.rowMax) this.rowStep *= -1;
            const nextRow = Math.max(this.rowMin, Math.min(this.rowMax, this.row + this.rowStep));
            const [min, max] = this.rowBounds(nextRow);
            const along = this.axis === 'x' ? Player.getX() : Player.getZ();
            const turn = Math.max(min, Math.min(max, along));
            this.direction *= -1;
            this.route = [
                { [this.axis]: turn, [this.crossAxis]: this.row },
                { [this.axis]: turn, [this.crossAxis]: nextRow },
                { [this.axis]: this.direction > 0 ? max : min, [this.crossAxis]: nextRow, mining: true },
            ];
            this.row = nextRow;
        }
        this.path = [];
        this.search = null;
        this.blocked.clear();
        this.lastDensityCheck = Date.now();
    }

    hasHardstoneAhead(position, target) {
        const distance = (target[this.axis] - position[this.axis]) * this.direction;
        const start = Math.ceil(Nuker.customReach) + 1;
        if (distance < start + 5) return true;
        const y = Math.floor(Player.getY());
        let count = 0;
        for (let depth = start; depth < start + 6; depth++) {
            for (let side = -2; side <= 2; side++) {
                const point = { [this.axis]: position[this.axis] + depth * this.direction, [this.crossAxis]: this.row + side };
                const x = Math.floor(point.x),
                    z = Math.floor(point.z);
                if (!World.getWorld().hasChunkAt(new BP(x, y, z))) return true;
                if (!this.inside(x, z)) continue;
                for (let height = 0; height < 3; height++) {
                    if (HARDSTONE.includes(World.getBlockAt(x, y + height, z)?.type?.getRegistryName()) && ++count >= 12) return true;
                }
            }
        }
        return false;
    }

    clearAt(x, z, mineable = true) {
        if (!this.inside(x, z, 1)) return false;
        const world = World.getWorld();
        const feet = Player.getY();
        const radius = Player.getPlayer().getBbWidth() / 2 - 0.001;
        const head = feet + Player.getPlayer().getBbHeight();
        let supported = false;
        for (let bx = Math.floor(x - radius); bx <= Math.floor(x + radius); bx++) {
            for (let bz = Math.floor(z - radius); bz <= Math.floor(z + radius); bz++) {
                if (!world.hasChunkAt(new BP(bx, Math.floor(feet), bz))) return false;
                if (this.blocked.has(`${bx},${bz}`)) return false;
                for (let by = Math.floor(feet - 0.05); by <= Math.floor(head - 0.001); by++) {
                    const pos = new BP(bx, by, bz);
                    const state = world.getBlockState(pos);
                    const name = World.getBlockAt(bx, by, bz)?.type?.getRegistryName();
                    if (!state.getFluidState().isEmpty()) return false;
                    for (const box of state.getCollisionShape(world, pos).toAabbs()) {
                        if (bx + box.maxX <= x - radius || bx + box.minX >= x + radius || bz + box.maxZ <= z - radius || bz + box.minZ >= z + radius) continue;
                        const top = by + box.maxY;
                        if (top <= feet + 0.001 && top >= feet - 0.05) supported = true;
                        if (top > feet + 0.001 && by + box.minY < head - 0.001 && !(mineable && HARDSTONE.includes(name))) return false;
                    }
                }
            }
        }
        return supported;
    }

    segmentClear(from, to, mineable = true) {
        const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) * 4);
        for (let i = 0; i <= steps; i++) {
            const t = steps ? i / steps : 0;
            if (!this.clearAt(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, mineable)) return false;
        }
        return true;
    }

    plan(position, target) {
        if (!this.search) {
            const distance = Math.hypot(target.x - position.x, target.z - position.z);
            const scale = Math.min(1, 12 / distance);
            const goal = {
                x: position.x + (target.x - position.x) * scale,
                z: position.z + (target.z - position.z) * scale,
            };
            if (this.segmentClear(position, goal)) {
                this.path = [goal];
                return;
            }
            goal.x = Math.floor(goal.x) + 0.5;
            goal.z = Math.floor(goal.z) + 0.5;
            const start = { ...position, parent: null };
            const queue = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const node = { x: Math.floor(position.x) + dx + 0.5, z: Math.floor(position.z) + dz + 0.5, parent: null };
                    if (this.segmentClear(position, node)) queue.push(node);
                }
            }
            if (!queue.length) {
                if (!this.startDescent()) this.stop('No safe footing or safe descent.');
                return;
            }
            this.search = { queue, seen: new Set(queue.map((node) => `${node.x},${node.z}`)), index: 0, start, goal, best: start };
        }
        const search = this.search;
        for (let work = 0; work < 128 && search.index < search.queue.length; work++) {
            const node = search.queue[search.index++];
            if (Math.hypot(node.x - target.x, node.z - target.z) < Math.hypot(search.best.x - target.x, search.best.z - target.z)) search.best = node;
            if (node.x === search.goal.x && node.z === search.goal.z) {
                search.best = node;
                search.index = search.queue.length;
                break;
            }
            for (const [dx, dz] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ]) {
                const x = node.x + dx,
                    z = node.z + dz,
                    key = `${x},${z}`;
                if (search.seen.has(key) || Math.abs(x - search.start.x) > 32 || Math.abs(z - search.start.z) > 32) continue;
                if (this.segmentClear(node, { x, z })) {
                    search.seen.add(key);
                    search.queue.push({ x, z, parent: node });
                }
            }
        }
        if (search.index < search.queue.length) return;
        this.search = null;
        if (search.best === search.start) {
            if (++this.failures >= 3) return this.stop('No safe route around the obstruction.');
            this.advance();
            return;
        }
        for (let node = search.best; node; node = node.parent) this.path.unshift(node);
    }

    tick() {
        if (this.refueling) {
            Client.stopMovement();
            return;
        }
        if (!this.inside(Player.getX(), Player.getZ(), 0.35)) return this.stop('Reached the area safety boundary.');
        if (Client.isInGui() || Nuker.solvingChest) {
            Client.stopMovement();
            if (!Nuker.solvingChest) Rotations.stop();
            this.lastProgress = Date.now();
            this.search = null;
            this.breaks.clear();
            this.breakWindowStart = Date.now();
            if (this.descent) this.descent.deadline = Date.now() + 10000;
            return;
        }
        if (this.descent) return this.tickDescent();
        if (!Player.asPlayerMP().isOnGround()) {
            Client.stopMovement();
            this.lastProgress = Date.now();
            return;
        }
        const now = Date.now();
        for (const [key, time] of this.breaks) if (now - time >= 10000) this.breaks.delete(key);
        if (now - this.breakWindowStart >= 10000 && this.breaks.size < 10) {
            this.breakWindowStart = now;
            if (this.startDescent()) return;
        }
        const position = { x: Player.getX(), z: Player.getZ() };
        if (Math.hypot(position.x - this.lastPosition[0], position.z - this.lastPosition[1]) > 0.5) {
            this.lastPosition = [position.x, position.z];
            this.lastProgress = Date.now();
            this.failures = 0;
        }
        let target = this.route[0];
        if (Math.hypot(target.x - position.x, target.z - position.z) < 0.6) {
            this.advance();
            target = this.route[0];
        }
        if (target.mining && !this.search && this.path.length <= 1 && Date.now() - this.lastDensityCheck >= 1000) {
            this.lastDensityCheck = Date.now();
            if (!this.hasHardstoneAhead(position, target)) {
                this.advance();
                Client.stopMovement();
                return;
            }
        }
        while (this.path.length && Math.hypot(this.path[0].x - position.x, this.path[0].z - position.z) < 0.25) this.path.shift();
        if (!this.path.length) {
            Client.stopMovement();
            this.plan(position, target);
            this.lastProgress = Date.now();
            return;
        }
        const next = this.path[0];
        if (!this.segmentClear(position, next) || Date.now() - this.lastProgress > 5000) {
            if (Date.now() - this.lastProgress > 5000) {
                const distance = Math.hypot(next.x - position.x, next.z - position.z);
                this.blocked.add(`${Math.floor(position.x + (next.x - position.x) / distance)},${Math.floor(position.z + (next.z - position.z) / distance)}`);
            }
            this.path = [];
            this.search = null;
            Client.stopMovement();
            return;
        }
        const yaw = (-Math.atan2(next.x - position.x, next.z - position.z) * 180) / Math.PI;
        Rotations.lookAtAngles(yaw, 10);
        if (Math.abs(((((yaw - Player.getYaw()) % 360) + 540) % 360) - 180) > 5) {
            Client.stopMovement();
            return;
        }
        Client.setKey('sprint', false);
        Client.setKey('shift', !this.snailMode);
        const distance = Math.hypot(next.x - position.x, next.z - position.z);
        const step = Math.min(distance, 0.45);
        const ahead = {
            x: position.x + Player.getMotionX() * 3 + ((next.x - position.x) / distance) * step,
            z: position.z + Player.getMotionZ() * 3 + ((next.z - position.z) / distance) * step,
        };
        if (!this.segmentClear(position, ahead, false)) {
            Client.stopMovement();
            return;
        }
        setKeysForStraightLineCoords(next.x, Player.getY(), next.z, false);
    }

    stop(reason) {
        this.message(reason);
        this.toggle(false);
    }

    onDisable() {
        Client.stopMovement();
        Client.setKey('shift', false);
        Rotations.stop();
        this.descent = null;
        this.refueling = false;
        if (this.savedNuker) {
            const { enabled, parentManaged, ...settings } = this.savedNuker;
            Nuker.finishChest();
            if (!enabled) Nuker.toggle(false);
            Object.assign(Nuker, settings);
            Nuker.isParentManaged = parentManaged;
            Nuker.init();
            this.savedNuker = null;
        }
        this.message('&cDisabled');
    }
}

new PowderNuker();
