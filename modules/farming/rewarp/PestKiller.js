import { ClientboundLevelParticlesPacket } from '../../../utils/Packets';
import Pathfinder from '../../../utils/pathfinder/PathFinder';
import { Rotations } from '../../../utils/player/Rotations';
import { TabListUtils } from '../../../utils/TabListUtils';
import { getLoadedPests } from '../../visuals/PestESP';
import { farmingSettings } from '../FarmingSettings';

const ANGRY_VILLAGER = net.minecraft.core.particles.ParticleTypes.ANGRY_VILLAGER;
const PEST_RANGE_SQ = 10 ** 2;
const PARTICLE_SEARCH_MS = 2_000;
const PLOT_PATH_DELAY_MS = 2_000;
const PLOT_WARP_MS = 3_000;
const PLOT_TIMEOUT_MS = 30_000;
const PATH_RETRY_MS = 1_000;
const MAX_SEARCH_FAILURES = 3;
const STATES = {
    SEARCHING: 'Searching',
    PATHING_PESTS: 'Pathing to pests',
    KILLING: 'Killing pest',
    WAITING_FOR_PLOT: 'Waiting for plot',
    CAPTURING_PARTICLES: 'Capturing particles',
    PATHING_PARTICLES: 'Pathing to particles',
};

class PestKiller {
    constructor() {
        register('packetReceived', (packet) => this.onParticle(packet)).setFilteredClass(ClientboundLevelParticlesPacket);
    }

    start(macro, skipInitialLocation = false) {
        this.macro = macro;
        this.running = true;
        this.state = STATES.SEARCHING;
        this.initialSearchPending = !skipInitialLocation;
        this.goDirectlyToPlots = skipInitialLocation;
        this.currentPlot = null;
        this.visitedPlots = new Set();
        this.pathToken = 0;
        this.pathRetryAt = 0;
        this.targetId = null;
        this.trackedTargetId = null;
        farmingSettings.originalSlot = Player.getHeldItemIndex();
    }

    tick() {
        if (!this.running) return true;
        if (this.currentPlot !== null && Date.now() >= this.plotTimeoutAt) {
            const plot = this.currentPlot;
            this.stopPath();
            this.stopKilling();
            this.finishArea();
            this.goDirectlyToPlots = true;
            this.macro.message(`&eSkipping pest plot ${plot} after 30 seconds.`);
        }
        if (this.state === STATES.WAITING_FOR_PLOT && Date.now() < this.pathfindAfter) return false;

        const pests = this.goDirectlyToPlots ? [] : getLoadedPests();
        this.goDirectlyToPlots = false;
        if (this.state === STATES.KILLING) {
            const target = pests.find((pest) => this.id(pest) === this.targetId);
            if (target) return this.kill(target);
            this.stopKilling();
            if (!pests.length) this.finishArea();
        }

        if (pests.length) {
            const closest = pests.reduce((closest, pest) => (this.distanceSq(pest) < this.distanceSq(closest) ? pest : closest));
            if (this.distanceSq(closest) <= PEST_RANGE_SQ) return this.kill(closest);
            if (Date.now() >= this.pathRetryAt && (this.state !== STATES.PATHING_PESTS || this.hasPestMoved(pests))) this.pathToPests([closest]);
            return false;
        }

        const infestedPlots = TabListUtils.readPests().infestedPlots;
        if (this.state === STATES.PATHING_PESTS) {
            this.stopPath();
            this.finishArea();
        }
        if (this.state === STATES.PATHING_PARTICLES) return false;
        if (this.state === STATES.CAPTURING_PARTICLES) {
            if (Date.now() >= this.particleSearchEndsAt) this.finishParticleCapture();
            return false;
        }
        if (this.state === STATES.WAITING_FOR_PLOT) {
            if (Date.now() >= this.nextActionAt) this.startParticleSearch();
            return false;
        }
        if (this.initialSearchPending || this.currentPlot !== null) {
            if (this.startParticleSearch()) this.initialSearchPending = false;
            return false;
        }

        const plot = infestedPlots.find((candidate) => !this.visitedPlots.has(candidate));
        if (plot === undefined) {
            this.stop();
            return true;
        }

        this.currentPlot = plot;
        this.searchFailures = 0;
        this.visitedPlots.add(plot);
        ChatLib.command(`tptoplot ${plot}`);
        this.plotTimeoutAt = Date.now() + PLOT_TIMEOUT_MS;
        this.state = STATES.WAITING_FOR_PLOT;
        this.pathfindAfter = Date.now() + PLOT_PATH_DELAY_MS;
        this.nextActionAt = Date.now() + PLOT_WARP_MS;
        return false;
    }

    pathToPests(pests) {
        this.stopKilling();
        this.state = STATES.PATHING_PESTS;
        this.pathPestPositions = new Map();
        const goals = [];
        pests.forEach((pest) => {
            this.pathPestPositions.set(this.id(pest), { x: pest.getX(), y: pest.getY(), z: pest.getZ() });
            const goal = Pathfinder.resolveFlyPoint(pest.getX(), pest.getY(), pest.getZ());
            if (goal) goals.push(goal);
        });
        this.startPath(goals, (success) => {
            this.state = STATES.SEARCHING;
            if (!success) this.pathRetryAt = Date.now() + PATH_RETRY_MS;
            if (!getLoadedPests().length) this.finishArea();
        });
    }

    hasPestMoved(pests) {
        return pests.some((pest) => {
            const start = this.pathPestPositions?.get(this.id(pest));
            if (!start) return false;
            const dx = pest.getX() - start.x;
            const dy = pest.getY() - start.y;
            const dz = pest.getZ() - start.z;
            return dx * dx + dy * dy + dz * dz > 3 ** 2;
        });
    }

    kill(pest) {
        this.stopPath();
        this.state = STATES.KILLING;
        this.targetId = this.id(pest);
        Client.unpressKeys();
        if (!farmingSettings.selectVacuum()) return false;
        if (this.trackedTargetId !== this.targetId) {
            Rotations.trackEntity(pest);
            this.trackedTargetId = this.targetId;
        }
        Client.setKey('rightclick', true);
        return false;
    }

    stopKilling() {
        if (this.state !== STATES.KILLING) return;
        Rotations.stop();
        Client.unpressKeys();
        this.targetId = null;
        this.trackedTargetId = null;
        this.state = STATES.SEARCHING;
    }

    finishArea() {
        this.currentPlot = null;
        this.searchFailures = 0;
        this.state = STATES.SEARCHING;
    }

    startParticleSearch() {
        if (!farmingSettings.selectVacuum()) return false;
        this.firstParticle = null;
        this.lastParticle = null;
        this.state = STATES.CAPTURING_PARTICLES;
        this.particleSearchEndsAt = Date.now() + PARTICLE_SEARCH_MS;
        Client.leftClick();
        return true;
    }

    onParticle(packet) {
        if (!this.running || this.state !== STATES.CAPTURING_PARTICLES) return;
        const particle = packet.getParticle?.();
        if ((particle?.getType?.() ?? particle) !== ANGRY_VILLAGER) return;

        const position = { x: packet.getX(), y: packet.getY(), z: packet.getZ() };
        if (!this.firstParticle) this.firstParticle = position;
        else this.lastParticle = position;
    }

    finishParticleCapture() {
        if (!this.lastParticle) return this.failParticleSearch();

        const dx = this.lastParticle.x - this.firstParticle.x;
        const dy = this.lastParticle.y - this.firstParticle.y;
        const dz = this.lastParticle.z - this.firstParticle.z;
        const length = Math.hypot(dx, dy, dz);
        if (!length) return this.failParticleSearch();

        const x = this.lastParticle.x + (dx / length) * 15;
        const z = this.lastParticle.z + (dz / length) * 15;
        this.state = STATES.PATHING_PARTICLES;
        this.startPath(this.verticalGoals(x, z), (success) => {
            this.state = STATES.SEARCHING;
            if (!success || !getLoadedPests().length) this.failParticleSearch();
        });
    }

    failParticleSearch() {
        this.state = STATES.SEARCHING;
        if (this.currentPlot === null) return;
        this.searchFailures++;
        if (this.searchFailures < MAX_SEARCH_FAILURES) return;

        this.macro.message(`&eSkipping pest plot ${this.currentPlot} after ${MAX_SEARCH_FAILURES} failed searches.`);
        this.currentPlot = null;
        this.searchFailures = 0;
    }

    startPath(goals, onComplete) {
        const token = ++this.pathToken;
        Pathfinder.resetPath();
        if (!goals.length) return onComplete(false);
        Pathfinder.findPath(
            goals,
            (success) => {
                if (this.running && token === this.pathToken) onComplete(success);
            },
            true
        );
    }

    stopPath() {
        this.pathToken++;
        if (Pathfinder.isPathing()) Pathfinder.resetPath();
    }

    verticalGoals(x, z) {
        return Array.from({ length: 12 }, (_, y) => [Math.floor(x), y + 66, Math.floor(z)]);
    }

    distanceSq(entity) {
        const dx = entity.getX() - Player.getX();
        const dy = entity.getY() - Player.getY();
        const dz = entity.getZ() - Player.getZ();
        return dx * dx + dy * dy + dz * dz;
    }

    id(entity) {
        return entity.getUUID().toString();
    }

    stop() {
        if (!this.running) return;
        this.running = false;
        this.stopPath();
        Rotations.stop();
        Client.unpressKeys();
        farmingSettings.restoreSlot();
    }
}

export const pestKiller = new PestKiller();
