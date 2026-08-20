import { OverlayManager } from '../../gui/OverlayUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { getModuleElapsedMs } from '../../utils/MacroState';
import { closestDirection, createBlockPosition, isBlockInRange, sendBreakPackets } from '../../utils/NukerUtils';
import { EtherwarpPathfinder } from '../../utils/FastEtherwarp';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { executeAsync } from '../../utils/ThreadExecutor';
import { getCurrentMana } from '../../utils/Utils';

const TARGET_TYPE = new BlockType('minecraft:flowering_azalea');
const TARGET_BLACKLIST_MS = 5000;
const SCAN_INTERVAL_MS = 500;
const GALATEA_HUB_DELAY_MS = 5000;

class LushLilacEtherwarpNuker extends ModuleBase {
    constructor() {
        super({
            name: 'modules.lushlilac_etherwarp_nuker.name',
            subcategory: 'Foraging',
            description: 'modules.lushlilac_etherwarp_nuker.description',
            isMacro: true,
        });
        this.bindToggleKey();

        this.pathing = false;
        this.pathToken = 0;
        this.rewarping = false;
        this.rewarpToken = 0;
        this.waitingForGalateaWorld = false;
        this.lastGalateaWarpAt = 0;
        this.blacklistedTargets = new Map();
        this.targets = [];
        this.scanActive = false;
        this.scanToken = 0;
        this.lastScanAt = 0;
        this.status = 'Scanning';
        this.createOverlay(
            [
                {
                    title: 'overlay.status',
                    data: {
                        State: () => this.status,
                        Targets: () => this.targets.length,
                        'overlay.forest_whispers': () => OverlayManager.getTrackedValue(this.oid, 'blocksNuked', 0) * 100,
                        'overlay.forest_whispers_per_hour': () => this.getHourlyForestWhispers(),
                    },
                },
            ],
            { sessionTrackedValues: { blocksNuked: 0 } }
        );
        this.on('tick', () => this.tick());
        this.on('actionBar', (text) => {
            if (!this.enabled || this.rewarping || !ChatLib.removeFormatting(text).includes('NOT ENOUGH MANA')) return;
            this.rewarp('Not enough mana.');
        }).setCriteria('${text}');
        this.on('worldUnload', () => this.onWorldUnload());
    }

    tick() {
        if (this.rewarping || !World.isLoaded()) return;

        const mana = getCurrentMana();
        if (mana !== null && mana < 100) return this.rewarp();

        this.refreshTargets();
        if (this.pathing || EtherwarpPathfinder.isPathing()) return;

        const now = Date.now();
        const targets = this.targets.filter((target) => (this.blacklistedTargets.get(this.key(target)) || 0) <= now);
        const inRange = targets.filter((target) => isBlockInRange([target.x, target.y, target.z]));
        if (inRange.length) {
            const target = this.closest(inRange);
            const blockPos = createBlockPosition([target.x, target.y, target.z]);
            sendBreakPackets(blockPos, closestDirection(blockPos));
            OverlayManager.incrementTrackedValue(this.oid, 'blocksNuked');
            this.blacklistedTargets.set(this.key(target), now + TARGET_BLACKLIST_MS);
            this.startPath(this.closest(targets.filter((candidate) => this.key(candidate) !== this.key(target))), now);
            return;
        }

        this.startPath(this.closest(targets), now);
    }

    startPath(target, now) {
        if (!target) {
            this.status = this.scanActive ? 'Scanning' : 'No targets';
            return;
        }

        const token = ++this.pathToken;
        this.status = 'Pathing';
        const started = EtherwarpPathfinder.findPath(target, {
            goalRadius: 5,
            silent: true,
            onSuccess: () => {
                if (token !== this.pathToken) return;
                this.pathing = false;
                this.status = 'Scanning';
            },
            onFail: () => {
                if (token !== this.pathToken) return;
                this.blacklistedTargets.set(this.key(target), Date.now() + TARGET_BLACKLIST_MS);
                this.pathing = false;
                this.status = 'Path failed';
            },
        });
        this.pathing = started;
        if (!started) {
            this.blacklistedTargets.set(this.key(target), now + TARGET_BLACKLIST_MS);
            this.status = 'Path failed';
        }
    }

    refreshTargets() {
        const now = Date.now();
        if (this.scanActive || now - this.lastScanAt < SCAN_INTERVAL_MS) return;

        this.scanActive = true;
        this.lastScanAt = now;
        const token = ++this.scanToken;
        executeAsync(() => {
            try {
                const targets = World.getBlocksInBox(-535, 150, 110, -760, 80, -90, [TARGET_TYPE]).map(({ x, y, z }) => ({ x, y, z }));
                if (this.enabled && token === this.scanToken) this.targets = targets;
            } finally {
                if (token === this.scanToken) this.scanActive = false;
            }
        });
    }

    closest(targets) {
        return targets.sort((a, b) => this.distanceSq(a) - this.distanceSq(b))[0];
    }

    distanceSq(target) {
        return (target.x + 0.5 - Player.getX()) ** 2 + (target.y + 0.5 - Player.getY()) ** 2 + (target.z + 0.5 - Player.getZ()) ** 2;
    }

    key(target) {
        return `${target.x},${target.y},${target.z}`;
    }

    getHourlyForestWhispers() {
        const elapsedMs = getModuleElapsedMs(this.name);
        return elapsedMs > 0 ? Math.round((OverlayManager.getTrackedValue(this.oid, 'blocksNuked', 0) * 100 * 3600000) / elapsedMs) : 0;
    }

    rewarp() {
        this.rewarping = true;
        this.waitingForGalateaWorld = false;
        this.status = 'Rewarping';
        this.pathToken++;
        this.scanToken++;
        this.targets = [];
        this.scanActive = false;
        this.lastScanAt = 0;
        if (this.pathing && EtherwarpPathfinder.isPathing()) EtherwarpPathfinder.cancel(true);
        this.pathing = false;

        const token = ++this.rewarpToken;
        const runHubWarp = () => {
            if (!this.enabled || token !== this.rewarpToken) return;

            const remainingMs = this.lastGalateaWarpAt + GALATEA_HUB_DELAY_MS - Date.now();
            if (remainingMs > 0) return ScheduleTask(Math.ceil(remainingMs / 50), runHubWarp);

            ChatLib.command('warp hub');
            ScheduleTask(100, () => {
                if (!this.enabled || token !== this.rewarpToken) return;
                this.waitingForGalateaWorld = true;
                this.lastGalateaWarpAt = Date.now();
                ChatLib.command('warp galatea');
            });
        };
        runHubWarp();
    }

    onWorldUnload() {
        if (!this.waitingForGalateaWorld) return;
        this.waitingForGalateaWorld = false;
        this.rewarping = false;
        this.status = 'Scanning';
    }

    onDisable() {
        this.pathToken++;
        this.rewarpToken++;
        this.scanToken++;
        if (this.pathing && EtherwarpPathfinder.isPathing()) EtherwarpPathfinder.cancel(true);
        this.pathing = false;
        this.rewarping = false;
        this.waitingForGalateaWorld = false;
        this.blacklistedTargets.clear();
        this.targets = [];
        this.scanActive = false;
        this.lastScanAt = 0;
        this.status = 'Disabled';
    }
}

new LushLilacEtherwarpNuker();
