import { autoSell } from './AutoSell';
import { philipMacro } from './PhilipMacro';
import { visitorMacro } from './VisitorMacro';
import { rewarpSettings } from './RewarpSettings';
import { Utils } from '../../../utils/Utils';
import Pathfinder from '../../../utils/pathfinder/PathFinder';
import { pestKiller } from './PestKiller';
import { loadoutHandler } from '../LoadoutHandler';

const PHASES = {
    BARN: 'Warping to barn',
    DECIDING: 'Determining',
    RUNNING: 'Running task',
    REWARP: 'Rewarping',
    RETURNING: 'Returning',
};
const REWARP_RETRY_MS = 10_000;
const MAX_REWARP_ATTEMPTS = 3;

class RewarpHandler {
    start(macro, rewarpStartPoint, runPestKiller = false, skipPestInitialLocation = false) {
        this.macro = macro;
        this.rewarpStartPoint = rewarpStartPoint;
        this.runPestKiller = runPestKiller;
        this.skipPestInitialLocation = skipPestInitialLocation;
        this.rewarpAttempts = 0;
        this.returnStarted = false;
        this.returnResult = null;

        const runVisitor = rewarpSettings.shouldRunVisitorMacro();
        this.runVisitor = runVisitor;
        const runPhilip = rewarpSettings.shouldRunPhilipBonus();
        this.tasks = runVisitor ? [autoSell, visitorMacro] : [];
        if (runPhilip) this.tasks.push(philipMacro);
        const hasBarnTasks = this.tasks.length > 0;
        if (runPestKiller) this.tasks.push(pestKiller);
        this.phase = hasBarnTasks ? PHASES.BARN : this.tasks.length ? PHASES.DECIDING : PHASES.REWARP;
        this.nextActionAt = runPestKiller && !hasBarnTasks ? 0 : Date.now() + Utils.randomInt(rewarpSettings.delayMin, rewarpSettings.delayMax);
    }

    stop() {
        autoSell.stop();
        visitorMacro.stop();
        philipMacro.stop();
        pestKiller.stop();
        if (this.returnStarted && Pathfinder.isPathing()) Pathfinder.resetPath();
    }

    tick(player) {
        if (this.phase !== PHASES.REWARP && Date.now() < this.nextActionAt) return;

        if (this.phase === PHASES.BARN) {
            if (this.runVisitor && !loadoutHandler.select(loadoutHandler.visitorSlot)) return;
            ChatLib.command('tptoplot barn');
            this.phase = PHASES.DECIDING;
            this.nextActionAt = Date.now() + 2000;
            return;
        }

        if (this.phase === PHASES.DECIDING) {
            while ((this.task = this.tasks.shift())) {
                if (this.task === autoSell && !autoSell.shouldRun()) continue;
                if (this.task === pestKiller && !loadoutHandler.select(loadoutHandler.pestKillingSlot)) {
                    this.tasks.unshift(this.task);
                    this.task = null;
                    return;
                }
                if (this.task.start(this.macro, this.task === pestKiller && this.skipPestInitialLocation) !== false) {
                    this.phase = PHASES.RUNNING;
                    break;
                }
            }
            if (!this.task) this.phase = this.runPestKiller && !rewarpSettings.looping ? PHASES.RETURNING : PHASES.REWARP;
        }

        if (this.phase === PHASES.RUNNING && this.task.tick()) this.phase = PHASES.DECIDING;
        if (this.phase === PHASES.RETURNING) return this.returnToStart();
        if (this.phase === PHASES.REWARP) return this.rewarp(player);
    }

    returnToStart() {
        if (this.returnResult !== null) {
            if (this.returnResult) {
                this.macro.finishRewarp(Player.getPlayer());
            } else {
                this.macro.message('&cFailed to return from Pest Killer.');
                this.macro.toggle(false);
            }
            return;
        }
        if (this.returnStarted) return;

        this.returnStarted = true;
        const point = this.rewarpStartPoint;
        const savedPosition = [Math.floor(point.x), Math.floor(point.y), Math.floor(point.z)];
        Pathfinder.findPath([savedPosition, [savedPosition[0], savedPosition[1] + 1, savedPosition[2]]], (success) => (this.returnResult = success), true);
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
