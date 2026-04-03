const FORMATTING_CODE_REGEX = /§[0-9a-fk-or]/gi;

class TabListUtilsClass {
    constructor() {
        this.currentArea = 'unknown';
        this.areaLastChecked = 0;
        this.hasCookieBuff = false;
        this.cookieLastChecked = 0;
        this.pickaxeAbilityCache = { expiresAt: 0, value: '' };
        this.AREA_CACHE_MS = 1000;
        this.COOKIE_CACHE_MS = 2000;
        this.PICKAXE_ABILITY_CACHE_MS = 200;
    }

    stripFormatting(text) {
        if (text == null) return '';
        return String(text).replace(FORMATTING_CODE_REGEX, '');
    }

    getNames() {
        return TabList.getNames() || [];
    }

    getArea() {
        const now = Date.now();
        if (now - this.areaLastChecked < this.AREA_CACHE_MS) return this.currentArea;

        this.areaLastChecked = now;
        this.currentArea = 'unknown';

        try {
            const tabLines = this.getNames();
            for (let i = 0; i < tabLines.length; i++) {
                const cleanLine = this.stripFormatting(tabLines[i]).trim();
                if (!cleanLine.includes('Area:')) continue;

                const parts = cleanLine.split('Area:');
                if (parts.length <= 1) continue;

                const detectedArea = parts[1].trim();
                if (!detectedArea) continue;

                this.currentArea = detectedArea;
                return this.currentArea;
            }
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }

        return this.currentArea;
    }

    resetAreaCache() {
        this.currentArea = 'unknown';
        this.areaLastChecked = 0;
    }

    hasCookie() {
        const now = Date.now();
        if (now - this.cookieLastChecked < this.COOKIE_CACHE_MS) return this.hasCookieBuff;
        this.cookieLastChecked = now;

        try {
            const footer = TabList.getFooter();
            if (!footer) return this.hasCookieBuff;

            const raw = ChatLib.removeFormatting(footer);
            if (raw.includes('Cookie Buff') && raw.includes('Not active! Obtain booster cookies')) {
                this.hasCookieBuff = false;
            } else if (raw.includes('Cookie Buff')) {
                this.hasCookieBuff = true;
            }
        } catch (e) {
            console.error('V5 Caught error checking cookie: ' + e);
        }

        return this.hasCookieBuff;
    }

    getPickaxeAbilityStatus() {
        const now = Date.now();
        if (now < this.pickaxeAbilityCache.expiresAt) return this.pickaxeAbilityCache.value;

        const tabNames = this.getNames();
        for (const [i, tabName] of tabNames.entries()) {
            const line = this.stripFormatting(tabName?.getName?.() ?? tabName).trim();
            if (!line.includes('Pickaxe Ability') || !tabNames[i + 1]) continue;

            const ability = this.stripFormatting(tabNames[i + 1]?.getName?.() ?? tabNames[i + 1]).trim();
            this.pickaxeAbilityCache.expiresAt = now + this.PICKAXE_ABILITY_CACHE_MS;
            this.pickaxeAbilityCache.value = ability;
            return ability;
        }

        this.pickaxeAbilityCache.expiresAt = now + this.PICKAXE_ABILITY_CACHE_MS;
        this.pickaxeAbilityCache.value = '';
        return '';
    }

    readCommissions() {
        try {
            const tabNames = this.getNames();
            const startIdx = this.findIndex(tabNames, 'Commissions:');
            if (startIdx === -1) return [];

            let endIdx = this.findIndex(tabNames, 'Powders:', startIdx + 1);
            if (endIdx === -1) endIdx = tabNames.length;

            const commissions = [];

            for (let i = startIdx + 1; i < endIdx; i++) {
                const text = this.stripFormatting(tabNames[i]).trim();
                if (!text.includes(':')) continue;

                const parts = text.split(':');
                const name = parts[0]?.trim();
                const progressText = parts[1]?.trim() || '';

                if (!name) continue;

                let progress = null;
                if (progressText.includes('DONE')) {
                    progress = 1;
                } else if (progressText.includes('%')) {
                    progress = Number.parseFloat(progressText.replace(/ /g, '').replaceAll('%', '')) / 100;
                }

                if (progress == null || !Number.isFinite(progress)) continue;
                commissions.push({ name: name, progress: progress });
            }

            return commissions;
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
            return [];
        }
    }

    findIndex(items, target, start = 0) {
        for (let i = start; i < items.length; i++) {
            const cleaned = this.stripFormatting(items[i]).trim();
            if (cleaned === target) return i;
        }
        return -1;
    }
}

export const TabListUtils = new TabListUtilsClass();
