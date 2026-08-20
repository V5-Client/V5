import { ArmorStandEntity, Vec3d } from '../../utils/Constants';
import { fastDistance } from '../../utils/Math';
import { ModuleBase } from '../../utils/ModuleBase';
import { clickSlot, getGuiName } from '../../utils/player/Inventory';

const COOKIE_SLOT = 13;
const MAX_TRACKED_EGGS = 6;
const EGG_MESSAGE_REGEX = /.*\b(A|found|collected)\b.+Chocolate (Breakfast|Lunch|Dinner|Brunch|Déjeuner|Supper).*/i;
const PROFILE_TYPE = net.minecraft.core.component.DataComponents.PROFILE;

const EGG_TYPES = [
    {
        key: 'Breakfast',
        renderName: 'Breakfast Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY3MzE0OSwKICAicHJvZmlsZUlkIiA6ICJiN2I4ZTlhZjEwZGE0NjFmOTY2YTQxM2RmOWJiM2U4OCIsCiAgInByb2ZpbGVOYW1lIiA6ICJBbmFiYW5hbmFZZzciLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYTQ5MzMzZDg1YjhhMzE1ZDAzMzZlYjJkZjM3ZDhhNzE0Y2EyNGM1MWI4YzYwNzRmMWI1YjkyN2RlYjUxNmMyNCIKICAgIH0KICB9Cn0',
        color: {
            line: new RenderColor(255, 170, 0, 255),
            fill: new RenderColor(255, 170, 0, 80),
        },
    },
    {
        key: 'Lunch',
        renderName: 'Lunch Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjU2ODExMiwKICAicHJvZmlsZUlkIiA6ICI3NzUwYzFhNTM5M2Q0ZWQ0Yjc2NmQ4ZGUwOWY4MjU0NiIsCiAgInByb2ZpbGVOYW1lIiA6ICJSZWVkcmVsIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzdhZTZkMmQzMWQ4MTY3YmNhZjk1MjkzYjY4YTRhY2Q4NzJkNjZlNzUxZGI1YTM0ZjJjYmM2NzY2YTAzNTZkMGEiCiAgICB9CiAgfQp9',
        color: {
            line: new RenderColor(85, 85, 255, 255),
            fill: new RenderColor(85, 85, 255, 80),
        },
    },
    {
        key: 'Dinner',
        renderName: 'Dinner Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY0OTcwMSwKICAicHJvZmlsZUlkIiA6ICI3NGEwMzQxNWY1OTI0ZTA4YjMyMGM2MmU1NGE3ZjJhYiIsCiAgInByb2ZpbGVOYW1lIiA6ICJNZXp6aXIiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvZTVlMzYxNjU4MTlmZDI4NTBmOTg1NTJlZGNkNzYzZmY5ODYzMTMxMTkyODNjMTI2YWNlMGM0Y2M0OTVlNzZhOCIKICAgIH0KICB9Cn0',
        color: {
            line: new RenderColor(85, 255, 85, 255),
            fill: new RenderColor(85, 255, 85, 80),
        },
    },
    {
        key: 'Brunch',
        renderName: 'Brunch Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY3MzE0OSwKICAicHJvZmlsZUlkIiA6ICJiN2I4ZTlhZjEwZGE0NjFmOTY2YTQxM2RmOWJiM2U4OCIsCiAgInByb2ZpbGVOYW1lIiA6ICJBbmFiYW5hbmFZZzciLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYTQ5MzMzZDg1YjhhMzE1ZDAzMzZlYjJkZjM3ZDhhNzE0Y2EyNGM1MWI4YzYwNzRmMWI1YjkyN2RlYjUxNmMyNCIKICAgIH0KICB9Cn0',
        color: {
            line: new RenderColor(255, 170, 0, 255),
            fill: new RenderColor(255, 170, 0, 80),
        },
    },
    {
        key: 'Déjeuner',
        renderName: 'Déjeuner Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjU2ODExMiwKICAicHJvZmlsZUlkIiA6ICI3NzUwYzFhNTM5M2Q0ZWQ0Yjc2NmQ4ZGUwOWY4MjU0NiIsCiAgInByb2ZpbGVOYW1lIiA6ICJSZWVkcmVsIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzdhZTZkMmQzMWQ4MTY3YmNhZjk1MjkzYjY4YTRhY2Q4NzJkNjZlNzUxZGI1YTM0ZjJjYmM2NzY2YTAzNTZkMGEiCiAgICB9CiAgfQp9',
        color: {
            line: new RenderColor(85, 85, 255, 255),
            fill: new RenderColor(85, 85, 255, 80),
        },
    },
    {
        key: 'Supper',
        renderName: 'Supper Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY0OTcwMSwKICAicHJvZmlsZUlkIiA6ICI3NGEwMzQxNWY1OTI0ZTA4YjMyMGM2MmU1NGE3ZjJhYiIsCiAgInByb2ZpbGVOYW1lIiA6ICJNZXp6aXIiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvZTVlMzYxNjU4MTlmZDI4NTBmOTg1NTJlZGNkNzYzZmY5ODYzMTMxMTkyODNjMTI2YWNlMGM0Y2M0OTVlNzZhOCIKICAgIH0KICB9Cn0',
        color: {
            line: new RenderColor(85, 255, 85, 255),
            fill: new RenderColor(85, 255, 85, 80),
        },
    },
];

class ChocolateFactory extends ModuleBase {
    constructor() {
        super({
            name: 'modules.chocolate_factory.name',
            subcategory: 'Skills',
            description: 'modules.chocolate_factory.description',
            tooltip: 'modules.chocolate_factory.tooltip',
            theme: '#8f5a2b',
        });

        this.clickFactory = false;
        this.actionDelayMs = 150;
        this.claimStrays = false;
        this.cancelSound = false;
        this.eggEsp = false;

        this.lastActionAt = 0;
        this.detectedEggs = new Map();

        this.addToggle('labels.auto_click', (value) => (this.clickFactory = !!value), 'descriptions.auto_click', false);
        this.addToggle('labels.auto_claim_strays', (value) => (this.claimStrays = !!value), 'descriptions.auto_claim_strays', false);
        this.addSlider(
            'labels.action_delay_ms',
            50,
            1500,
            this.actionDelayMs,
            (value) => (this.actionDelayMs = Number(value)),
            'descriptions.action_delay_chocolate_factory',
            'action_delay_chocolate_factory'
        );
        this.addToggle('labels.cancel_sound', (value) => (this.cancelSound = !!value), 'descriptions.cancel_sound', false);
        this.addToggle('labels.egg_esp', (value) => (this.eggEsp = !!value), 'descriptions.egg_esp', false);

        this.on('tick', () => this.onTick());
        this.on('step', () => this.scanEggs()).setDelay(5);
        this.on('chat', (event) => this.onChat(event));
        this.on('soundPlay', (...args) => this.onSoundPlay(...args));
        this.on('worldLoad', () => this.resetState());
        this.on('worldUnload', () => this.resetState());

        this.when(
            () => this.enabled && this.eggEsp && World.isLoaded() && this.detectedEggs.size > 0,
            'postRenderWorld',
            () => this.renderEggs()
        );
    }

    onEnable() {
        this.lastActionAt = 0;
        this.scanEggs();
    }

    onDisable() {
        this.resetState();
    }

    resetState() {
        this.lastActionAt = 0;
        this.detectedEggs.clear();
    }

    onTick() {
        const container = Player.getContainer();
        if (!container) return;
        if (getGuiName() !== 'Chocolate Factory') return;

        const now = Date.now();
        if ((this.clickFactory || this.claimStrays) && now - this.lastActionAt >= this.actionDelayMs) {
            this.performFactoryActions(container);
            this.lastActionAt = now;
        }
    }

    performFactoryActions(container) {
        if (this.clickFactory) {
            clickSlot(COOKIE_SLOT, false, 'RIGHT');
        }

        if (!this.claimStrays) return;

        const items = container.getItems();
        if (!items) return;

        for (let slot = 0; slot < items.length; slot++) {
            const item = items[slot];
            const name = ChatLib.removeFormatting(`${item?.getName?.()}`).trim();
            if (!name) continue;

            if (name.includes('CLICK ME!') || name.includes('Golden Rabbit')) {
                clickSlot(slot, false, 'LEFT');
                return;
            }
        }
    }

    scanEggs() {
        if (!this.enabled || !this.eggEsp || !World.isLoaded()) {
            this.detectedEggs.clear();
            return;
        }

        const nextEggs = new Map();
        const stands = World.getAllEntitiesOfType(ArmorStandEntity);

        for (const entity of stands) {
            if (!entity || entity.isDead()) continue;

            const eggType = this.getEggType(entity.getStackInSlot(5));
            if (!eggType) continue;

            const uuid = entity.getUUID()?.toString?.();
            if (!uuid) continue;

            const previous = this.detectedEggs.get(uuid);
            nextEggs.set(uuid, {
                uuid: uuid,
                entity: entity,
                eggType: eggType.key,
                renderName: eggType.renderName,
                color: eggType.color,
                isFound: previous?.isFound || false,
            });

            if (nextEggs.size >= MAX_TRACKED_EGGS) break;
        }

        this.detectedEggs = nextEggs;
    }

    getEggType(item) {
        try {
            const mcItem = item?.toMC?.();
            if (!mcItem) return null;

            const profileComponent = mcItem.get(PROFILE_TYPE);
            const profileString = profileComponent?.partialProfile?.()?.toString?.() || '';
            if (!profileString) return null;

            return EGG_TYPES.find((egg) => profileString.includes(egg.texture)) || null;
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    renderEggs() {
        this.detectedEggs.forEach((egg) => {
            if (!egg || egg.isFound || !egg.entity || egg.entity.isDead()) return;

            const x = egg.entity.getX();
            const y = egg.entity.getY();
            const z = egg.entity.getZ();
            const tracerPos = new Vec3d(x, y + 1.75, z);
            const boxPos = new Vec3d(x, y + 1.45, z);

            Render3D.drawSizedBox(boxPos, 0.6, 0.6, 0.6, egg.color.fill, true, 2, false);
            Render3D.drawTracer(tracerPos, egg.color.line, 2, false);
        });
    }

    onChat(event) {
        const message = event?.message?.getUnformattedText?.();
        if (!message) return;

        const match = `${message}`.match(EGG_MESSAGE_REGEX);
        if (!match) return;

        const action = `${match[1]}`.toLowerCase();
        if (action !== 'found' && action !== 'collected') return;

        this.markClosestEggFound(match[2]);
    }

    markClosestEggFound(eggTypeName) {
        const player = Player.getPlayer();
        if (!player || this.detectedEggs.size === 0) return;

        const targetType = `${eggTypeName}`.toLowerCase();
        let closest = null;
        let closestPriority = Infinity;
        let closestDistance = Infinity;

        this.detectedEggs.forEach((egg) => {
            if (!egg || egg.isFound || !egg.entity) return;

            const distance = fastDistance(player.getX(), player.getY(), player.getZ(), egg.entity.getX(), egg.entity.getY(), egg.entity.getZ());
            const priority = `${egg.eggType}`.toLowerCase() === targetType ? 0 : 1;
            if (priority < closestPriority || (priority === closestPriority && distance < closestDistance)) {
                closest = egg;
                closestPriority = priority;
                closestDistance = distance;
            }
        });

        if (closest) {
            closest.isFound = true;
        }
    }

    onSoundPlay(_pos, name, _volume, _pitch, _category, event) {
        if (getGuiName() !== 'Chocolate Factory' || !name) return;
        if (!this.cancelSound) return;

        const soundName = `${name}`.toLowerCase();
        if (soundName !== 'minecraft:block.note_block.bit') return;
        if (event) cancel(event);
    }
}

new ChocolateFactory();
