import { Chat } from '../../utils/Chat';
import { MacroState } from '../../utils/MacroState';
import { UpdateSelectedSlotS2C } from '../../utils/Packets';
import { Webhook } from '../../utils/Webhooks';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';
class SlotChangeFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = FailsafeUtils.getFailsafeSettings('Slot Change');
        this.isFailsafeEnabled = this.settings?.isEnabled || true;
        this.FailsafeReactionTime = this.settings?.FailsafeReactionTime || 600;
        this.registerSlotChangeListeners();
    }

    registerSlotChangeListeners() {
        register('packetReceived', (packet) => {
            if (!MacroState.isMacroRunning() || this.isFalse('slot')) return;
            this.settings = FailsafeUtils.getFailsafeSettings('Slot Change');
            if (!this.settings.isEnabled) return;
            const currentSlot = Player.getHeldItemIndex() + 1;
            const newSlot = packet.slot() + 1; // first slot is 0 so +1 to match hotbar index ig
            if (currentSlot === newSlot) return;
            setTimeout(
                () => {
                    if (this.isFalse('slot')) return;
                    this.onTrigger(currentSlot, newSlot);
                },
                this.settings.FailsafeReactionTime - 50 || 600
            );
        }).setFilteredClass(UpdateSelectedSlotS2C);
    }

    onTrigger(fromSlot, toSlot) {
        Chat.messageFailsafe(`The server has changed your held slot from slot ${fromSlot} to slot ${toSlot}! (high severity)`);
        FailsafeUtils.incrementFailsafeIntensity(50);
        Webhook.sendEmbed(
            [
                {
                    title: `**Slot Change Failsafe Triggered! [high severity]**`,
                    description: `Slot changed from ${fromSlot} to ${toSlot}`,
                    color: 16744448,
                    footer: { text: `V5 Failsafes` },
                    timestamp: new Date().toISOString(),
                },
            ],
            this.settings.pingOnCheck ?? true
        );
    }
}

export default new SlotChangeFailsafe();
