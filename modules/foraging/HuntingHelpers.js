import { ArmorStandEntity } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { pestLasso } from '../farming/PestLasso';

function componentText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
        if (typeof value.getString === 'function') return value.getString();
    } catch (e) {}
    return String(value);
}

function stripName(value) {
    return ChatLib.removeFormatting(componentText(value))
        .replace(/\u00A7[0-9A-FK-OR]/gi, '')
        .replace(/&[0-9A-FK-OR]/gi, '')
        .trim();
}

function getEntityDisplayName(entity) {
    if (!entity) return '';
    const names = [];
    const push = (value) => {
        const text = stripName(value);
        if (text) names.push(text);
    };
    try {
        push(entity.getName?.());
    } catch (e) {}
    try {
        const mc = entity.toMC?.();
        if (mc) {
            push(mc.getCustomName?.());
            push(mc.getDisplayName?.());
            push(mc.getName?.());
        }
    } catch (e) {}
    return names.find((name) => !/^armor stand$/i.test(name)) || names[0] || '';
}

function isReelPrompt(entity) {
    return /^reel[!?.]*$/i.test(getEntityDisplayName(entity));
}

class HuntingHelper extends ModuleBase {
    constructor() {
        super({
            name: 'Hunting Helpers',
            subcategory: 'Foraging',
            description: 'Random features to help with hunting',
            tooltip: 'Manual use',
        });

        this.autoLassoReel = false;
        this.reeledArmorStands = new Set();
        this.reelSeenTicks = 0;
        this.reelStandId = null;

        this.on('tick', () => {
            if (!this.autoLassoReel) return;
            if (pestLasso.enabled || pestLasso.taskMode) return;
            if (!/lasso/i.test(stripName(Player.getHeldItem()?.getName?.()))) {
                this.reelSeenTicks = 0;
                this.reelStandId = null;
                return;
            }

            let reelStand = null;
            const stands = World.getAllEntitiesOfType(ArmorStandEntity);
            if (stands) {
                for (const entity of stands) {
                    if (!isReelPrompt(entity)) continue;
                    reelStand = entity;
                    break;
                }
            }

            const reelId = reelStand?.getUUID?.()?.toString?.() || null;
            if (!reelStand || !reelId || this.reeledArmorStands.has(reelId)) {
                this.reelSeenTicks = 0;
                this.reelStandId = null;
                return;
            }
            if (this.reelStandId !== reelId) {
                this.reelStandId = reelId;
                this.reelSeenTicks = 1;
                return;
            }
            this.reelSeenTicks++;
            if (this.reelSeenTicks < 3) return;
            Client.rightClick();
            this.reeledArmorStands.add(reelId);
            this.reelSeenTicks = 0;
            this.reelStandId = null;
        });

        this.addToggle('Auto Lasso Reel', (v) => {
            this.autoLassoReel = v;
            if (!v) {
                this.reeledArmorStands.clear();
                this.reelSeenTicks = 0;
                this.reelStandId = null;
            }
        });
    }

    onDisable() {
        this.reeledArmorStands.clear();
        this.reelSeenTicks = 0;
        this.reelStandId = null;
    }
}

new HuntingHelper();
