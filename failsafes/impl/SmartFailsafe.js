import { MacroState } from '../../utils/MacroState';
import { ClientboundBlockDestructionPacket } from '../../utils/Packets';
import { ServerInfo } from '../../utils/player/ServerInfo';
import { Failsafe } from '../Failsafe';
import FailsafeUtils from '../FailsafeUtils';

const MINING_BOT_MACRO = 'Mining Bot';

class SmartFailsafe extends Failsafe {
    constructor() {
        super();
        this.blocksBroken = 0;
        this.bpsArray = [];
        this.recentlyBroken = [];
        this.lastBreakAt = Date.now();
        register('step', () => {
            if (!this.isMiningBotRunning() || this.disabled || Client.isInChat() || Client.isInGui()) {
                this.resetRuntime();
                return;
            }

            this.settings = FailsafeUtils.getFailsafeSettings('Smart');
            if (!this.settings.isEnabled) return;

            this.bpsArray.push(this.blocksBroken);
            this.blocksBroken = 0;
            if (this.bpsArray.length > 300) this.bpsArray.shift();

            const total = this.bpsArray.reduce((sum, value) => sum + value, 0);
            const averageBps = Math.min((5 * total) / Math.max(1, this.bpsArray.length), 3);
            if (!averageBps) return;

            const preset = FailsafeUtils.getSensitivityPreset().smart;
            const tps = Math.max(ServerInfo.getTPS?.() || 20, 10);
            const thresholdDelay = ((1000 / tps) * 20) / (averageBps * preset.threshold);
            if (Date.now() - this.lastBreakAt > thresholdDelay) {
                this._reportFailsafe({
                    type: 'Smart',
                    severity: 'high',
                    pressure: 50,
                    description: `Mining activity stalled. Average BPS: ${averageBps.toFixed(2)}, threshold: ${thresholdDelay.toFixed(0)}ms.`,
                    chat: `&c&lMining activity stalled unexpectedly!`,
                });
                this.resetRuntime();
            }
        }).setFps(5);

        register('packetReceived', (packet) => {
            if (!this.isMiningBotRunning() || this.disabled) return;

            const progress = packet.getProgress();
            if (progress < 9) return;

            const key = packet.getPos().toString();
            if (key && this.recentlyBroken.includes(key)) return;
            if (key) {
                this.recentlyBroken.push(key);
                if (this.recentlyBroken.length > 10) this.recentlyBroken.shift();
            }

            this.blocksBroken++;
            this.lastBreakAt = Date.now();
        }).setFilteredClass(ClientboundBlockDestructionPacket);
    }

    isMiningBotRunning() {
        return MacroState.getEnabledMacros().includes(MINING_BOT_MACRO);
    }

    resetRuntime() {
        this.blocksBroken = 0;
        this.bpsArray = [];
        this.lastBreakAt = Date.now();
    }
}

new SmartFailsafe();
