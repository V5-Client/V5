import { ClientboundSetHeldSlotPacket } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

class SlotChangeFailsafe extends Failsafe {
    constructor() {
        super();
        register('packetReceived', (packet) => {
            if (!this.isActive() || this.disabled) return;

            this.settings = FailsafeUtils.getFailsafeSettings('Slot Change');
            if (!this.settings.isEnabled) return;

            const currentSlot = Player.getHeldItemIndex() + 1;
            const newSlot = packet.slot() + 1;

            if (currentSlot === newSlot) return;
            this._scheduleTrigger(
                () =>
                    this._reportFailsafe({
                        type: 'Slot Change',
                        severity: 'high',
                        pressure: 50,
                        description: `Slot changed from ${currentSlot} to ${newSlot}!`,
                        chat: `&c&lHeld slot has changed from ${currentSlot} to slot ${newSlot}!`,
                    }),
                this.settings
            );
        }).setFilteredClass(ClientboundSetHeldSlotPacket);
    }
}

new SlotChangeFailsafe();
