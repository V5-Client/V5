import { isMacroRunning } from '../MacroState';

// Closing a screen sets missTime to 10000, which only resets on a tick without attack held,
// so a macro holding left-click through it would never break blocks again.
const RESYNC_TICKS = 3;

let wasInGui = false;
let resyncTicks = 0;

register('tick', () => {
    const inGui = Client.isInGui();
    if (wasInGui && !inGui && isMacroRunning()) resyncTicks = RESYNC_TICKS;
    wasInGui = inGui;

    if (resyncTicks <= 0 || inGui) return;
    resyncTicks--;
    try {
        Client.getMinecraft().setMissTime(0);
    } catch (e) {
        console.error('AttackResync: could not reset attack cooldown', e);
        resyncTicks = 0;
    }
});
