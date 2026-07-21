import { autoSell } from './AutoSell';
import { philipMacro } from './PhilipMacro';
import { visitorMacro } from './VisitorMacro';
import { rewarpSettings } from './RewarpSettings';
import { Utils } from '../../../utils/Utils';

const PHASES = {
    BARN: 'Warping to barn',
    DECIDING: 'Determining',
    RUNNING: 'Running task',
    REWARP: 'Rewarping',
};
const REWARP_RETRY_MS = 10_000;
const MAX_REWARP_ATTEMPTS = 3;

class RewarpHandler {
    start(macro, rewarpStartPoint) {
        this.macro = macro;
        this.rewarpStartPoint = rewarpStartPoint;
        this.rewarpAttempts = 0;
        this.nextActionAt = Date.now() + Utils.randomInt(rewarpSettings.delayMin, rewarpSettings.delayMax);

        const runPhilip = rewarpSettings.shouldRunPhilipBonus();
        this.tasks = rewarpSettings.shouldRunVisitorMacro() || runPhilip ? [autoSell, visitorMacro] : [];
        if (runPhilip) this.tasks.push(philipMacro);
        this.phase = this.tasks.length ? PHASES.BARN : PHASES.REWARP;
    }

    stop() {
        autoSell.stop();
        visitorMacro.stop();
        philipMacro.stop();
    }

    tick(player) {
        if (this.phase !== PHASES.REWARP && Date.now() < this.nextActionAt) return;

        if (this.phase === PHASES.BARN) {
            ChatLib.command('tptoplot barn');
            this.phase = PHASES.DECIDING;
            this.nextActionAt = Date.now() + 2000;
            return;
        }

        if (this.phase === PHASES.DECIDING) {
            while ((this.task = this.tasks.shift())) {
                if (this.task === autoSell && !autoSell.shouldRun()) continue;
                if (this.task.start() !== false) {
                    this.phase = PHASES.RUNNING;
                    break;
                }
            }
            if (!this.task) this.phase = PHASES.REWARP;
        }

        if (this.phase === PHASES.RUNNING && this.task.tick()) this.phase = PHASES.DECIDING;
        if (this.phase === PHASES.REWARP) return this.rewarp(player);
    }

    rewarp(player) {
        if (this.rewarpAttempts && this.macro.isAtPoint(player, this.rewarpStartPoint)) {
            this.macro.finishRewarp(player);
            return;
        }
        if (Date.now() < this.nextActionAt) return;
        if (this.rewarpAttempts >= MAX_REWARP_ATTEMPTS || !rewarpSettings.command) {
            this.macro.message('&cRewarp failed.');
            this.macro.toggle(false);
            return;
        }

        ChatLib.command(rewarpSettings.command);
        this.rewarpAttempts++;
        this.nextActionAt = Date.now() + REWARP_RETRY_MS;
    }
}

export const rewarpHandler = new RewarpHandler();
