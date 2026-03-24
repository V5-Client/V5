import { ArmorStandEntity, Vec3d } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { Guis } from '../../utils/player/Inventory';
import Render from '../../utils/render/Render';

const COOKIE_SLOT = 13;
const MAX_TRACKED_EGGS = 6;
const EGG_MESSAGE_REGEX = /.*\b(A|found|collected)\b.+Chocolate (Breakfast|Lunch|Dinner|Brunch|Déjeuner|Supper).*/i;
const PROFILE_TYPE = net.minecraft.component.DataComponentTypes.PROFILE;

const EGG_TYPES = [
    {
        key: 'Breakfast',
        renderName: 'Breakfast Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY3MzE0OSwKICAicHJvZmlsZUlkIiA6ICJiN2I4ZTlhZjEwZGE0NjFmOTY2YTQxM2RmOWJiM2U4OCIsCiAgInByb2ZpbGVOYW1lIiA6ICJBbmFiYW5hbmFZZzciLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYTQ5MzMzZDg1YjhhMzE1ZDAzMzZlYjJkZjM3ZDhhNzE0Y2EyNGM1MWI4YzYwNzRmMWI1YjkyN2RlYjUxNmMyNCIKICAgIH0KICB9Cn0',
        color: {
            line: Render.Color(255, 170, 0, 255),
            fill: Render.Color(255, 170, 0, 80),
        },
    },
    {
        key: 'Lunch',
        renderName: 'Lunch Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjU2ODExMiwKICAicHJvZmlsZUlkIiA6ICI3NzUwYzFhNTM5M2Q0ZWQ0Yjc2NmQ4ZGUwOWY4MjU0NiIsCiAgInByb2ZpbGVOYW1lIiA6ICJSZWVkcmVsIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzdhZTZkMmQzMWQ4MTY3YmNhZjk1MjkzYjY4YTRhY2Q4NzJkNjZlNzUxZGI1YTM0ZjJjYmM2NzY2YTAzNTZkMGEiCiAgICB9CiAgfQp9',
        color: {
            line: Render.Color(85, 85, 255, 255),
            fill: Render.Color(85, 85, 255, 80),
        },
    },
    {
        key: 'Dinner',
        renderName: 'Dinner Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY0OTcwMSwKICAicHJvZmlsZUlkIiA6ICI3NGEwMzQxNWY1OTI0ZTA4YjMyMGM2MmU1NGE3ZjJhYiIsCiAgInByb2ZpbGVOYW1lIiA6ICJNZXp6aXIiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvZTVlMzYxNjU4MTlmZDI4NTBmOTg1NTJlZGNkNzYzZmY5ODYzMTMxMTkyODNjMTI2YWNlMGM0Y2M0OTVlNzZhOCIKICAgIH0KICB9Cn0',
        color: {
            line: Render.Color(85, 255, 85, 255),
            fill: Render.Color(85, 255, 85, 80),
        },
    },
    {
        key: 'Brunch',
        renderName: 'Brunch Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY3MzE0OSwKICAicHJvZmlsZUlkIiA6ICJiN2I4ZTlhZjEwZGE0NjFmOTY2YTQxM2RmOWJiM2U4OCIsCiAgInByb2ZpbGVOYW1lIiA6ICJBbmFiYW5hbmFZZzciLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYTQ5MzMzZDg1YjhhMzE1ZDAzMzZlYjJkZjM3ZDhhNzE0Y2EyNGM1MWI4YzYwNzRmMWI1YjkyN2RlYjUxNmMyNCIKICAgIH0KICB9Cn0',
        color: {
            line: Render.Color(255, 170, 0, 255),
            fill: Render.Color(255, 170, 0, 80),
        },
    },
    {
        key: 'Déjeuner',
        renderName: 'Déjeuner Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjU2ODExMiwKICAicHJvZmlsZUlkIiA6ICI3NzUwYzFhNTM5M2Q0ZWQ0Yjc2NmQ4ZGUwOWY4MjU0NiIsCiAgInByb2ZpbGVOYW1lIiA6ICJSZWVkcmVsIiwKICAic2lnbmF0dXJlUmVxdWlyZWQiIDogdHJ1ZSwKICAidGV4dHVyZXMiIDogewogICAgIlNLSU4iIDogewogICAgICAidXJsIiA6ICJodHRwOi8vdGV4dHVyZXMubWluZWNyYWZ0Lm5ldC90ZXh0dXJlLzdhZTZkMmQzMWQ4MTY3YmNhZjk1MjkzYjY4YTRhY2Q4NzJkNjZlNzUxZGI1YTM0ZjJjYmM2NzY2YTAzNTZkMGEiCiAgICB9CiAgfQp9',
        color: {
            line: Render.Color(85, 85, 255, 255),
            fill: Render.Color(85, 85, 255, 80),
        },
    },
    {
        key: 'Supper',
        renderName: 'Supper Egg',
        texture:
            'ewogICJ0aW1lc3RhbXAiIDogMTcxMTQ2MjY0OTcwMSwKICAicHJvZmlsZUlkIiA6ICI3NGEwMzQxNWY1OTI0ZTA4YjMyMGM2MmU1NGE3ZjJhYiIsCiAgInByb2ZpbGVOYW1lIiA6ICJNZXp6aXIiLAogICJzaWduYXR1cmVSZXF1aXJlZCIgOiB0cnVlLAogICJ0ZXh0dXJlcyIgOiB7CiAgICAiU0tJTiIgOiB7CiAgICAgICJ1cmwiIDogImh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvZTVlMzYxNjU4MTlmZDI4NTBmOTg1NTJlZGNkNzYzZmY5ODYzMTMxMTkyODNjMTI2YWNlMGM0Y2M0OTVlNzZhOCIKICAgIH0KICB9Cn0',
        color: {
            line: Render.Color(85, 255, 85, 255),
            fill: Render.Color(85, 255, 85, 80),
        },
    },
];

class ChocolateFactory extends ModuleBase {
    constructor() {
        super({
            name: 'Chocolate Factory',
            subcategory: 'Skills',
            description: 'Automates cookie clicking, stray claims, and egg tracking in Chocolate Factory.',
            tooltip: 'Chocolate Factory automation + egg ESP.',
        });

        this.clickFactory = false;
        this.actionDelayMs = 150;
        this.claimStrays = false;
        this.cancelSound = false;
        this.eggEsp = false;

        this.lastActionAt = 0;
        this.detectedEggs = new Map();

        this.setTheme('#8f5a2b');

        this.addToggle('Auto Click', (value) => (this.clickFactory = !!value), 'Right clicks the chocolate cookie while the factory menu is open.', false);
        this.addToggle('Auto Claim Strays', (value) => (this.claimStrays = !!value), 'Claims stray rabbits in the Chocolate Factory menu.', false);
        this.addSlider(
            'Action Delay (ms)',
            50,
            1500,
            this.actionDelayMs,
            (value) => (this.actionDelayMs = Number(value)),
            'Delay between cookie clicks and stray claims.'
        );
        this.addToggle('Cancel Sound', (value) => (this.cancelSound = !!value), 'Cancels the click sound while the factory menu is open.', false);
        this.addToggle('Egg ESP', (value) => (this.eggEsp = !!value), 'Tracks and renders chocolate eggs.', false);

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
        if (Guis.guiName() !== 'Chocolate Factory') return;

        const now = Date.now();
        if ((this.clickFactory || this.claimStrays) && now - this.lastActionAt >= this.actionDelayMs) {
            this.performFactoryActions(container);
            this.lastActionAt = now;
        }
    }

    performFactoryActions(container) {
        if (this.clickFactory) {
            Guis.clickSlot(COOKIE_SLOT, false, 'RIGHT');
        }

        if (!this.claimStrays) return;

        const items = container.getItems();
        if (!items) return;

        for (let slot = 0; slot < items.length; slot++) {
            const item = items[slot];
            const name = ChatLib.removeFormatting(`${item?.getName?.()}`).trim();
            if (!name) continue;

            if (name.includes('CLICK ME!') || name.includes('Golden Rabbit')) {
                Guis.clickSlot(slot, false, 'LEFT');
                return;
            }
        }
    }

    scanEggs() {
        if (!this.enabled || !this.eggEsp || !World.isLoaded()) {
            this.resetState();
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
            const profileString = profileComponent?.getGameProfile?.()?.toString?.() || '';
            if (!profileString) return null;

            return EGG_TYPES.find((egg) => profileString.includes(egg.texture)) || null;
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return null;
        }
    }

    renderEggs() {
        this.detectedEggs.forEach((egg) => {
            if (!egg || egg.isFound || !egg.entity || egg.entity.isDead()) return;

            const x = egg.entity.getX();
            const y = egg.entity.getY();
            const z = egg.entity.getZ();
            const textPos = new Vec3d(x, y + 1.8, z);
            const tracerPos = new Vec3d(x, y + 1.4, z);
            const boxPos = new Vec3d(x - 0.25, y + 1.15, z - 0.25);

            Render.drawSizedBox(boxPos, 0.5, 0.5, 0.5, egg.color.fill, true, 2, false);
            Render.drawTracer(tracerPos, egg.color.line, 2, false);
            Render.drawText(egg.renderName, textPos, 1, false, true, false, true);
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
        let closestDistance = Infinity;

        this.detectedEggs.forEach((egg) => {
            if (!egg || egg.isFound || !egg.entity) return;
            if (`${egg.eggType}`.toLowerCase() !== targetType) return;

            const distance = Math.hypot(player.getX() - egg.entity.getX(), player.getY() - egg.entity.getY(), player.getZ() - egg.entity.getZ());
            if (distance < closestDistance) {
                closest = egg;
                closestDistance = distance;
            }
        });

        if (!closest) {
            this.detectedEggs.forEach((egg) => {
                if (!egg || egg.isFound || !egg.entity) return;

                const distance = Math.hypot(player.getX() - egg.entity.getX(), player.getY() - egg.entity.getY(), player.getZ() - egg.entity.getZ());
                if (distance < closestDistance) {
                    closest = egg;
                    closestDistance = distance;
                }
            });
        }

        if (closest) {
            closest.isFound = true;
        }
    }

    onSoundPlay(_pos, name, _volume, _pitch, _category, event) {
        if (Guis.guiName() !== 'Chocolate Factory' || !name) return;
        if (!this.cancelSound) return;

        const soundName = `${name}`.toLowerCase();
        if (soundName !== 'minecraft:block.note_block.bit') return;
        if (event) cancel(event);
    }
}

new ChocolateFactory();
