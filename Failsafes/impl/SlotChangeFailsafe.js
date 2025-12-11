import { Chat } from "../../utils/Chat";
import { Failsafe } from "../Failsafe";
import { getFailsafeSettings, incrementFailsafeIntensity } from "../FailsafeUtils";
import { Webhook } from "../../utils/Webhooks";
import { registerEventSB } from "../../utils/SkyblockEvents";
import MacroState from "../../utils/MacroState";

class SlotChangeFailsafe extends Failsafe {
    constructor() {
        super();
        this.settings = getFailsafeSettings("Slot Change");
        this.isFailsafeEnabled = this.settings?.isEnabled || true
        this.FailsafeReactionTime = this.settings?.FailsafeReactionTime || 600
        this.registerSlotChangeListeners();
        this.ignore = false
    }

    registerSlotChangeListeners() {
        register("packetReceived", (packet) => {
            if (!MacroState.isMacroRunning()) return;
            if (this.ignore) return
            this.settings = getFailsafeSettings("Slot Change");
            if (!this.settings.isEnabled) return;
            const currentSlot = Player.getHeldItemIndex() + 1;
            const newSlot = packet.slot() + 1; // first slot is 0 so +1 to match hotbar index ig
            if (currentSlot === newSlot) return;
            setTimeout(() => {
                if (this.ignore) return;
                this.onTrigger(currentSlot, newSlot);
            }, this.settings.FailsafeReactionTime - 50 || 600)
        }).setFilteredClass(net.minecraft.network.packet.s2c.play.UpdateSelectedSlotS2CPacket);

        register("worldLoad", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        registerEventSB("serverchange", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        registerEventSB("death", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
        registerEventSB("warp", () => {this.ignore = true; setTimeout(() => this.ignore = false, 1000)})
    }

    onTrigger(fromSlot, toSlot) {

        Chat.failsafeMsg(`The server has changed your held slot from slot ${fromSlot} to slot ${toSlot}! (${severity} severity)`);
        incrementFailsafeIntensity(50);
        Webhook.sendEmbed([
            {
                title: `**Slot Change Failsafe Triggered! [high severity]**`,
                description: `Slot changed from ${fromSlot} to ${toSlot}`,
                color: 16744448,
                footer: { text: `V5 Failsafes` },
                timestamp: new Date().toISOString(),
            },
        ]);
    }
}

export default new SlotChangeFailsafe();