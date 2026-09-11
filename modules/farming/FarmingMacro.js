import { ModuleBase } from '../../utils/ModuleBase';
import { MiningEngine, MiningRotations } from '../../utils/MiningEngine';
import { Mousemat } from '../../utils/player/Mousemat';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { TabListUtils } from '../../utils/TabListUtils';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { Guis } from '../../utils/player/Inventory';
import { farmingSettings } from './FarmingSettings';
import { farmingDelays } from './FarmingDelays';
import { rewarpHandler } from './rewarp/RewarpHandler';
import { rewarpSettings } from './rewarp/RewarpSettings';
import { getNearbyPest, getVisibleNearbyPest, isPestVisible } from '../visuals/PestESP';
import { loadoutHandler } from './LoadoutHandler';
import { manager } from '../../utils/SkyblockEvents';

const MAX_PEST_TRACK_DISTANCE = 14;
const PEST_STALL_GRACE_TICKS = 20;
const PEST_SEARCH_MAX_TICKS = 50;
const PEST_SEARCH_COOLDOWN_TICKS = 20;
const PEST_SEARCH_LOOKS = [
    [20, 8],
    [-24, 12],
    [48, -6],
    [-52, 4],
    [82, 10],
    [-88, -2],
    [128, 6],
    [-134, 8],
    [176, 0],
];
const GUI_RESUME_GRACE_TICKS = 5;
const SPRAY_CHECK_COOLDOWN_MS = 5_000;
const SPRAY_RESTORE_DELAY_TICKS = 3;
const TAB_CHECK_GRACE_MS = 5_000;
const FARMING = 'Farming';
const PEST = 'Pest';
const RESTORING_PEST = 'Restoring Pest';
const REWARPING = 'Rewarping';

export class FarmingMacro extends ModuleBase {
    constructor(options, commandPrefix) {
        super({ subcategory: 'Farming', isMacro: true, ...options, autoDisableOnWorldUnload: true });

        this.pointsPath = `FarmingMacro/${commandPrefix.replaceAll(' ', '_')}_points.json`;
        this.points = Utils.getConfigFile(this.pointsPath) || {};

        this.bindToggleKey();
        const rewarpStart = this.addButton(
            'Set Rewarp Start',
            () => this.saveRewarpPoint('start'),
            'Stand at the position reached by the rewarp command.'
        );
        const rewarpEnd = this.addButton(
            'Set Rewarp End',
            () => this.saveRewarpPoint('end'),
            'Stand at the farm endpoint that should trigger a rewarp.'
        );
        rewarpSettings.addRewarpButtons(rewarpStart, rewarpEnd);
        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => (this.mode === FARMING ? this.state : this.mode),
                    Cooldown: () => {
                        const seconds = TabListUtils.getPestCooldown();
                        return seconds === 0 ? 'READY' : `${seconds}s`;
                    },
                },
            },
        ]);

        this.on('tick', () => this.handleTick());
        manager.subscribe('sprayonatorunavailable', () => {
            if (this.enabled && farmingSettings.useSprayonator) this.sprayonatorUnavailable = true;
        });
    }

    onEnable() {
        if ((farmingSettings.killNearbyPests || rewarpSettings.pestKiller) && Guis.findItemInHotbar('Vacuum') < 0) {
            this.message('&cNo Vacuum found in hotbar.');
            this.toggle(false);
            return;
        }
        if (!rewarpSettings.looping) {
            if (!this.isPoint(this.points.start) || !this.isPoint(this.points.end)) {
                this.message('Set both Rewarp points before enabling Rewarp mode.');
                this.toggle(false);
                return;
            }
            if (this.rewarpPointsOverlap()) {
                this.message('Rewarp start/end overlap detected. Ensure the points are set correctly.');
                this.toggle(false);
                return;
            }
        }
        this.farmingRotation = null;
        this.nextSprayCheckAt = 0;
        this.sprayonatorUnavailable = false;
        this.sprayonatorAction = null;
        this.mode = FARMING;
        this.stallGraceTicks = 0;
        this.pestSearch = null;
        this.pestSearchCooldown = 0;
        Mouse.ungrab();
        this.startDelayTicks = 1;
        const player = Player.getPlayer();
        if (!player) return;

        this.farmingSlot = Player.getHeldItemIndex();
        loadoutHandler.forgetEquipped();
        loadoutHandler.select(this.getFarmingOrSpawnLoadout());
        this.startFarming(player);
    }

    onDisable() {
        rewarpHandler.stop();
        Mousemat.stop();
        MiningRotations.stop();
        Client.unpressKeys();
        Mouse.regrab();
        this.mode = FARMING;
        this.pestTarget = null;
        this.pestRotation = null;
        this.pestFarmState = null;
        this.pestSearch = null;
        this.pestSearchCooldown = 0;
        this.stallGraceTicks = 0;
        if (this.sprayonatorAction) Guis.setItemSlot(this.sprayonatorOriginalSlot);
        this.sprayonatorAction = null;
        farmingSettings.restoreSlot();
    }

    handleTick() {
        if (this.startDelayTicks > 0) {
            this.startDelayTicks--;
            return;
        }

        const player = Player.getPlayer();
        if (!player) return;

        if (Client.isInGui() && this.mode !== REWARPING) {
            this.stationaryTicks = 0;
            this.stallGraceTicks = Math.max(this.stallGraceTicks, GUI_RESUME_GRACE_TICKS);
            return;
        }
        if (Mousemat.active) return;

        switch (this.mode) {
            case FARMING:
                return this.handleFarming(player);
            case PEST:
                return this.handlePest(player);
            case RESTORING_PEST:
                return Client.unpressKeys();
            case REWARPING:
                return rewarpHandler.tick(player);
        }
    }

    handleFarming(player) {
        if (loadoutHandler.switching) return Client.unpressKeys();
        if (this.sprayonatorAction) return;
        if (farmingSettings.killNearbyPests && !rewarpSettings.pestKiller && this.handlePest(player)) return;

        const looping = rewarpSettings.looping;
        if (rewarpSettings.pestKiller && Utils.getGardenPestStatus().gardenPests >= rewarpSettings.pestThreshold) {
            const pestColumnClear = this.isPestColumnClear(player);
            if (looping || pestColumnClear) {
                const returnPoint = { x: player.getX(), y: player.getY(), z: player.getZ() };
                if (looping) ChatLib.command('sethome');
                return this.beginRewarp(returnPoint, true);
            }
        }
        if (!looping && this.isAtPoint(player, this.points.end)) {
            return this.beginRewarp(
                this.points.start,
                rewarpSettings.pestKiller && Utils.getGardenPestStatus().gardenPests >= rewarpSettings.pestThreshold
            );
        }
        if (looping && this.shouldRunBarnTasks()) {
            ChatLib.command('sethome');
            return this.beginRewarp({ x: player.getX(), y: player.getY(), z: player.getZ() });
        }

        if (!loadoutHandler.select(this.getFarmingOrSpawnLoadout())) return Client.unpressKeys();

        if (this.trySprayonator()) return;

        if (MiningRotations.isRotating) return this.hold();

        if (player.getAbilities().flying) return this.hold('shift');

        if (this.stallGraceTicks > 0) {
            this.stallGraceTicks--;
            this.updatePosition(player);
        } else {
            this.updateFarmState(player);
        }
        this.invokeFarmState();
    }

    trySprayonator() {
        const now = Date.now();
        if (
            this.sprayonatorUnavailable ||
            !farmingSettings.useSprayonator ||
            now < this.nextSprayCheckAt ||
            now < this.nextTabCheckAt ||
            !this.hasNoSpray()
        ) {
            return false;
        }

        const slot = Guis.findItemInHotbar('Sprayonator');
        if (slot < 0) return false;

        this.sprayonatorOriginalSlot = this.farmingSlot;
        const action = {};
        this.sprayonatorAction = action;
        Client.unpressKeys();
        Guis.setItemSlot(slot);
        ScheduleTask(farmingDelays.ticks('sprayonatorAction'), () => {
            if (this.sprayonatorAction !== action) return;
            Client.rightClick();
            ScheduleTask(farmingDelays.ticks('sprayonatorAction'), () => {
                if (this.sprayonatorAction !== action) return;
                Guis.setItemSlot(this.sprayonatorOriginalSlot);
                this.startDelayTicks = Math.max(this.startDelayTicks, SPRAY_RESTORE_DELAY_TICKS);
                this.nextSprayCheckAt = Date.now() + SPRAY_CHECK_COOLDOWN_MS;
                this.sprayonatorAction = null;
            });
        });
        return true;
    }

    hasNoSpray() {
        return TabListUtils.getNames().some((line) => /\bSpray:\s*None\b/.test(TabListUtils.stripFormatting(line?.getName?.() ?? line)));
    }

    beginRewarp(rewarpStartPoint = this.points.start, runPestKiller = false) {
        Client.unpressKeys();
        this.mode = REWARPING;
        rewarpHandler.start(this, rewarpStartPoint, runPestKiller);
    }

    isPestColumnClear(player) {
        const x = Math.floor(player.getX());
        const z = Math.floor(player.getZ());
        for (let y = Math.floor(player.getY()) + 2; y <= 76; y++) {
            if (String(World.getBlockAt(x, y, z)?.type?.getRegistryName?.()) !== 'minecraft:air') return false;
        }
        return true;
    }

    shouldRunBarnTasks() {
        return Date.now() >= this.nextTabCheckAt && (rewarpSettings.shouldRunVisitorMacro() || rewarpSettings.shouldRunPhilipBonus());
    }

    getFarmingOrSpawnLoadout() {
        return TabListUtils.getPestCooldown() <= loadoutHandler.pestSpawnSwapCooldown
            ? loadoutHandler.pestSpawningSlot
            : loadoutHandler.farmingSlot;
    }

    finishRewarp(player) {
        if (!loadoutHandler.select(loadoutHandler.farmingSlot)) return;
        if (Player.getHeldItemIndex() !== this.farmingSlot) {
            Guis.setItemSlot(this.farmingSlot);
            return;
        }
        this.mode = FARMING;
        this.startFarming(player);
    }

    handlePest(player) {
        if (this.mode === FARMING) {
            if (this.pestSearchCooldown > 0) {
                this.pestSearchCooldown--;
                return false;
            }
            if (!getNearbyPest()) return false;
            this.pestTarget = getVisibleNearbyPest();
        } else {
            if (this.pestTarget?.isDead() || (this.pestTarget && !this.isPestInRange(this.pestTarget))) this.pestTarget = null;
            if (this.pestTarget && !isPestVisible(this.pestTarget)) this.pestTarget = null;
            if (!this.pestTarget) this.pestTarget = getVisibleNearbyPest();
            if (!this.pestTarget && !getNearbyPest()) {
                this.finishPest();
                return true;
            }
        }

        Client.unpressKeys();
        if (this.mode === FARMING) {
            this.pestRotation = { yaw: player.getYRot(), pitch: player.getXRot() };
            this.pestFarmState = {
                state: this.state,
                lastDirection: this.lastDirection,
                yaw: this.yaw,
                leftYaw: this.leftYaw,
                laneChanging: this.laneChanging,
            };
            this.mode = PEST;
            this.pestSearch = null;
        }
        if (!loadoutHandler.select(loadoutHandler.pestKillingSlot)) return true;
        if (farmingSettings.originalSlot === -1) farmingSettings.originalSlot = Player.getHeldItemIndex();
        if (!farmingSettings.selectVacuum()) return true;

        if (this.pestTarget) {
            this.pestSearch = null;
            Client.setKey('rightclick', true);
            MiningRotations.trackEntity(this.pestTarget, MiningEngine.rotationSpeed);
            return true;
        }

        return this.searchForPest(player);
    }

    searchForPest(player) {
        if (!this.pestSearch) {
            this.pestSearch = {
                ticks: 0,
                index: 0,
                yaw: this.pestRotation?.yaw ?? player.getYRot(),
            };
        }

        this.pestSearch.ticks++;
        if (this.pestSearch.ticks > PEST_SEARCH_MAX_TICKS || this.pestSearch.index >= PEST_SEARCH_LOOKS.length) {
            this.pestSearchCooldown = PEST_SEARCH_COOLDOWN_TICKS;
            this.finishPest();
            return true;
        }

        if (!MiningRotations.isRotating) {
            const look = PEST_SEARCH_LOOKS[this.pestSearch.index++];
            MiningRotations.lookAtAngles(
                this.pestSearch.yaw + look[0] + Utils.randomFloat(-8, 8),
                Utils.clamp(look[1] + Utils.randomFloat(-6, 6), -35, 40),
                MiningEngine.rotationSpeed
            );
        }
        return true;
    }

    isPestInRange(pest) {
        const eyes = Player.getPlayer()?.getEyePosition();
        if (!eyes) return false;
        const dx = pest.getX() - eyes.x();
        const dy = pest.getY() - eyes.y();
        const dz = pest.getZ() - eyes.z();
        return dx * dx + dy * dy + dz * dz <= MAX_PEST_TRACK_DISTANCE ** 2;
    }

    finishPest() {
        const rotation = this.pestRotation;
        const farmState = this.pestFarmState;
        if (!this.pestTarget && !rotation) return;

        this.mode = RESTORING_PEST;
        MiningRotations.stop();
        Client.unpressKeys();
        farmingSettings.restoreSlot();
        if (!rotation || !this.enabled) return;

        const resume = () => {
            const player = Player.getPlayer();
            if (this.enabled && player) this.resumeFarming(player, farmState, rotation);
        };
        ScheduleTask(farmingDelays.ticks('pestRestore'), () => {
            if (!farmingSettings.useMousemat) {
                if (!this.rotateTo(rotation.yaw, rotation.pitch, resume)) resume();
                return;
            }
            if (Mousemat.restore()) {
                Mousemat.onComplete(resume);
            } else {
                this.message(`&cNo Mousemat found in hotbar.`);
                this.toggle(false);
            }
        });
    }

    resumeFarming(player, farmState, rotation) {
        this.nextTabCheckAt = Date.now() + TAB_CHECK_GRACE_MS;
        if (!farmingSettings.useMousemat) {
            this.startFarming(player);
            MiningRotations.lookAtAngles(rotation.yaw, rotation.pitch, MiningEngine.rotationSpeed);
        }
        Object.assign(this, farmState);
        this.pestTarget = null;
        this.pestRotation = null;
        this.pestFarmState = null;
        this.pestSearch = null;
        this.stallGraceTicks = PEST_STALL_GRACE_TICKS;
        this.mode = FARMING;
    }

    startFarming(player) {
        this.nextTabCheckAt = Date.now() + TAB_CHECK_GRACE_MS;
        this.stationaryTicks = 0;
        this.updatePosition(player);
        this.onFarmStart(player);
    }

    rotateTo(yaw, pitch, callback = null) {
        if (this.mode === FARMING && callback === null) {
            if (!this.farmingRotation) this.farmingRotation = { yaw, pitch };
            ({ yaw, pitch } = this.farmingRotation);
        }

        if (!farmingSettings.useMousemat) {
            const started = MiningRotations.lookAtAngles(yaw, pitch, MiningEngine.rotationSpeed);
            if (started && callback) MiningRotations.onComplete(callback);
            return started;
        }

        Client.unpressKeys();
        MiningRotations.stop();
        if (!Mousemat.rotateTo(yaw, pitch)) {
            this.message(`&cNo Mousemat found in hotbar.`);
            this.toggle(false);
            return false;
        }
        if (callback) Mousemat.onComplete(callback);
        return true;
    }

    hold(key = '') {
        ['a', 'd', 'w', 's', 'shift'].forEach((movement) => Client.setKey(movement, key.includes(movement)));
        Client.setKey('leftclick', true);
        Client.setKey('sprint', false);
    }

    saveRewarpPoint(name) {
        const player = Player.getPlayer();
        if (!player) return;

        this.points[name] = { x: player.getX(), y: player.getY(), z: player.getZ() };
        Utils.writeConfigFile(this.pointsPath, this.points);
        this.message(`&aRewarp ${name} saved.`);
        if (this.rewarpPointsOverlap()) this.message('Rewarp point currently overlap. The macro will not work.');
    }

    rewarpPointsOverlap() {
        if (!this.isPoint(this.points.start) || !this.isPoint(this.points.end)) return false;
        const { start, end } = this.points;
        return Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z) <= rewarpSettings.triggerRadius * 2;
    }

    isAtPoint(player, point) {
        if (!this.isPoint(point)) return false;
        const dx = player.getX() - point.x;
        const dy = player.getY() - point.y;
        const dz = player.getZ() - point.z;
        return dx * dx + dy * dy + dz * dz <= rewarpSettings.triggerRadius ** 2;
    }

    isPoint(point) {
        return Number.isFinite(point?.x) && Number.isFinite(point?.y) && Number.isFinite(point?.z);
    }

    getLaneSwitchDelayTicks() {
        return Math.round(Utils.randomInt(this.laneSwitchDelayMin, this.laneSwitchDelayMax) / 50);
    }

    addLaneSwitchDelaySettings() {
        this.laneSwitchDelayMin = 100;
        this.laneSwitchDelayMax = 300;
        this.addRangeSlider('Lane Switch Delay', 0, 600, { low: this.laneSwitchDelayMin, high: this.laneSwitchDelayMax }, (value) => {
            this.laneSwitchDelayMin = Math.round(value.low);
            this.laneSwitchDelayMax = Math.round(value.high);
        });
    }

    snapYaw(startingYaw, macroYaw) {
        return this.farmingRotation?.yaw ?? Math.round((startingYaw - macroYaw) / 90) * 90 + macroYaw;
    }

    updatePosition(player) {
        this.previousTickX = player.getX();
        this.previousTickZ = player.getZ();
    }

    consumeIgnoreTicks(player) {
        if (this.ignoreTicks <= 0) return false;
        this.ignoreTicks--;
        this.updatePosition(player);
        return true;
    }

    isStationaryForTicks(player, ticks) {
        const stationary = player.getX() === this.previousTickX && player.getZ() === this.previousTickZ;
        this.updatePosition(player);
        this.stationaryTicks = stationary ? this.stationaryTicks + 1 : 0;
        if (!stationary || this.stationaryTicks < ticks) return false;
        this.stationaryTicks = 0;
        return true;
    }
}
