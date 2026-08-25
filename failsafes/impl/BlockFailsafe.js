import { ClientboundSectionBlocksUpdatePacket } from '../../utils/Packets';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

class BlockFailsafe extends Failsafe {
    constructor() {
        super();
        this.pickobulusExpectedUntil = 0;
        register('packetReceived', (packet) => {
            if (!this.isActive() || this.disabled) return;
            this.settings = FailsafeUtils.getFailsafeSettings('Block');
            if (!this.settings.isEnabled) return;
            if (Date.now() < this.pickobulusExpectedUntil) return;

            const preset = FailsafeUtils.getSensitivityPreset().block;
            const relevantStates = [];
            try {
                packet.runUpdates((pos, state) => {
                    const stateName = state.getBlock().getDescriptionId();
                    if (Math.hypot(pos.getX() - Player.getX(), pos.getY() - (Player.getY() + 0.8), pos.getZ() - Player.getZ()) > preset.range) return;
                    if (stateName.includes('minecraft:stone') || stateName.includes('block.minecraft.stone')) return;
                    relevantStates.push(stateName);
                });
            } catch (e) {
                console.error('V5 Caught error' + e + e.stack);
            }
            if (relevantStates.length <= preset.changeThreshold) return;

            const firstState = relevantStates[0];
            if (!firstState || !relevantStates.every((stateName) => stateName === firstState)) return;

            this._reportFailsafe({
                type: 'Block',
                severity: 'high',
                pressure: 50,
                description: `${relevantStates.length} nearby blocks changed to ${firstState}.`,
                chat: `&c&l${relevantStates.length} nearby blocks changed at once!`,
            });
        }).setFilteredClass(ClientboundSectionBlocksUpdatePacket);

        register('chat', () => {
            this.pickobulusExpectedUntil = Date.now() + 1000;
        }).setCriteria('You used your Pickobulus Pickaxe Ability!');
    }
}

new BlockFailsafe();
