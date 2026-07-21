import { autoSell } from './AutoSell';
import { philipMacro } from './PhilipMacro';
import { visitorMacro } from './VisitorMacro';
import { rewarpSettings } from './RewarpSettings';
import { Utils } from '../../../utils/Utils';

const PHASES = {
    BARN: 'Warping to barn',
    DECIDING: 'Determining',
    SELLING: 'Selling',
    VISITORS: 'Visitors',
    PHILIP: 'Philip',
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
        this.runVisitors = rewarpSettings.shouldRunVisitorMacro();
        this.runPhilip = rewarpSettings.shouldRunPhilipBonus();
        this.phase = this.runVisitors || this.runPhilip ? PHASES.BARN : PHASES.REWARP;
        this.autoSellCompleted = false;
        this.visitorsCompleted = false;
        this.philipCompleted = false;
    }

    stop() {
        autoSell.stop();
        visitorMacro.stop();
        philipMacro.stop();
    }

    tick(player) {
        if (this.phase !== PHASES.REWARP && Date.now() < this.nextActionAt) return;

        if (this.phase !== PHASES.VISITORS && this.phase !== PHASES.PHILIP) Client.stopMovement();

        if (this.phase === PHASES.BARN) {
            if (Date.now() < this.nextActionAt) return;
            ChatLib.command('tptoplot barn');
            this.phase = PHASES.DECIDING;
            this.nextActionAt = Date.now() + 2000;
            return;
        }

        if (this.phase === PHASES.DECIDING) {
            if (this.runVisitors && autoSell.shouldRun() && !this.autoSellCompleted) {
                this.phase = PHASES.SELLING;
                autoSell.start();
            } else if (this.runVisitors && !this.visitorsCompleted && visitorMacro.start()) {
                this.phase = PHASES.VISITORS;
            } else if (this.runPhilip && !this.philipCompleted) {
                this.phase = PHASES.PHILIP;
                philipMacro.start();
            } else {
                this.phase = PHASES.REWARP;
            }
        }

        if (this.phase === PHASES.SELLING) {
            if (autoSell.tick()) {
                this.phase = PHASES.DECIDING;
                this.autoSellCompleted = true;
            }
        }
        if (this.phase === PHASES.VISITORS) {
            if (visitorMacro.tick()) {
                this.phase = PHASES.DECIDING;
                this.visitorsCompleted = true;
            }
        }
        if (this.phase === PHASES.PHILIP) {
            if (philipMacro.tick()) {
                this.phase = PHASES.DECIDING;
                this.philipCompleted = true;
            }
        }
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
