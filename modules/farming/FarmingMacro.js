import { ModuleBase } from '../../utils/ModuleBase';
import { Keybind } from '../../utils/player/Keybinding';
import { Mousemat } from '../../utils/player/Mousemat';
import { Rotations } from '../../utils/player/Rotations';
import { MacroState } from '../../utils/MacroState';
import { TabListUtils } from '../../utils/TabListUtils';
import { Mouse } from '../../utils/Ungrab';
import { Utils } from '../../utils/Utils';
import { v5Command } from '../../utils/V5Commands';
import { farmingSettings } from './FarmingSettings';
import { getNearbyPest } from '../visuals/PestESP';
import { pestSettings } from './PestKiller';
import { rewarpSettings } from './RewarpSettings';

const REWARP_RETRY_MS = 10_000;
const MAX_REWARP_ATTEMPTS = 3;
const MAX_PEST_TRACK_DISTANCE_SQ = 12 ** 2;
const FARMING = 'Farming';
const PEST = 'Pest';
const RESTORING_PEST = 'Restoring Pest';
const VISITING = 'Visiting';
const REWARPING = 'Rewarping';

export class FarmingMacro extends ModuleBase {
    constructor(options, commandPrefix) {
        super({ subcategory: 'Farming', isMacro: true, showEnabledToggle: false, ...options, autoDisableOnWorldUnload: true });

        this.pointsPath = `FarmingMacro/${commandPrefix.replaceAll(' ', '_')}_points.json`;
        this.points = Utils.getConfigFile(this.pointsPath) || {};
        this.mode = FARMING;
        this.startDelayTicks = 0;
        this.rewarpAttempts = 0;
        this.nextRewarpAt = 0;
        this.pauseForRotations = true;
        this.rewarpActionStarted = false;
        this.rewarpStartPoint = null;
        this.pestTarget = null;
        this.pestRotation = null;
        this.pestFarmState = null;

        this.bindToggleKey();
        this.addButton('Set Rewarp Start', () => this.saveRewarpPoint('start'), 'Stand at the position reached by the rewarp command.');
        this.addButton('Set Rewarp End', () => this.saveRewarpPoint('end'), 'Stand at the farm endpoint that should trigger a rewarp.');
        this.createOverlay([
            {
                title: 'Status',
                data: { State: () => (this.mode === FARMING ? this.state : this.mode) },
            },
        ]);

        v5Command(`${commandPrefix} set start`, () => this.saveRewarpPoint('start'));
        v5Command(`${commandPrefix} set end`, () => this.saveRewarpPoint('end'));
        this.on('tick', () => this.handleTick());
    }

    onEnable() {
        if (rewarpSettings.mode === 'Rewarp' && !this.hasRewarpPoints()) {
            this.message('&cSet both Rewarp points before enabling Rewarp mode.');
            this.toggle(false);
            return;
        }
        Mouse.ungrab();
        this.startDelayTicks = 1;
        const player = Player.getPlayer();
        if (!player) return;

        this.mode = FARMING;
        this.onFarmStart(player);
    }

    onDisable() {
        if (this.rewarpActionStarted) MacroState.getModule('Visitor Macro')?.toggle(false);
        Mousemat.stop();
        Rotations.stop();
        Keybind.unpressKeys();
        Mouse.regrab();
        this.mode = FARMING;
        this.rewarpActionStarted = false;
        this.rewarpStartPoint = null;
        this.rewarpAttempts = 0;
        this.nextRewarpAt = 0;
        this.pestTarget = null;
        this.pestRotation = null;
        this.pestFarmState = null;
        pestSettings.restoreSlot();
    }

    handleTick() {
        if (this.startDelayTicks > 0) {
            this.startDelayTicks--;
            return;
        }

        const player = Player.getPlayer();
        if (!player) return;

        if (Mousemat.active) return;
        if (Keybind.isGuiOpen()) return Keybind.unpressKeys();

        switch (this.mode) {
            case FARMING:
                return this.handleFarming(player);
            case PEST:
                return this.handlePest(player);
            case RESTORING_PEST:
                return Keybind.unpressKeys();
            case VISITING:
                return this.handleVisitor(player);
            case REWARPING:
                return this.handleRewarp(player);
        }
    }

    handleFarming(player) {
        // Nearby pest killer
        if (pestSettings.killNearbyPests && this.handlePest(player)) return;

        // Handle both rewarp modes
        if (rewarpSettings.mode === 'Rewarp' && this.isAtPoint(player, this.points.end)) return this.beginRewarp();
        if (rewarpSettings.mode === 'Looping' && rewarpSettings.runVisitorMacro && TabListUtils.readVisitors().length >= rewarpSettings.minimumVisitors) {
            ChatLib.command('sethome');
            return this.beginRewarp({ x: player.getX(), y: player.getY(), z: player.getZ() });
        }

        if (Rotations.active && this.pauseForRotations) return this.hold(false, false);

        // Shift if flying.
        if (player.getAbilities().flying) return this.hold(false, false, true);

        this.updateFarmState(player);
        this.invokeFarmState();
    }

    beginRewarp(rewarpStartPoint = this.points.start) {
        this.rewarpStartPoint = rewarpStartPoint;
        this.rewarpAttempts = 0;
        this.nextRewarpAt = Date.now() + Utils.randomInt(rewarpSettings.delayMin, rewarpSettings.delayMax);
        Keybind.unpressKeys();

        if (!rewarpSettings.runVisitorMacro || TabListUtils.readVisitors().length < rewarpSettings.minimumVisitors) {
            this.mode = REWARPING;
            return;
        }

        this.mode = VISITING;
        const visitorMacro = MacroState.getModule('Visitor Macro');
        if (visitorMacro.enabled) return;
        this.rewarpActionStarted = true;
        visitorMacro.toggle(true, true);
    }

    handleVisitor(player) {
        if (MacroState.getModule('Visitor Macro').enabled) return;
        this.rewarpActionStarted = false;
        this.mode = REWARPING;
        this.nextRewarpAt = Date.now();
        return this.handleRewarp(player);
    }

    handleRewarp(player) {
        Keybind.unpressKeys();
        if (this.isAtPoint(player, this.rewarpStartPoint)) {
            this.mode = FARMING;
            this.rewarpStartPoint = null;
            this.rewarpAttempts = 0;
            this.nextRewarpAt = 0;
            this.onFarmStart(player);
            return;
        }
        if (Date.now() < this.nextRewarpAt) return;
        if (this.rewarpAttempts >= MAX_REWARP_ATTEMPTS || !rewarpSettings.command) {
            this.message('&cRewarp failed.');
            this.toggle(false);
            return;
        }

        ChatLib.command(rewarpSettings.command);
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
            this.pestFarmState = { state: this.state, lastDirection: this.lastDirection, yaw: this.yaw, leftYaw: this.leftYaw };
            this.mode = PEST;
            pestSettings.begin();
        }
        if (!pestSettings.selectVacuum()) return true;
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
        return dx * dx + dy * dy + dz * dz <= MAX_PEST_TRACK_DISTANCE_SQ;
    }

    finishPest() {
        const rotation = this.pestRotation;
        const farmState = this.pestFarmState;
        if (!this.pestTarget && !rotation) return;

        this.mode = RESTORING_PEST;
        Rotations.stop();
        Keybind.unpressKeys();
        pestSettings.restoreSlot();
        if (!rotation || !this.enabled) return;

        const resume = () => {
            const player = Player.getPlayer();
            if (this.enabled && player) this.resumeFarming(player, farmState, rotation);
        };
        if (!Rotations.lookAtAngles(rotation.yaw, rotation.pitch)) return resume();
        Rotations.onComplete(resume);
    }

    resumeFarming(player, farmState, rotation) {
        this.onFarmStart(player);
        Object.assign(this, farmState);
        if (farmingSettings.rotationMethod !== 'Mousemat') Rotations.lookAtAngles(rotation.yaw, rotation.pitch);
        this.pestTarget = null;
        this.pestRotation = null;
        this.pestFarmState = null;
        this.mode = FARMING;
    }

    rotateTo(yaw, pitch, callback = null) {
        if (farmingSettings.rotationMethod !== 'Mousemat') {
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

    hold(left, backward, sneak = false, right = false, forward = false) {
        Keybind.setKey('a', left);
        Keybind.setKey('d', right);
        Keybind.setKey('w', forward);
        Keybind.setKey('s', backward);
        Keybind.setKey('leftclick', true);
        Keybind.setKey('shift', sneak);
        Keybind.setKey('sprint', false);
    }

    saveRewarpPoint(name) {
        const player = Player.getPlayer();
        if (!player) return;

        this.points[name] = { x: player.getX(), y: player.getY(), z: player.getZ() };
        Utils.writeConfigFile(this.pointsPath, this.points);
        this.message(`&aRewarp ${name} saved.`);
    }

    hasRewarpPoints() {
        return this.isPoint(this.points.start) && this.isPoint(this.points.end);
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

    getLaneSwitchDelay() {
        return Utils.randomInt(this.laneSwitchDelayMin, this.laneSwitchDelayMax);
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
        return Math.round((startingYaw - macroYaw) / 90) * 90 + macroYaw;
    }

    updatePosition(player) {
        this.previousTickX = player.getX();
        this.previousTickZ = player.getZ();
    }

    isStationaryForTicks(player, ticks) {
        const stationary = player.getX() === this.previousTickX && player.getZ() === this.previousTickZ;
        this.updatePosition(player);
        this.stationaryTicks = stationary ? this.stationaryTicks + 1 : 0;
        return this.stationaryTicks >= ticks;
    }
}
