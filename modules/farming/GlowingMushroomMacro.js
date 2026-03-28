// @Private
// Vibecoded slop
// who cares
// 10m/h on nuker mode
// great
// love it
import { ModuleBase } from '../../utils/ModuleBase';
import { MacroState } from '../../utils/MacroState';
import Pathfinder from '../../utils/pathfinder/PathFinder';
import { Keybind } from '../../utils/player/Keybinding';
import { Rotations } from '../../utils/player/Rotations';
import { Raytrace } from '../../utils/Raytrace';
import { NukerUtils } from '../../utils/NukerUtils';
import { getTrackedGlowingMushrooms, isGlowingMushroomBlock } from './GlowingMushroomESP';

const MAX_REACH = 4.5;
const AIM_FAIL_BLACKLIST_MS = 3000;
const MAX_TARGET_CLICK_RETRIES = 2;
const HARVEST_MODES = ['Click', 'Nuker'];
const WAITING_PATH_GOAL = [214, 41, -505];
const MUSHROOM_AIM_OFFSETS = [
    [0.5, 0.2, 0.5],
    [0.45, 0.2, 0.5],
    [0.55, 0.2, 0.5],
    [0.5, 0.2, 0.45],
    [0.5, 0.2, 0.55],
    [0.5, 0.3, 0.5],
];

class GlowingMushroomMacro extends ModuleBase {
    constructor() {
        super({
            name: 'Glowing Mushroom Macro',
            subcategory: 'Farming',
            description: 'Pathfinds to tracked glowing mushrooms and harvests nearby mushrooms.',
            tooltip: 'Uses Glowing Mushroom ESP targets, pathfinds to them, then harvests nearby mushrooms in a loop.',
            theme: '#89d85e',
            showEnabledToggle: false,
            isMacro: true,
        });

        this.bindToggleKey();

        this.status = 'Idle';
        this.loopToken = 0;
        this.autoEnabledEsp = false;
        this.pathRequestActive = false;
        this.waitingPathActive = false;
        this.pathRequestId = 0;
        this.harvestRequestActive = false;
        this.harvestMode = HARVEST_MODES[0];
        this.pathsCompleted = 0;
        this.lastClickCount = 0;
        this.trackedCount = 0;
        this.reachableCount = 0;
        this.blacklistedMushrooms = new Map();
        this.on('tick', () => this.runLoop(this.loopToken));

        this.addMultiToggle(
            'Harvest Mode',
            HARVEST_MODES,
            true,
            (selected) => {
                const enabled = Array.isArray(selected) ? selected.find((item) => item.enabled) : null;
                this.harvestMode = enabled?.name || HARVEST_MODES[0];
            },
            'Click rotates + left-clicks. Nuker packet-breaks nearby mushrooms.',
            HARVEST_MODES[0]
        );

        this.createOverlay([
            {
                title: 'Status',
                data: {
                    State: () => this.status,
                    Mode: () => this.harvestMode,
                    Tracked: () => this.trackedCount,
                    Reachable: () => this.reachableCount,
                    Paths: () => this.pathsCompleted,
                    Clicked: () => this.lastClickCount,
                },
            },
        ]);
    }

    onEnable() {
        this.loopToken++;
        this.status = 'Starting';
        this.pathRequestActive = false;
        this.waitingPathActive = false;
        this.pathRequestId = 0;
        this.harvestRequestActive = false;
        this.pathsCompleted = 0;
        this.lastClickCount = 0;
        this.trackedCount = 0;
        this.reachableCount = 0;
        this.blacklistedMushrooms.clear();
        this.message('&aEnabled');
        this.ensureEspEnabled();
    }

    onDisable() {
        this.loopToken++;
        this.status = 'Disabled';
        this.cancelCurrentPathing();
        this.harvestRequestActive = false;
        Rotations.stopRotation();
        Keybind.stopMovement();
        this.restoreEspState();
        this.message('&cDisabled');
    }

    ensureEspEnabled() {
        const espModule = MacroState.getModule('Glowing Mushroom ESP');
        if (!espModule || espModule.enabled) return;

        this.autoEnabledEsp = true;
        espModule.toggle(true);
    }

    restoreEspState() {
        if (!this.autoEnabledEsp) return;

        const espModule = MacroState.getModule('Glowing Mushroom ESP');
        if (espModule?.enabled) espModule.toggle(false);
        this.autoEnabledEsp = false;
    }

    runLoop(token) {
        if (!this.enabled || token !== this.loopToken) return;
        const mushrooms = this.getFreshMushrooms();
        this.trackedCount = mushrooms.length;
        let nearbyNukerTargets = null;

        // In Nuker mode, always try to break nearby mushrooms, even while pathing.
        if (this.harvestMode === 'Nuker') {
            nearbyNukerTargets = this.getReachableNukerMushrooms(mushrooms);
            this.reachableCount = nearbyNukerTargets.length;
            if (nearbyNukerTargets.length) {
                this.nukeMushroomBatch(nearbyNukerTargets, token, (clicks) => {
                    this.lastClickCount = clicks;
                });
            }
        }

        if (this.pathRequestActive || Pathfinder.isPathing()) {
            if (this.waitingPathActive && mushrooms.length) {
                this.cancelCurrentPathing();
            } else {
                this.status = this.waitingPathActive ? 'Waiting for Mushrooms' : 'Pathing';
                return;
            }
        }

        if (this.harvestRequestActive || Rotations.isRotating) {
            this.status = 'Harvesting';
            return;
        }

        if (!mushrooms.length) {
            if (this.harvestMode !== 'Nuker') this.reachableCount = 0;
            this.startWaitingPath(token);
            return;
        }

        const nearby = this.harvestMode === 'Nuker' && nearbyNukerTargets ? nearbyNukerTargets : this.getHarvestTargets(mushrooms);
        this.reachableCount = nearby.length;

        if (nearby.length) {
            this.status = 'Harvesting';
            if (this.harvestMode === 'Nuker') return;
            this.harvestRequestActive = true;
            this.harvestMushrooms(nearby, token, (clicks) => {
                this.harvestRequestActive = false;
                this.lastClickCount = clicks;
            });
            return;
        }

        const pathTargets = mushrooms.filter((mushroom) => !this.isPathGoalAlreadyReached(mushroom));
        if (!pathTargets.length) {
            this.status = 'No Path Needed';
            return;
        }

        const goals = pathTargets.map((mushroom) => [mushroom.x, mushroom.y - 1, mushroom.z]);
        this.startPathRequest(goals, token, {
            waitingPath: false,
            failStatus: 'Path Failed',
            completeStatus: 'Path Complete',
        });
    }

    cancelCurrentPathing() {
        this.pathRequestId++;
        this.pathRequestActive = false;
        this.waitingPathActive = false;
        Pathfinder.resetPath();
    }

    startWaitingPath(token) {
        const [goalX, goalY, goalZ] = WAITING_PATH_GOAL;
        this.status = 'Waiting for Mushrooms';
        if (this.isGoalReached(goalX, goalY, goalZ)) return;

        this.startPathRequest([[goalX, goalY, goalZ]], token, {
            waitingPath: true,
            failStatus: 'Waiting for Mushrooms',
            completeStatus: 'Waiting for Mushrooms',
        });
    }

    startPathRequest(goals, token, { waitingPath = false, failStatus = 'Path Failed', completeStatus = 'Path Complete' } = {}) {
        if (!Array.isArray(goals) || !goals.length) return;

        const requestId = ++this.pathRequestId;
        this.pathRequestActive = true;
        this.waitingPathActive = waitingPath;
        this.status = waitingPath ? 'Waiting for Mushrooms' : 'Pathing';

        Pathfinder.resetPath();
        Pathfinder.findPath(goals, (success) => {
            if (!this.enabled || token !== this.loopToken) return;
            if (requestId !== this.pathRequestId) return;

            this.pathRequestActive = false;
            this.waitingPathActive = false;
            this.pathsCompleted++;

            if (!success) {
                this.status = failStatus;
                return;
            }

            const postPath = this.getHarvestTargets(this.getFreshMushrooms());
            this.reachableCount = postPath.length;

            if (!postPath.length) {
                this.status = completeStatus;
                return;
            }

            this.status = 'Harvesting';
            this.harvestRequestActive = true;
            this.harvestMushrooms(postPath, token, (clicks) => {
                this.harvestRequestActive = false;
                this.lastClickCount = clicks;
            });
        });
    }

    getFreshMushrooms() {
        const tracked = getTrackedGlowingMushrooms();
        if (!tracked?.length) return [];
        this.cleanupBlacklist();
        return tracked.filter((entry) => {
            if (!isGlowingMushroomBlock(entry.x, entry.y, entry.z)) return false;
            return !this.isMushroomBlacklisted(entry.x, entry.y, entry.z);
        });
    }

    getReachableVisibleMushrooms(mushrooms = this.getFreshMushrooms()) {
        const eye = this.getPlayerEye();
        if (!eye) return [];

        const targets = [];

        for (const mushroom of mushrooms) {
            const point = this.getMushroomAimPoint(mushroom, eye);
            if (!point) continue;

            const dx = point.x - eye.x;
            const dy = point.y - eye.y;
            const dz = point.z - eye.z;
            const distance = Math.hypot(dx, dy, dz);
            if (distance > MAX_REACH) continue;

            targets.push({
                x: mushroom.x,
                y: mushroom.y,
                z: mushroom.z,
                point,
                distance,
            });
        }

        targets.sort((a, b) => a.distance - b.distance);
        return targets;
    }

    getReachableNukerMushrooms(mushrooms = this.getFreshMushrooms()) {
        const eye = this.getPlayerEye();
        if (!eye) return [];

        const targets = [];

        for (const mushroom of mushrooms) {
            if (!isGlowingMushroomBlock(mushroom.x, mushroom.y, mushroom.z)) continue;

            const nearestX = Math.max(mushroom.x, Math.min(eye.x, mushroom.x + 1));
            const nearestY = Math.max(mushroom.y, Math.min(eye.y, mushroom.y + 1));
            const nearestZ = Math.max(mushroom.z, Math.min(eye.z, mushroom.z + 1));

            const dx = nearestX - eye.x;
            const dy = nearestY - eye.y;
            const dz = nearestZ - eye.z;
            const distance = Math.hypot(dx, dy, dz);
            if (distance > MAX_REACH) continue;

            targets.push({
                x: mushroom.x,
                y: mushroom.y,
                z: mushroom.z,
                distance,
            });
        }

        targets.sort((a, b) => a.distance - b.distance);
        return targets;
    }

    getHarvestTargets(mushrooms = this.getFreshMushrooms()) {
        if (this.harvestMode === 'Nuker') return this.getReachableNukerMushrooms(mushrooms);
        return this.getReachableVisibleMushrooms(mushrooms);
    }

    harvestMushrooms(targets, token, onDone) {
        if (this.harvestMode === 'Nuker') {
            this.nukeMushroomBatch(targets, token, onDone);
            return;
        }

        this.clickMushroomChain(targets, 0, token, 0, onDone);
    }

    nukeMushroomBatch(targets, token, onDone) {
        if (!this.enabled || token !== this.loopToken) return;

        for (const target of targets) {
            if (!isGlowingMushroomBlock(target.x, target.y, target.z)) continue;
            NukerUtils.nukeQueueAdd([target.x, target.y, target.z], 1);
            onDone(1);
            return;
        }

        onDone(0);
    }

    clickMushroomChain(targets, index, token, clicks, onDone, retryCount = 0) {
        if (!this.enabled || token !== this.loopToken) return;
        let currentIndex = index;
        let target = null;
        let point = null;
        let eye = this.getPlayerEye();

        while (currentIndex < targets.length) {
            target = targets[currentIndex];
            point = this.getMushroomAimPoint(target, eye);
            if (point && this.isPointWithinReach(point, eye)) break;
            if (target) this.blacklistMushroom(target.x, target.y, target.z);
            currentIndex++;
        }

        if (currentIndex >= targets.length || !target || !point) {
            onDone(clicks);
            return;
        }

        Rotations.rotateToVector(point);
        Rotations.onEndRotation(() => {
            if (!this.enabled || token !== this.loopToken) return;

            const refreshedEye = this.getPlayerEye();
            const refreshedPoint = this.getMushroomAimPoint(target, refreshedEye);
            let totalClicks = clicks;

            if (refreshedPoint && this.isPointWithinReach(refreshedPoint, refreshedEye)) {
                Keybind.leftClick();
                totalClicks++;

                // Retry the same tiny-hitbox mushroom a few times before skipping.
                if (isGlowingMushroomBlock(target.x, target.y, target.z) && retryCount < MAX_TARGET_CLICK_RETRIES) {
                    this.clickMushroomChain(targets, currentIndex, token, totalClicks, onDone, retryCount + 1);
                    return;
                }

                if (isGlowingMushroomBlock(target.x, target.y, target.z) && retryCount >= MAX_TARGET_CLICK_RETRIES) {
                    this.blacklistMushroom(target.x, target.y, target.z);
                }
            } else {
                this.blacklistMushroom(target.x, target.y, target.z);
            }

            this.clickMushroomChain(targets, currentIndex + 1, token, totalClicks, onDone, 0);
        });
    }

    getPlayerEye() {
        return Player.getPlayer()?.getEyePos?.() || null;
    }

    getMushroomAimPoint(mushroom, eye = this.getPlayerEye()) {
        if (!eye) return null;
        if (!isGlowingMushroomBlock(mushroom.x, mushroom.y, mushroom.z)) return null;

        for (const offset of MUSHROOM_AIM_OFFSETS) {
            const point = {
                x: mushroom.x + offset[0],
                y: mushroom.y + offset[1],
                z: mushroom.z + offset[2],
            };

            if (!this.isPointWithinReach(point, eye)) continue;
            if (!Raytrace.isLineClear(eye.x, eye.y, eye.z, point.x, point.y, point.z, mushroom.x, mushroom.y, mushroom.z)) continue;

            return point;
        }

        const fallback = Raytrace.getVisiblePoint(mushroom.x, mushroom.y, mushroom.z, true);
        if (!fallback) return null;

        const point = { x: fallback[0], y: fallback[1], z: fallback[2] };
        if (!this.isPointWithinReach(point, eye)) return null;
        return point;
    }

    isPointWithinReach(point, eye = this.getPlayerEye()) {
        if (!eye || !point) return false;

        const x = Array.isArray(point) ? point[0] : point.x;
        const y = Array.isArray(point) ? point[1] : point.y;
        const z = Array.isArray(point) ? point[2] : point.z;
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;

        const dx = x - eye.x;
        const dy = y - eye.y;
        const dz = z - eye.z;
        return Math.hypot(dx, dy, dz) <= MAX_REACH;
    }

    isPathGoalAlreadyReached(mushroom) {
        const player = Player.getPlayer();
        if (!player || !mushroom) return false;

        const goalX = mushroom.x;
        const goalY = mushroom.y - 1;
        const goalZ = mushroom.z;

        const dx = Player.getX() - goalX;
        const dy = Player.getY() - goalY;
        const dz = Player.getZ() - goalZ;

        const horizontalDistSq = dx * dx + dz * dz;
        if (horizontalDistSq > 2.5 * 2.5) return false;
        if (dy < -0.1 || dy > 5.5) return false;

        return player.isOnGround();
    }

    isGoalReached(goalX, goalY, goalZ) {
        const player = Player.getPlayer();
        if (!player) return false;

        const dx = Player.getX() - goalX;
        const dy = Player.getY() - goalY;
        const dz = Player.getZ() - goalZ;

        const horizontalDistSq = dx * dx + dz * dz;
        if (horizontalDistSq > 2.5 * 2.5) return false;
        if (dy < -0.1 || dy > 5.5) return false;

        return player.isOnGround();
    }

    getMushroomKey(x, y, z) {
        return `${Math.floor(x)}:${Math.floor(y)}:${Math.floor(z)}`;
    }

    cleanupBlacklist(now = Date.now()) {
        for (const [key, expiresAt] of this.blacklistedMushrooms.entries()) {
            if (expiresAt <= now) this.blacklistedMushrooms.delete(key);
        }
    }

    isMushroomBlacklisted(x, y, z, now = Date.now()) {
        const key = this.getMushroomKey(x, y, z);
        const expiresAt = this.blacklistedMushrooms.get(key);
        if (!expiresAt) return false;
        if (expiresAt <= now) {
            this.blacklistedMushrooms.delete(key);
            return false;
        }
        return true;
    }

    blacklistMushroom(x, y, z) {
        const key = this.getMushroomKey(x, y, z);
        this.blacklistedMushrooms.set(key, Date.now() + AIM_FAIL_BLACKLIST_MS);
    }
}

new GlowingMushroomMacro();
