import { ZombieEntity, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import Render from '../../utils/render/Render';

const RAT_WIDTH = 0.3;
const RAT_HEIGHT = 0.975;
const EPSILON = 0.01;
const WORLD_TICK_MS = 50;

function approxEqual(a, b, epsilon = EPSILON) {
    return Math.abs(a - b) <= epsilon;
}

export function isRatEntity(entity) {
    if (!entity) return false;
    if (entity.isDead()) return false;
    return approxEqual(entity.getWidth(), RAT_WIDTH) && approxEqual(entity.getHeight(), RAT_HEIGHT);
}

export function isRawRatEntity(entity) {
    if (!entity) return false;
    return approxEqual(entity.getWidth(), RAT_WIDTH) && approxEqual(entity.getHeight(), RAT_HEIGHT);
}

export function getRatId(entity) {
    if (!entity) return null;
    return entity.getUUID().toString();
}

export function getHubRats() {
    if (!World.isLoaded() || Utils.area() !== 'Hub') return [];
    return getRawHubRats().filter((entity) => isRatEntity(entity));
}

export function getRawHubRats() {
    if (!World.isLoaded() || Utils.area() !== 'Hub') return [];
    return World.getAllEntitiesOfType(ZombieEntity).filter((entity) => isRawRatEntity(entity));
}

class RatESP extends ModuleBase {
    constructor() {
        super({
            name: 'Rat ESP',
            subcategory: 'Visuals',
            description: 'Highlights Hub rats.',
            tooltip: 'Highlights Hub rats.',
        });

        this.rats = [];
        this.lastWorldTickAt = 0;
        this.fillColor = Render.Color(255, 255, 0, 80);
        this.outlineColor = Render.Color(255, 255, 0, 255);
        this.tracerColor = Render.Color(255, 255, 0, 255);

        this.on('tick', () => {
            this.lastWorldTickAt = Date.now();
        });
        this.on('tick', () => this.scanRats());

        this.when(
            () => this.enabled && World.isLoaded() && Utils.area() === 'Hub' && this.rats.length > 0,
            'postRenderWorld',
            () => this.renderRats()
        );

        this.on('worldUnload', () => {
            this.rats = [];
            this.lastWorldTickAt = 0;
        });
    }

    scanRats() {
        if (!this.enabled || !World.isLoaded() || Utils.area() !== 'Hub') {
            this.rats = [];
            return;
        }

        this.rats = getHubRats();
    }

    renderRats() {
        this.rats = this.rats.filter((entity) => entity && !entity.isDead());

        this.rats.forEach((entity) => {
            const position = this.getInterpolatedHeadPosition(entity);
            if (!position) return;

            const cubeSize = 0.7;
            const cubePos = new Vec3d(position.x, position.y, position.z);
            const cubeCenter = new Vec3d(position.x, position.y, position.z);

            Render.drawSizedBox(cubePos, cubeSize, cubeSize, cubeSize, this.fillColor, true, 4, false);
            Render.drawTracer(cubeCenter, this.tracerColor, 2, false);
        });
    }

    getInterpolatedHeadPosition(entity) {
        if (!entity) return null;

        const alpha = this.getFrameInterpolationAlpha();
        const lerp = (start, end) => start + (end - start) * alpha;
        return {
            x: lerp(entity.getLastX(), entity.getX()),
            y: lerp(entity.getLastY(), entity.getY()),
            z: lerp(entity.getLastZ(), entity.getZ()),
        };
    }

    getFrameInterpolationAlpha() {
        if (this.lastWorldTickAt <= 0) return 1;
        return Math.max(0, Math.min(1, (Date.now() - this.lastWorldTickAt) / WORLD_TICK_MS));
    }

    onDisable() {
        this.rats = [];
        this.lastWorldTickAt = 0;
    }
}

new RatESP();
