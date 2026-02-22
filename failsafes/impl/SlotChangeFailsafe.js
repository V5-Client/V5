import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { UpdateSelectedSlotS2C } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

class SlotChangeFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('Slot Change');
        this.registerSlotChangeListeners();
    }

    registerSlotChangeListeners() {
        register('packetReceived', (packet) => {
            if (!MacroState.isMacroRunning() || this.isFalse('slot')) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Slot Change');
            if (!this.settings.isEnabled) return;

            const currentSlot = Player.getHeldItemIndex() + 1;
            const newSlot = packet.slot() + 1;

            if (currentSlot === newSlot) return;
            setTimeout(() => {
                if (this.isFalse('slot')) return;
                this.onTrigger(currentSlot, newSlot);
            }, this._getReactionDelay(this.settings));
        }).setFilteredClass(UpdateSelectedSlotS2C);
    }

    onTrigger(fromSlot, toSlot) {
        Chat.messageFailsafe(`&c&lHeld slot has changed from ${fromSlot} to slot ${toSlot}!`);
        FailsafeUtils.incrementFailsafeIntensity(50);
        FailsafeUtils.sendFailsafeEmbed('Slot Change', 'high', `Slot changed from ${fromSlot} to ${toSlot}!`, 16744448);
    }
}

export default new SlotChangeFailsafe();
