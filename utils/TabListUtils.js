const AREA_CACHE_MS = 1000;
const PICKAXE_ABILITY_CACHE_MS = 200;

let currentArea = 'unknown';
let areaLastChecked = 0;
let pickaxeAbility = '';
let pickaxeAbilityExpiresAt = 0;

export const stripTabFormatting = (text) => ChatLib.removeFormatting(String(text ?? ''));
export const getTabListNames = () => TabList.getNames() || [];

export function getArea() {
    const now = Date.now();
    if (now - areaLastChecked < AREA_CACHE_MS) return currentArea;

    areaLastChecked = now;
    currentArea = 'unknown';

    try {
        for (const line of getTabListNames()) {
            const [, area] = stripTabFormatting(line).split('Area:');
            if (area?.trim()) return (currentArea = area.trim());
        }
    } catch (error) {
        console.error(error);
    }

    return currentArea;
}

export function getPickaxeAbilityStatus() {
    const now = Date.now();
    if (now < pickaxeAbilityExpiresAt) return pickaxeAbility;

    const names = getTabListNames();
    pickaxeAbility = '';
    for (let i = 0; i < names.length - 1; i++) {
        const line = stripTabFormatting(names[i]?.getName?.() ?? names[i]).trim();
        if (!line.includes('Pickaxe Ability')) continue;
        pickaxeAbility = stripTabFormatting(names[i + 1]?.getName?.() ?? names[i + 1]).trim();
        break;
    }
    pickaxeAbilityExpiresAt = now + PICKAXE_ABILITY_CACHE_MS;
    return pickaxeAbility;
}

export function findTabListIndex(items, target, start = 0) {
    for (let i = start; i < items.length; i++) {
        if (stripTabFormatting(items[i]).trim() === target) return i;
    }
    return -1;
}

export function readCommissions() {
    try {
        const names = getTabListNames();
        const start = findTabListIndex(names, 'Commissions:');
        if (start === -1) return [];
        const powderIndex = findTabListIndex(names, 'Powders:', start + 1);
        const commissions = [];

        for (let i = start + 1; i < (powderIndex === -1 ? names.length : powderIndex); i++) {
            const [name, progressText = ''] = stripTabFormatting(names[i]).split(':');
            if (!name?.trim()) continue;
            const progress = progressText.includes('DONE') ? 1 : progressText.includes('%') ? Number.parseFloat(progressText.replace(/[ %]/g, '')) / 100 : NaN;
            if (Number.isFinite(progress)) commissions.push({ name: name.trim(), progress });
        }
        return commissions;
    } catch (error) {
        console.error(error);
        return [];
    }
}

export function readVisitors() {
    try {
        const names = getTabListNames();
        const start = names.findIndex((line) => stripTabFormatting(line?.getName?.() ?? line).includes('Visitors:'));
        if (start === -1) return [];

        const visitors = [];
        for (let i = start + 1; i < names.length && visitors.length < 5; i++) {
            const text = stripTabFormatting(names[i]?.getName?.() ?? names[i]).trim();
            if (!text || text.includes('Next Visitor')) break;
            const name = text.replace(/\s*NEW!$/i, '').trim();
            if (name) visitors.push(name);
        }
        return visitors.reverse();
    } catch (error) {
        console.error(error);
        return [];
    }
}

export function readPests() {
    try {
        const names = getTabListNames();
        const start = names.findIndex((line) => stripTabFormatting(line?.getName?.() ?? line).includes('Pests:'));
        if (start === -1) return { alivePestCount: 0, infestedPlots: [] };

        let alivePestCount = 0;
        let infestedPlots = [];
        for (let i = start + 1; i < names.length; i++) {
            const text = stripTabFormatting(names[i]?.getName?.() ?? names[i]).trim();
            if (text.includes('Pest Traps:')) break;
            const alive = text.match(/^Alive:\s*(\d+)/);
            const plots = text.match(/^Plots:\s*(.*)/);
            if (alive) alivePestCount = Number(alive[1]);
            if (plots) infestedPlots = plots[1].match(/\d+/g)?.map(Number) ?? [];
        }
        return { alivePestCount, infestedPlots };
    } catch (error) {
        console.error(error);
        return { alivePestCount: 0, infestedPlots: [] };
    }
}

export function getPestCooldown() {
    try {
        const names = getTabListNames();
        const start = names.findIndex((line) => stripTabFormatting(line?.getName?.() ?? line).includes('Pests:'));
        for (let i = start + 1; start !== -1 && i < names.length; i++) {
            const match = stripTabFormatting(names[i]?.getName?.() ?? names[i])
                .trim()
                .match(/^Cooldown:\s*(?:(\d+)m\s*)?(?:(\d+)s)?$/);
            if (match) return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
        }
    } catch (error) {
        console.error(error);
    }
    return 0;
}

export const TabListUtils = { readCommissions, readVisitors };
