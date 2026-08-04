import { OverlayManager } from '../../gui/OverlayUtils';
import { ModuleBase } from '../../utils/ModuleBase';
import { MacroState } from '../../utils/MacroState';
import { EtherwarpPathfinder } from '../../utils/pathfinder/EtherwarpPathfinder';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';

const FALLBACK_TARGET = { x: -648, y: 124, z: 5 };
const TARGET_TIMEOUT_MS = 2000;
const ENTITY_LOAD_WAIT_TICKS = 60;
const FALLBACK_WAIT_MS = 1000;
const GALATEA_HUB_DELAY_MS = 5000;

class MudwormMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Mudworm Etherwarp Nuker',
            subcategory: 'Foraging',
            description: 'Etherwarps to Mudworm and clicks thems.',
            isMacro: true,
        });
        this.bindToggleKey();

        this.autoRewarp = 'Warp Galatea';
        this.addMultiToggle(
            'Auto Rewarp',
            ['Disabled', 'Warp Galatea', 'Warp Torrhus'],
            true,
            (options) => (this.autoRewarp = options.find((option) => option.enabled)?.name || 'Disabled'),
            null,
            this.autoRewarp
        );

        this.processedTargets = new Set();
        this.busy = false;
        this.rewarping = false;
        this.waitingForEntities = false;
        this.waitingForGalateaWorld = false;
        this.lastGalateaWarpAt = 0;
        this.actionToken = 0;
        this.rewarpToken = 0;
        this.currentTarget = null;
        this.targetStartedAt = 0;
        this.fallbackChecked = false;
        this.fallbackWaitUntil = 0;
        this.checkingFallback = false;

        this.createOverlay(
            [
                {
                    title: 'Status',
                    data: {
                        Status: () =>
                            this.rewarping
                                ? 'Rewarping'
                                : this.waitingForEntities
                                  ? 'Waiting for entities'
                                  : this.checkingFallback
                                    ? 'Checking fallback'
                                    : this.busy
                                      ? 'Working'
                                      : 'Scanning',
                        Grass: () => OverlayManager.getTrackedValue(this.oid, 'clicks', 0),
                        'Grass/hr': () => this.getHourlyRate('clicks'),
                        Shards: () => OverlayManager.getTrackedValue(this.oid, 'shards', 0),
                        'Shards/hr': () => this.getHourlyRate('shards'),
                    },
                },
            ],
            { sessionTrackedValues: { clicks: 0, shards: 0 } }
        );

        this.on('tick', () => this.onTick());
        this.on('actionBar', (text) => {
            if (!this.enabled || this.rewarping || !ChatLib.removeFormatting(text).includes('NOT ENOUGH MANA')) return;
            this.rewarp('Not enough mana.');
        }).setCriteria('${text}');
        this.on('chat', (event) => this.trackShards(event));
        this.on('worldUnload', () => this.onWorldUnload());
        this.on('worldLoad', () => this.onWorldLoad());
    }

    onTick() {
        if (this.rewarping || !World.isLoaded()) return;
        if (this.waitingForEntities) {
            if (!this.getTargets().size) return;
            this.waitingForEntities = false;
            this.message('&aResumed.');
        }
        if (this.currentTarget && Date.now() - this.targetStartedAt >= TARGET_TIMEOUT_MS) return this.blacklistCurrentTarget();
        if (this.busy || EtherwarpPathfinder.isPathing()) return;

        const targets = this.getTargets();
        this.processedTargets.forEach((key) => {
            if (!targets.has(key)) this.processedTargets.delete(key);
        });

        const target = [...targets.values()]
            .filter((target) => !this.processedTargets.has(target.key))
            .sort((a, b) => this.distanceSq(a) - this.distanceSq(b))[0];
        if (!target) {
            if (!this.fallbackChecked) return this.checkFallback();
            if (Date.now() < this.fallbackWaitUntil) return;
            return this.rewarp('No valid Mudworm targets.');
        }

        this.busy = true;
        this.currentTarget = target;
        this.targetStartedAt = Date.now();
        this.fallbackChecked = false;
        this.fallbackWaitUntil = 0;
        const token = ++this.actionToken;
        const started = EtherwarpPathfinder.findPath(target, {
            silent: true,
            onSuccess: () => this.clickTarget(target, token),
            onFail: () => this.finishTarget(target, token),
        });
        if (!started) this.finishTarget(target, token);
    }

    getTargets() {
        const targets = new Map();
        World.getAllEntities().forEach((entity) => {
            if (String(entity?.toMC?.().getType?.()) !== 'entity.minecraft.item_display') return;
            if (entity.getY() < 80) return;

            const x = Math.floor(entity.getX());
            const y = Math.floor(entity.getY());
            const z = Math.floor(entity.getZ());
            const key = `${x},${y},${z}`;
            targets.set(key, { x, y, z, key });
        });
        return targets;
    }

    clickTarget(target, token) {
        if (!this.isCurrentAction(token)) return;

        if (!Rotations.lookAtAngles(Player.getYaw(), 90, { speedMultiplier: 999 })) return this.finishTarget(target, token);
        Rotations.onComplete(() => {
            if (!this.isCurrentAction(token)) return;
            Client.leftClick();
            OverlayManager.incrementTrackedValue(this.oid, 'clicks');
            this.finishTarget(target, token);
        }, 'mudworm_macro_click');
    }

    finishTarget(target, token) {
        if (token !== this.actionToken) return;
        this.processedTargets.add(target.key);
        this.currentTarget = null;
        this.targetStartedAt = 0;
        this.busy = false;
    }

    blacklistCurrentTarget() {
        const target = this.currentTarget;
        this.stopCurrentAction();
        if (target) this.processedTargets.add(target.key);
    }

    checkFallback() {
        this.busy = true;
        this.checkingFallback = true;
        const token = ++this.actionToken;
        const started = EtherwarpPathfinder.findPath(FALLBACK_TARGET, {
            silent: true,
            onSuccess: () => this.finishFallback(token),
            onFail: () => this.failFallback(token),
        });
        if (!started) this.failFallback(token);
    }

    finishFallback(token) {
        if (!this.isCurrentAction(token)) return;
        this.busy = false;
        this.checkingFallback = false;
        this.fallbackChecked = true;
        this.fallbackWaitUntil = Date.now() + FALLBACK_WAIT_MS;
    }

    failFallback(token) {
        if (!this.isCurrentAction(token)) return;
        if (this.autoRewarp === 'Disabled') return this.finishFallback(token);
        this.rewarp('Fallback etherwarp failed.');
    }

    isCurrentAction(token) {
        return this.enabled && !this.rewarping && token === this.actionToken;
    }

    trackShards(event) {
        if (!this.enabled) return;

        const rawMessage = event?.message?.getUnformattedText?.() ?? event?.message?.getString?.() ?? event?.message ?? event ?? '';
        const message = ChatLib.removeFormatting(String(rawMessage));
        if (!message.includes('Mudworm Shard')) return;

        OverlayManager.incrementTrackedValue(this.oid, 'shards', Number(message.match(/\bx(\d+)\b/i)?.[1]) || 1);
    }

    getHourlyRate(key) {
        const elapsedMs = MacroState.getModuleElapsedMs(this.name);
        if (elapsedMs <= 0) return 0;
        return Math.round((OverlayManager.getTrackedValue(this.oid, key, 0) * 3600000) / elapsedMs);
    }

    onWorldUnload() {
        this.stopCurrentAction();
        if (!this.waitingForGalateaWorld) return;

        this.waitingForGalateaWorld = false;
        this.rewarping = false;
        this.waitingForEntities = true;
    }

    onWorldLoad() {
        if (!this.waitingForEntities) return;

        const token = this.rewarpToken;
        ScheduleTask(ENTITY_LOAD_WAIT_TICKS, () => {
            if (!this.enabled || token !== this.rewarpToken || !this.waitingForEntities) return;
            this.waitingForEntities = false;
            this.message('&aResumed.');
        });
    }

    rewarp(reason = 'Not enough mana.') {
        if (this.autoRewarp === 'Disabled') return;

        this.rewarping = true;
        this.waitingForEntities = false;
        this.waitingForGalateaWorld = false;
        this.processedTargets.clear();
        this.fallbackChecked = false;
        this.fallbackWaitUntil = 0;
        this.checkingFallback = false;
        this.stopCurrentAction();
        const token = ++this.rewarpToken;
        const destination = this.autoRewarp === 'Warp Torrhus' ? 'torrhus' : 'galatea';

        this.message(`&e${reason} Rewarping...`);
        const runHubWarp = () => {
            if (!this.enabled || token !== this.rewarpToken) return;

            const remainingMs = this.lastGalateaWarpAt + GALATEA_HUB_DELAY_MS - Date.now();
            if (remainingMs > 0) return ScheduleTask(Math.ceil(remainingMs / 50), runHubWarp);

            ChatLib.command('warp hub');
            ScheduleTask(100, () => {
                if (!this.enabled || token !== this.rewarpToken) return;
                this.waitingForGalateaWorld = true;
                this.lastGalateaWarpAt = Date.now();
                ChatLib.command(`warp ${destination}`);
            });
        };
        runHubWarp();
    }

    distanceSq(target) {
        return (Player.getX() - target.x) ** 2 + (Player.getY() - target.y) ** 2 + (Player.getZ() - target.z) ** 2;
    }

    stopCurrentAction() {
        this.actionToken++;
        if (this.busy && EtherwarpPathfinder.isPathing()) EtherwarpPathfinder.cancel(true);
        if (this.busy) Rotations.stop();
        this.currentTarget = null;
        this.targetStartedAt = 0;
        this.busy = false;
    }

    onEnable() {
        this.message('&aEnabled.');
    }

    onDisable() {
        this.rewarpToken++;
        this.rewarping = false;
        this.waitingForEntities = false;
        this.waitingForGalateaWorld = false;
        this.processedTargets.clear();
        this.fallbackChecked = false;
        this.fallbackWaitUntil = 0;
        this.checkingFallback = false;
        this.stopCurrentAction();
        this.message('&cDisabled.');
    }
}

new MudwormMacro();
