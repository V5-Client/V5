import { MiningEngine, MINING_ENGINE_PRESETS } from '../../utils/MiningEngine';
import { ModuleBase } from '../../utils/ModuleBase';

const PRESET_NAMES = Object.keys(MINING_ENGINE_PRESETS);
const DEFAULT_PRESET = 'Legit';

class MiningEngineSettings extends ModuleBase {
    constructor() {
        super({
            name: 'Mining Engine',
            subcategory: 'Mining',
            description: 'Shared targeting, rotation, and mining defaults used by mining macros.',
            tooltip: 'Shared mining values. Ore Macro, commissions, and other mining macros use these settings.',
            theme: '#5a7cbb',
            showEnabledToggle: false,
        });

        this.simpleMode = true;
        this.rotationComponents = [];
        this.rotationControls = {};

        this.addToggle(
            'Simple Mode',
            (value) => {
                this.simpleMode = !!value;
                this.updateSimpleModeVisibility();
                if (this.simpleMode) this.applySelectedPreset();
                else this.restoreCustomRotationSettings();
            },
            'Use a preset and hide rotation, recovery, scan, and scoring sliders. Loadout and aiming stay available.',
            true
        );
        this.presetSelector = this.addMultiToggle(
            'Preset',
            PRESET_NAMES,
            true,
            (value) => {
                if (!this.simpleMode) return;
                this.applySelectedPreset(value);
            },
            'Ultra Legit is slower, pickier, and more patient. Legit is the current default. Non Legit is faster and less restricted.',
            DEFAULT_PRESET
        );

        this.addSeparator('Loadout');
        this.addSlider(
            'Drill Slot',
            0,
            8,
            0,
            (value) => (MiningEngine.drillSlot = Math.round(value) === 0 ? null : Math.round(value) - 1),
            'Hotbar slot to keep equipped. Zero auto-selects the best drill.'
        );
        this.addMultiToggle(
            'Click Mode',
            ['Hold', 'Left', 'Right'],
            true,
            (value) => (MiningEngine.clickMode = String(MiningEngine.getEnabledOptionName(value, 'Hold') || 'Hold').toLowerCase()),
            'How the engine breaks selected blocks.',
            'Hold'
        );

        this.trackRotation(this.addSeparator('Rotation'));
        this.rotationControls.rotationSpeed = this.trackRotation(
            this.addSlider(
                'Mining Rotation Speed',
                1,
                100,
                48,
                this.rotationValue((value) => (MiningEngine.rotationSpeed = value / 100)),
                'Humanized rotation speed for mining targets.'
            )
        );
        this.rotationControls.fov = this.trackRotation(
            this.addSlider(
                'FOV',
                30,
                360,
                120,
                this.rotationValue((value) => {
                    MiningEngine.fov = value;
                    MiningEngine.checkFov = value < 360;
                }),
                'Horizontal field of view for target selection. 360 allows blocks behind you.'
            )
        );
        this.rotationControls.minimumVisibleRays = this.trackRotation(
            this.addSlider(
                'Minimum Visible Rays',
                0,
                9,
                0,
                this.rotationValue((value) => (MiningEngine.minimumVisibleRays = Math.round(value))),
                'Minimum face samples that must be visible. Zero accepts any visible amount.'
            )
        );
        this.rotationControls.costTurnWeight = this.trackRotation(
            this.addSlider(
                'Turn Weight',
                0,
                2,
                0.4,
                this.rotationValue((value) => (MiningEngine.costTurnWeight = value)),
                'How heavily yaw change affects target choice.'
            )
        );
        this.rotationControls.costTurnExtraAfter = this.trackRotation(
            this.addSlider(
                'Extra Turn After',
                0,
                180,
                40,
                this.rotationValue((value) => (MiningEngine.costTurnExtraAfter = value)),
                'Degrees of turn before extra turn cost is applied.'
            )
        );
        this.rotationControls.costTurnExtraWeight = this.trackRotation(
            this.addSlider(
                'Extra Turn Weight',
                0,
                2,
                0.35,
                this.rotationValue((value) => (MiningEngine.costTurnExtraWeight = value)),
                'Additional cost for turns larger than Extra Turn After.'
            )
        );
        this.rotationControls.costPitchWeight = this.trackRotation(
            this.addSlider(
                'Pitch Weight',
                0,
                2,
                0.25,
                this.rotationValue((value) => (MiningEngine.costPitchWeight = value)),
                'How heavily pitch change affects target choice.'
            )
        );

        this.addSeparator('Aiming');
        this.addSlider(
            'Block Reach',
            3,
            6,
            4.5,
            (value) => {
                MiningEngine.mineReach = value;
                MiningEngine.faceReach = value;
            },
            'Maximum mining reach used when scanning and aiming.'
        );
        this.addToggle(
            'Sneak While Mining',
            (value) => {
                MiningEngine.sneakWhileMining = value;
                if (!value) Client.setKey('shift', false);
            },
            'Hold sneak while the engine is mining.',
            true
        );

        this.addSeparator('Tick Glide');
        let lagCompensationSetting;
        this.addToggle(
            'Tick Gliding',
            (value) => {
                MiningEngine.tickGliding = value;
                if (lagCompensationSetting) lagCompensationSetting.visible = value;
            },
            'Start looking at the next block before the current one finishes breaking.',
            true
        );
        lagCompensationSetting = this.addSlider(
            'Lag Compensation',
            0,
            5,
            1,
            (value) => (MiningEngine.lagCompensation = value),
            'Extra ticks added to predicted break time on top of TPS compensation.'
        );
        lagCompensationSetting.visible = MiningEngine.tickGliding;

        this.trackRotation(this.addSeparator('Recovery'));
        this.rotationControls.mineTimeoutTicks = this.trackRotation(
            this.addSlider(
                'Mining Retry Delay',
                2,
                100,
                8,
                this.rotationValue((value) => (MiningEngine.mineTimeoutTicks = Math.round(value))),
                'Ticks before refreshing the aim point on an unbroken block.'
            )
        );
        this.rotationControls.stuckNoLookTicks = this.trackRotation(
            this.addSlider(
                'Stuck No-Look Ticks',
                5,
                80,
                25,
                this.rotationValue((value) => (MiningEngine.stuckNoLookTicks = Math.round(value))),
                'Ticks looking away from the block before treating it as stuck.'
            )
        );
        this.rotationControls.stuckFailSkip = this.trackRotation(
            this.addSlider(
                'Stuck Fail Skip',
                1,
                6,
                2,
                this.rotationValue((value) => (MiningEngine.stuckFailSkip = Math.round(value))),
                'Failed recoveries before blacklisting and skipping the block.'
            )
        );
        this.rotationControls.targetBlacklistMs = this.trackRotation(
            this.addSlider(
                'Blacklist Duration',
                500,
                15000,
                4000,
                this.rotationValue((value) => (MiningEngine.targetBlacklistMs = Math.round(value))),
                'How long skipped blocks stay ignored, in milliseconds.'
            )
        );

        this.addSeparator('Mithril Priority');
        this.addToggle(
            'Prioritize Titanium',
            (value) => MiningEngine.setPrioritizeTitanium(value),
            'Prefer titanium over other mithril when both are in range.',
            true
        );
        this.addToggle(
            'Prioritize Gray Mithril',
            (value) => MiningEngine.setPrioritizeGrayMithril(value),
            'Prefer gray mithril over light-blue mithril.'
        );

        this.trackRotation(this.addSeparator('Scan Budget'));
        this.rotationControls.approachScanReach = this.trackRotation(
            this.addSlider(
                'Approach Scan Reach',
                4,
                12,
                8,
                this.rotationValue((value) => (MiningEngine.approachScanReach = value)),
                'How far the engine looks for out-of-reach approach targets.'
            )
        );
        this.rotationControls.approachTargetBudget = this.trackRotation(
            this.addSlider(
                'Approach Target Budget',
                1,
                30,
                10,
                this.rotationValue((value) => (MiningEngine.approachTargetBudget = Math.round(value))),
                'Maximum out-of-reach candidates kept while scanning.'
            )
        );
        this.rotationControls.reachableCandidateEvaluationBudget = this.trackRotation(
            this.addSlider(
                'Candidate Eval Budget',
                4,
                60,
                24,
                this.rotationValue((value) => (MiningEngine.reachableCandidateEvaluationBudget = Math.round(value))),
                'How many nearby candidates to fully evaluate for visibility.'
            )
        );
        this.rotationControls.reachableVisibleTargetBudget = this.trackRotation(
            this.addSlider(
                'Visible Target Budget',
                1,
                30,
                10,
                this.rotationValue((value) => (MiningEngine.reachableVisibleTargetBudget = Math.round(value))),
                'Maximum visible targets kept after scoring.'
            )
        );
        this.rotationControls.reachableVisibleStopCount = this.trackRotation(
            this.addSlider(
                'Visible Stop Count',
                1,
                10,
                3,
                this.rotationValue((value) => (MiningEngine.reachableVisibleStopCount = Math.round(value))),
                'Stop evaluating extra candidates once this many visible targets are found.'
            )
        );

        this.trackRotation(this.addSeparator('Target Scoring'));
        this.rotationControls.costDistanceWeight = this.trackRotation(
            this.addSlider(
                'Distance Weight',
                0,
                20,
                8,
                this.rotationValue((value) => (MiningEngine.costDistanceWeight = value)),
                'How heavily distance affects which block is chosen next.'
            )
        );
        this.rotationControls.veinAdjacentBonus = this.trackRotation(
            this.addSlider(
                'Vein Adjacent Bonus',
                0,
                40,
                16,
                this.rotationValue((value) => (MiningEngine.veinAdjacentBonus = value)),
                'Score bonus for blocks touching the last mined block.'
            )
        );
        this.rotationControls.veinNearBonus = this.trackRotation(
            this.addSlider(
                'Vein Near Bonus',
                0,
                20,
                8,
                this.rotationValue((value) => (MiningEngine.veinNearBonus = value)),
                'Score bonus for blocks two steps from the last mined block.'
            )
        );

        this.updateSimpleModeVisibility();
        this.applySelectedPreset();
    }

    trackRotation(component) {
        this.rotationComponents.push(component);
        return component;
    }

    rotationValue(apply) {
        return (value) => {
            if (this.simpleMode) return;
            apply(value);
        };
    }

    updateSimpleModeVisibility() {
        this.presetSelector.visible = this.simpleMode;
        this.rotationComponents.forEach((component) => {
            component.visible = !this.simpleMode;
        });
    }

    applySelectedPreset(value) {
        const name = MiningEngine.getEnabledOptionName(value || this.presetSelector?.options, DEFAULT_PRESET) || DEFAULT_PRESET;
        MiningEngine.applyPreset(name);
    }

    restoreCustomRotationSettings() {
        const controls = this.rotationControls;
        const rotationSpeed = controls.rotationSpeed?.value;
        if (Number.isFinite(rotationSpeed)) MiningEngine.rotationSpeed = rotationSpeed / 100;

        const fov = controls.fov?.value;
        if (Number.isFinite(fov)) {
            MiningEngine.fov = fov;
            MiningEngine.checkFov = fov < 360;
        }

        const rays = controls.minimumVisibleRays?.value;
        if (Number.isFinite(rays)) MiningEngine.minimumVisibleRays = Math.round(rays);

        const turnWeight = controls.costTurnWeight?.value;
        if (Number.isFinite(turnWeight)) MiningEngine.costTurnWeight = turnWeight;

        const extraAfter = controls.costTurnExtraAfter?.value;
        if (Number.isFinite(extraAfter)) MiningEngine.costTurnExtraAfter = extraAfter;

        const extraWeight = controls.costTurnExtraWeight?.value;
        if (Number.isFinite(extraWeight)) MiningEngine.costTurnExtraWeight = extraWeight;

        const pitchWeight = controls.costPitchWeight?.value;
        if (Number.isFinite(pitchWeight)) MiningEngine.costPitchWeight = pitchWeight;

        const retryDelay = controls.mineTimeoutTicks?.value;
        if (Number.isFinite(retryDelay)) MiningEngine.mineTimeoutTicks = Math.round(retryDelay);

        const stuckTicks = controls.stuckNoLookTicks?.value;
        if (Number.isFinite(stuckTicks)) MiningEngine.stuckNoLookTicks = Math.round(stuckTicks);

        const failSkip = controls.stuckFailSkip?.value;
        if (Number.isFinite(failSkip)) MiningEngine.stuckFailSkip = Math.round(failSkip);

        const blacklistMs = controls.targetBlacklistMs?.value;
        if (Number.isFinite(blacklistMs)) MiningEngine.targetBlacklistMs = Math.round(blacklistMs);

        const approachReach = controls.approachScanReach?.value;
        if (Number.isFinite(approachReach)) MiningEngine.approachScanReach = approachReach;

        const approachBudget = controls.approachTargetBudget?.value;
        if (Number.isFinite(approachBudget)) MiningEngine.approachTargetBudget = Math.round(approachBudget);

        const evalBudget = controls.reachableCandidateEvaluationBudget?.value;
        if (Number.isFinite(evalBudget)) MiningEngine.reachableCandidateEvaluationBudget = Math.round(evalBudget);

        const visibleBudget = controls.reachableVisibleTargetBudget?.value;
        if (Number.isFinite(visibleBudget)) MiningEngine.reachableVisibleTargetBudget = Math.round(visibleBudget);

        const stopCount = controls.reachableVisibleStopCount?.value;
        if (Number.isFinite(stopCount)) MiningEngine.reachableVisibleStopCount = Math.round(stopCount);

        const distanceWeight = controls.costDistanceWeight?.value;
        if (Number.isFinite(distanceWeight)) MiningEngine.costDistanceWeight = distanceWeight;

        const adjacentBonus = controls.veinAdjacentBonus?.value;
        if (Number.isFinite(adjacentBonus)) MiningEngine.veinAdjacentBonus = adjacentBonus;

        const nearBonus = controls.veinNearBonus?.value;
        if (Number.isFinite(nearBonus)) MiningEngine.veinNearBonus = nearBonus;
    }
}

export const miningEngineSettings = new MiningEngineSettings();
