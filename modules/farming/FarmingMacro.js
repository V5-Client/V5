import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';
import { Mousemat } from '../../utils/player/Mousemat';
import { Rotations } from '../../utils/player/Rotations';
import { ScheduleTask } from '../../utils/ScheduleTask';
import { TabListUtils } from '../../utils/TabListUtils';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { farmingSettings } from './FarmingSettings';
import { visitorMacro } from './VisitorMacro';
import { getNearbyPest } from '../visuals/PestESP';

const REWARP_RETRY_MS = 10_000;
const MAX_REWARP_ATTEMPTS = 3;
const MAX_PEST_TRACK_DISTANCE = 12;
const PEST_STALL_GRACE_TICKS = 20;
const GUI_RESUME_GRACE_TICKS = 5;
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
        const rewarpStart = this.addButton('Set Rewarp Start', () => this.saveRewarpPoint('start'), 'Stand at the position reached by the rewarp command.');
        const rewarpEnd = this.addButton('Set Rewarp End', () => this.saveRewarpPoint('end'), 'Stand at the farm endpoint that should trigger a rewarp.');
        farmingSettings.addRewarpButtons(rewarpStart, rewarpEnd);
        this.createOverlay([
            {
                title: 'Status',
                data: { State: () => (this.mode === FARMING ? this.state : this.mode) },
            },
        ]);

        this.on('tick', () => this.handleTick());
    }

    onEnable() {
        if (!farmingSettings.looping) {
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
        this.mode = FARMING;
        this.stallGraceTicks = 0;
        Mouse.ungrab();
        this.startDelayTicks = 1;
        const player = Player.getPlayer();
        if (!player) return;

        this.startFarming(player);
    }

    onDisable() {
        if (this.rewarpActionStarted) visitorMacro.toggle(false);
        Mousemat.stop();
        Rotations.stop();
        Keybind.unpressKeys();
        Mouse.regrab();
        this.mode = FARMING;
        this.rewarpActionStarted = false;
        this.pestTarget = null;
        this.pestRotation = null;
        this.pestFarmState = null;
        this.stallGraceTicks = 0;
        farmingSettings.restoreSlot();
    }

    handleTick() {
        if (this.startDelayTicks > 0) {
            this.startDelayTicks--;
            return;
        }

        const player = Player.getPlayer();
        if (!player) return;

        if (Client.isInGui()) {
            this.stationaryTicks = 0;
            this.stallGraceTicks = Math.max(this.stallGraceTicks, GUI_RESUME_GRACE_TICKS);
            return Keybind.unpressKeys();
        }
        if (Mousemat.active) return;

        switch (this.mode) {
            case FARMING:
                return this.handleFarming(player);
            case PEST:
                return this.handlePest(player);
            case RESTORING_PEST:
                return Keybind.unpressKeys();
            case REWARPING:
                return this.handleRewarp(player);
        }
    }

    handleFarming(player) {
        if (farmingSettings.killNearbyPests && this.handlePest(player)) return;

        if (!farmingSettings.looping && this.isAtPoint(player, this.points.end)) return this.beginRewarp();
        if (farmingSettings.looping && farmingSettings.runVisitorMacro && TabListUtils.readVisitors().length >= farmingSettings.minimumVisitors) {
            ChatLib.command('sethome');
            return this.beginRewarp({ x: player.getX(), y: player.getY(), z: player.getZ() });
        }

        if (Rotations.active) return this.hold();

        if (player.getAbilities().flying) return this.hold('shift');

        if (this.stallGraceTicks > 0) {
            this.stallGraceTicks--;
            this.updatePosition(player);
        } else {
            this.updateFarmState(player);
        }
        this.invokeFarmState();
    }

    beginRewarp(rewarpStartPoint = this.points.start) {
        this.rewarpStartPoint = rewarpStartPoint;
        this.rewarpAttempts = 0;
        this.nextRewarpAt = Date.now() + Utils.randomInt(farmingSettings.delayMin, farmingSettings.delayMax);
        Keybind.unpressKeys();
        this.mode = REWARPING;

        if (!farmingSettings.runVisitorMacro || TabListUtils.readVisitors().length < farmingSettings.minimumVisitors) return;

        this.nextRewarpAt = 0;
        if (visitorMacro.enabled) return;
        this.rewarpActionStarted = true;
        visitorMacro.toggle(true, true);
    }

    handleRewarp(player) {
        if (this.nextRewarpAt === 0) {
            if (visitorMacro.enabled) return;
            this.rewarpActionStarted = false;
        }
        Keybind.unpressKeys();
        if (this.isAtPoint(player, this.rewarpStartPoint)) {
            this.mode = FARMING;
            this.startFarming(player);
            return;
        }
        if (Date.now() < this.nextRewarpAt) return;
        if (this.rewarpAttempts >= MAX_REWARP_ATTEMPTS || !farmingSettings.command) {
            this.message('&cRewarp failed.');
            this.toggle(false);
            return;
        }

        ChatLib.command(farmingSettings.command);
        this.rewarpAttempts++;
        this.nextRewarpAt = Date.now() + REWARP_RETRY_MS;
    }

    handlePest(player) {
        if (this.mode === PEST && (this.pestTarget?.isDead() || (this.pestTarget && !this.isPestInRange(this.pestTarget)))) {
            this.finishPest();
            return true;
        }
        if (this.mode === FARMING) {
            this.pestTarget = getNearbyPest();
            if (!this.pestTarget) return false;
        }

        Keybind.unpressKeys();
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
            farmingSettings.originalSlot = Player.getHeldItemIndex();
        }
        if (!farmingSettings.selectVacuum()) return true;
        Keybind.setKey('rightclick', true);
        Rotations.trackEntity(this.pestTarget);
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
        Rotations.stop();
        Keybind.unpressKeys();
        farmingSettings.restoreSlot();
        if (!rotation || !this.enabled) return;

        const resume = () => {
            const player = Player.getPlayer();
            if (this.enabled && player) this.resumeFarming(player, farmState, rotation);
        };
        ScheduleTask(() => {
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
        if (!farmingSettings.useMousemat) {
            this.startFarming(player);
            Rotations.lookAtAngles(rotation.yaw, rotation.pitch);
        }
        Object.assign(this, farmState);
        this.pestTarget = null;
        this.pestRotation = null;
        this.pestFarmState = null;
        this.stallGraceTicks = PEST_STALL_GRACE_TICKS;
        this.mode = FARMING;
    }

    startFarming(player) {
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
            const started = Rotations.lookAtAngles(yaw, pitch);
            if (started && callback) Rotations.onComplete(callback);
            return started;
        }

        Keybind.unpressKeys();
        Rotations.stop();
        if (!Mousemat.rotateTo(yaw, pitch)) {
            this.message(`&cNo Mousemat found in hotbar.`);
            this.toggle(false);
            return false;
        }
        if (callback) Mousemat.onComplete(callback);
        return true;
    }

    hold(key = '') {
        ['a', 'd', 'w', 's', 'shift'].forEach((movement) => Keybind.setKey(movement, key.includes(movement)));
        Keybind.setKey('leftclick', true);
        Keybind.setKey('sprint', false);
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
        return Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z) <= farmingSettings.triggerRadius * 2;
    }

    isAtPoint(player, point) {
        if (!this.isPoint(point)) return false;
        const dx = player.getX() - point.x;
        const dy = player.getY() - point.y;
        const dz = player.getZ() - point.z;
        return dx * dx + dy * dy + dz * dz <= farmingSettings.triggerRadius ** 2;
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
