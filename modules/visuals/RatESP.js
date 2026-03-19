import { ArmorStandEntity, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Utils } from '../../utils/Utils';
import Render from '../../utils/render/Render';

const RAT_TEXTURE =
    'ewogICJ0aW1lc3RhbXAiIDogMTYxODQxOTcwMTc1MywKICAicHJvZmlsZUlkIiA6ICI3MzgyZGRmYmU0ODU0NTVjODI1ZjkwMGY4OGZkMzJmOCIsCiAgInByb2ZpbGVOYW1lIiA6ICJCdUlJZXQiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYThhYmI0NzFkYjBhYjc4NzAzMDExOTc5ZGM4YjQwNzk4YTk0MWYzYTRkZWMzZWM2MWNiZWVjMmFmOGNmZmU4IiwKICAgICAgIm1ldGFkYXRhIiA6IHsKICAgICAgICAibW9kZWwiIDogInNsaW0iCiAgICAgIH0KICAgIH0KICB9Cn0=';
const WORLD_TICK_MS = 50;

export function isRatHead(item) {
    const mcItem = item?.toMC?.();
    if (!mcItem) return false;

    const profileType = net.minecraft.component.DataComponentTypes.PROFILE;
    const profileComponent = mcItem.get(profileType);
    const profileString = profileComponent?.getGameProfile?.()?.toString() || '';

    return profileString.includes(RAT_TEXTURE);
}

export function isRatEntity(entity) {
    if (!entity) return false;
    if (entity.isDead()) return false;
    return isRatHead(entity.getStackInSlot(5));
}

export function isRawRatEntity(entity) {
    if (!entity) return false;
    return isRatHead(entity.getStackInSlot(5));
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
    return World.getAllEntitiesOfType(ArmorStandEntity).filter((entity) => isRawRatEntity(entity));
}

class RatESP extends ModuleBase {
    constructor() {
        super({
            name: 'Rat ESP',
            subcategory: 'Visuals',
            description: 'Highlights Hub rats using their skull profile texture.',
            tooltip: 'Highlights Hub rats using their skull profile texture.',
        });

        this.rats = [];
        this.lastWorldTickAt = 0;
        this.fillColor = Render.Color(255, 255, 0, 80);
        this.outlineColor = Render.Color(255, 255, 0, 255);
        this.tracerColor = Render.Color(255, 255, 0, 255);

        this.on('tick', () => {
            this.lastWorldTickAt = Date.now();
        });
        this.on('step', () => this.scanRats()).setFps(5);

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
            const cubePos = new Vec3d(position.x, position.y + 1.4, position.z);
            const cubeCenter = new Vec3d(position.x, position.y + 1.75, position.z);

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
