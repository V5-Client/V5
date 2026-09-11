import { ClientboundLevelParticlesPacket } from '../../../utils/Packets';
import Pathfinder from '../../../utils/pathfinder/PathFinder';
import { MiningEngine, MiningRotations } from '../../../utils/MiningEngine';
import { TabListUtils } from '../../../utils/TabListUtils';
import { getLoadedPests } from '../../visuals/PestESP';
import { farmingSettings } from '../FarmingSettings';
import { loadoutHandler } from '../LoadoutHandler';
import { pestLasso } from '../PestLasso';
import { Utils } from '../../../utils/Utils';
import { manager } from '../../../utils/SkyblockEvents';

const ANGRY_VILLAGER = net.minecraft.core.particles.ParticleTypes.ANGRY_VILLAGER;
const PEST_RANGE_SQ = 12.5 ** 2;
const PARTICLE_SEARCH_MS = 1_000;
const PLOT_TIMEOUT_MS = 30_000;
const STATES = {
    SEARCHING: 'Searching',
    PATHING_PESTS: 'Pathing to pests',
    KILLING: 'Killing pest',
    LASSOING: 'Lassoing pest',
    WAITING_FOR_PLOT: 'Waiting for plot',
    CAPTURING_PARTICLES: 'Capturing particles',
    PATHING_PARTICLES: 'Pathing to particles',
    PATHING_FORWARD: 'Pathing forward',
};

class PestKiller {
    constructor() {
        register('packetReceived', (packet) => this.onParticle(packet)).setFilteredClass(ClientboundLevelParticlesPacket);
        manager.subscribe('plotteleport', () => this.onTeleport());
    }

    start() {
        this.running = true;
        this.state = STATES.SEARCHING;
        this.currentPlot = null;
        this.teleportedToPlot = false;
        this.visitedPlots = new Set();
        this.pathToken = 0;
        this.lassoId = null;
        this.vacuumPests = new Set();
        farmingSettings.originalSlot = Player.getHeldItemIndex();
    }

    tick() {
        if (!this.running) return true;
        const { gardenPests, currentPlot, currentPlotPests } = Utils.getGardenPestStatus();
        if (gardenPests === 0 || !gardenPests) {
            this.stopPath();
            this.stopKilling();
            this.stopLasso();
            if (!loadoutHandler.select(loadoutHandler.farmingSlot)) return false;
            farmingSettings.restoreSlot();
            this.stop();
            return true;
        }
        if (!loadoutHandler.select(loadoutHandler.pestKillingSlot)) {
            Client.unpressKeys();
            return false;
        }

        if (currentPlot === this.currentPlot && currentPlotPests === 0) {
            this.completeCurrentPlot();
            return false;
        }
        if (this.state === STATES.WAITING_FOR_PLOT) {
            if (!this.teleportedToPlot) return false;
            this.state = STATES.PATHING_FORWARD;
            return false;
        }
        if (!this.currentPlot) {
            this.findNewPlot();
            return false;
        }
        if (
            Date.now() >= this.plotTimeoutAt &&
            this.state !== STATES.LASSOING &&
            this.state !== STATES.KILLING &&
            this.state !== STATES.WAITING_FOR_PLOT
        ) {
            if (getLoadedPests().length) this.plotTimeoutAt = Date.now() + PLOT_TIMEOUT_MS;
            else {
                this.completeCurrentPlot();
                return false;
            }
        }

        const pests = getLoadedPests();
        const nearbyPest = pests.find((pest) => this.distanceSq(pest) <= PEST_RANGE_SQ);
        if (this.state === STATES.LASSOING) return this.lasso(nearbyPest);
        if (this.state === STATES.KILLING) {
            if (!nearbyPest) {
                this.stopKilling();
                return false;
            }
            return this.kill(nearbyPest);
        }

        if (!pests.length && this.state === STATES.SEARCHING) {
            if (Client.isKeyDown('shift')) return;
            return this.startParticleSearch();
        }

        if (pests.length) {
            this.particleSearchGrace = Date.now() + 1000;
            if (nearbyPest) {
                if (!pestLasso.useInPestKiller || this.shouldVacuum(nearbyPest)) return this.kill(nearbyPest);
                return this.lasso(nearbyPest);
            }
            if (this.state !== STATES.PATHING_PESTS || this.hasPestsChanged(pests)) this.pathToPests(pests);
            return false;
        }

        switch (this.state) {
            case STATES.PATHING_FORWARD:
                if (!Pathfinder.isPathing()) this.pathToForward();
                return false;
            case STATES.PATHING_PESTS:
                this.stopPath();
                if (Client.isKeyDown('shift')) return;
                return this.startParticleSearch();
            case STATES.PATHING_PARTICLES:
                return false;
            case STATES.CAPTURING_PARTICLES:
                if (Date.now() >= this.particleSearchEndsAt) this.finishParticleCapture();
                return false;
        }

        return false;
    }

    findNewPlot() {
        const { infestedPlots } = TabListUtils.readPests();
        let plot = infestedPlots.find((candidate) => !this.visitedPlots.has(candidate));
        if (!plot && infestedPlots.length) {
            this.visitedPlots.clear();
            plot = infestedPlots[0];
        }
        if (!plot) return;
        const standing = Utils.getGardenPestStatus().currentPlot;
        this.currentPlot = plot;
        this.visitedPlots.add(plot);
        this.plotTimeoutAt = Date.now() + PLOT_TIMEOUT_MS;
        if (standing === plot) {
            this.teleportedToPlot = true;
            this.state = STATES.SEARCHING;
            return;
        }
        this.teleportedToPlot = false;
        ChatLib.command(`tptoplot ${plot}`);
        this.state = STATES.WAITING_FOR_PLOT;
    }

    pathToPests(pests) {
        this.stopKilling();
        this.state = STATES.PATHING_PESTS;
        this.pathPestPositions = new Map();
        const goals = [];
        pests.forEach((pest) => {
            this.pathPestPositions.set(this.id(pest), { x: pest.getX(), y: pest.getY(), z: pest.getZ() });
            goals.push(...this.verticalGoals(pest.getX(), pest.getZ()));
        });
        this.startPath(goals, (success) => {
            this.state = STATES.SEARCHING;
        });
    }

    onTeleport() {
        if (!this.running || this.currentPlot === null) return;
        this.teleportedToPlot = true;
    }

    pathToForward() {
        const yaw = (Number(Player.getYaw()) * Math.PI) / 180;
        const x = Player.getX() - Math.sin(yaw) * 64;
        const z = Player.getZ() + Math.cos(yaw) * 64;
        this.state = STATES.PATHING_FORWARD;
        this.startPath([[Math.floor(x), 80, Math.floor(z)]], (success) => {
            this.state = STATES.SEARCHING;
        });
    }

    hasPestsChanged(pests) {
        if (pests.length !== this.pathPestPositions?.size) return true;
        return pests.some((pest) => {
            const start = this.pathPestPositions?.get(this.id(pest));
            if (!start) return true;
            const dx = pest.getX() - start.x;
            const dy = pest.getY() - start.y;
            const dz = pest.getZ() - start.z;
            return dx * dx + dy * dy + dz * dz > 4 ** 2;
        });
    }

    shouldVacuum(pest) {
        if (!pest) return false;
        return pestLasso.isExcludedPest(pest) || this.vacuumPests.has(this.id(pest));
    }

    lasso(pest) {
        if (this.shouldVacuum(pest)) return this.kill(pest);
        this.stopPath();
        this.stopKilling();
        this.state = STATES.LASSOING;
        this.plotTimeoutAt = Date.now() + PLOT_TIMEOUT_MS;
        if (pest && this.lassoId !== this.id(pest)) {
            pestLasso.start(pest);
            this.lassoId = this.id(pest);
        }
        const target = pest && !pest.isDead() ? pest : pestLasso.pest;
        if (!pestLasso.tick()) return false;
        const failed = pestLasso.lastResult === 'failed';
        this.stopLasso();
        if (failed && target && !target.isDead()) {
            this.vacuumPests.add(this.id(target));
            return this.kill(target);
        }
        this.state = STATES.SEARCHING;
        return false;
    }

    kill(pest) {
        this.stopPath();
        this.stopLasso();
        this.state = STATES.KILLING;
        this.plotTimeoutAt = Date.now() + PLOT_TIMEOUT_MS;
        Client.unpressKeys();
        if (!farmingSettings.selectVacuum()) return false;
        MiningRotations.trackEntity(pest, MiningEngine.rotationSpeed);
        Client.setKey('rightclick', true);
        return false;
    }

    stopKilling() {
        if (this.state !== STATES.KILLING) return;
        MiningRotations.stop();
        Client.unpressKeys();
        this.state = STATES.SEARCHING;
    }

    stopLasso() {
        this.lassoId = null;
        pestLasso.stop();
        if (this.state === STATES.LASSOING) this.state = STATES.SEARCHING;
    }

    finishArea() {
        this.currentPlot = null;
        this.teleportedToPlot = false;
        this.vacuumPests = new Set();
        this.state = STATES.SEARCHING;
    }

    completeCurrentPlot() {
        this.stopPath();
        this.stopKilling();
        this.stopLasso();
        this.finishArea();
    }

    startParticleSearch() {
        if (this.particleSearchGrace >= Date.now()) return false;
        if (!farmingSettings.selectVacuum()) return false;
        this.firstParticle = null;
        this.lastParticle = null;
        this.state = STATES.CAPTURING_PARTICLES;
        this.particleSearchGrace = Date.now() + 3000;
        this.particleSearchEndsAt = Date.now() + PARTICLE_SEARCH_MS;
        Client.leftClick();
        return false;
    }

    onParticle(packet) {
        if (!this.running || this.state !== STATES.CAPTURING_PARTICLES) return;
        const particle = packet.getParticle?.();
        const type = particle?.getType?.() ?? particle;
        const position = { x: packet.getX(), y: packet.getY(), z: packet.getZ() };
        const isAngryVillager = type === ANGRY_VILLAGER;
        if (!isAngryVillager) return;

        if (!this.firstParticle) this.firstParticle = position;
        else this.lastParticle = position;
    }

    finishParticleCapture() {
        if (!this.lastParticle) return (this.state = STATES.SEARCHING);

        const dx = this.lastParticle.x - this.firstParticle.x;
        const dy = this.lastParticle.y - this.firstParticle.y;
        const dz = this.lastParticle.z - this.firstParticle.z;
        const length = Math.hypot(dx, dy, dz);
        if (!length) return (this.state = STATES.SEARCHING);

        const x = this.lastParticle.x + (dx / length) * 40;
        const z = this.lastParticle.z + (dz / length) * 40;
        this.state = STATES.PATHING_PARTICLES;
        this.startPath(this.verticalGoals(x, z), () => {
            this.state = STATES.SEARCHING;
        });
    }

    startPath(goals, onComplete) {
        const token = ++this.pathToken;
        Pathfinder.resetPath(false);
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
        const goals = [];
        for (let y = 66; y < 78; y++) goals.push([Math.floor(x), y, Math.floor(z)]);
        return goals;
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
        this.stopLasso();
        MiningRotations.stop();
        Client.unpressKeys();
        farmingSettings.restoreSlot();
    }
}

export const pestKiller = new PestKiller();
