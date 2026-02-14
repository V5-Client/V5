import { System } from '../Constants.js';
import { ClientStatusC2S, CommonPingS2C, GameJoinS2C, StatisticsS2C } from '../Packets';

class NetworkMonitor {
    constructor() {
        this.lastTpsNano = 0;
        this.currentTps = 20;
        this.tpsSamples = [];
        this.tpsWindowSize = 40;
        this.tpsTrimFraction = 0.25;
        this.tpsEmaAlpha = 0.2;

        this.pingSamples = [];
        this.maxHistory = 20;
        this.waitingForPing = false;
        this.pingStartNano = 0;
        this.avgPing = 0;
        this.minPingMs = Infinity;
        this.jitterCapMs = 10;
    }

    addSample(list, value, maxSize) {
        list.push(value);
        if (list.length > maxSize) list.shift();
    }

    calculateTpsAverage() {
        if (this.tpsSamples.length === 0) return this.currentTps;

        const trimCount = Math.min(Math.floor(this.tpsSamples.length * this.tpsTrimFraction), Math.floor((this.tpsSamples.length - 1) / 2));

        if (trimCount === 0) {
            const total = this.tpsSamples.reduce((sum, value) => sum + value, 0);
            return total / this.tpsSamples.length;
        }

        const sorted = [...this.tpsSamples].sort((a, b) => a - b);
        const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
        const trimmedTotal = trimmed.reduce((sum, value) => sum + value, 0);
        return trimmedTotal / trimmed.length;
    }

    calculateJitterEstimate() {
        if (this.pingSamples.length === 0 || !Number.isFinite(this.minPingMs)) return 0;
        const sorted = [...this.pingSamples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const baseline = Math.min(this.minPingMs, sorted[0]);
        const jitter = Math.max(0, (median - baseline) / 2);
        return Math.min(jitter, this.jitterCapMs);
    }

    recordTpsPacket() {
        const now = System.nanoTime();
        if (this.lastTpsNano > 0) {
            let deltaMs = (now - this.lastTpsNano) / 1_000_000;
            deltaMs = Math.max(1, deltaMs - this.calculateJitterEstimate());
            const instant = Math.min(20, 1000 / deltaMs);
            this.addSample(this.tpsSamples, instant, this.tpsWindowSize);
            const robustTps = this.calculateTpsAverage();
            this.currentTps += (robustTps - this.currentTps) * this.tpsEmaAlpha;
        }
        this.lastTpsNano = now;
    }

    sendPingRequest() {
        if (!this.waitingForPing) {
            Client.sendPacket(new ClientStatusC2S(ClientStatusC2S.class_2800.REQUEST_STATS));
            this.pingStartNano = System.nanoTime();
            this.waitingForPing = true;
        }
    }

    resolvePing() {
        if (this.waitingForPing) {
            const elapsedMs = (System.nanoTime() - this.pingStartNano) / 1_000_000;
            this.waitingForPing = false;

            this.addSample(this.pingSamples, elapsedMs, this.maxHistory);
            this.minPingMs = Math.min(this.minPingMs, elapsedMs);

            const totalPing = this.pingSamples.reduce((sum, value) => sum + value, 0);
            this.avgPing = totalPing / this.pingSamples.length;
        }
    }

    reset() {
        this.lastTpsNano = 0;
        this.currentTps = 20;
        this.tpsSamples = [];
        this.pingSamples = [];
        this.avgPing = 0;
        this.waitingForPing = false;
        this.minPingMs = Infinity;
    }
}

const monitor = new NetworkMonitor();

register('worldLoad', () => monitor.reset());

register('packetReceived', (packet) => {
    monitor.recordTpsPacket();
}).setFilteredClass(CommonPingS2C);

register('packetReceived', (packet) => {
    monitor.resolvePing();
}).setFilteredClass(StatisticsS2C);

register('packetReceived', () => {
    monitor.waitingForPing = false;
}).setFilteredClass(GameJoinS2C);

register('step', () => {
    monitor.sendPingRequest();
}).setDelay(1);

export const ServerInfo = {
    getPing: () => Math.round(monitor.avgPing),
    getTPS: () => Number.parseFloat(monitor.currentTps.toFixed(2)),
    getServerInfo: function () {
        return {
            ping: this.getPing(),
            tps: this.getTPS(),
        };
    },
};
