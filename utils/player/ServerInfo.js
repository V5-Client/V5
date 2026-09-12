import { System } from '../Constants';
import { ClientboundAwardStatsPacket, ClientboundLoginPacket, ClientboundPingPacket, ServerboundClientCommandPacket } from '../Packets';

const TPS_WINDOW_SIZE = 40;
const TPS_TRIM_FRACTION = 0.25;
const TPS_EMA_ALPHA = 0.2;
const MAX_PING_HISTORY = 20;
const JITTER_CAP_MS = 10;

let lastTpsNano = 0;
let currentTps = 20;
let tpsSamples = [];
let pingSamples = [];
let waitingForPing = false;
let pingStartNano = 0;
let averagePing = 0;
let minimumPing = Infinity;

const addSample = (samples, value, maxSize) => {
    samples.push(value);
    if (samples.length > maxSize) samples.shift();
};

const averageTps = () => {
    if (!tpsSamples.length) return currentTps;
    const trim = Math.min(Math.floor(tpsSamples.length * TPS_TRIM_FRACTION), Math.floor((tpsSamples.length - 1) / 2));
    const samples = trim ? [...tpsSamples].sort((a, b) => a - b).slice(trim, -trim) : tpsSamples;
    return samples.reduce((sum, value) => sum + value, 0) / samples.length;
};

const estimateJitter = () => {
    if (!pingSamples.length || !Number.isFinite(minimumPing)) return 0;
    const sorted = [...pingSamples].sort((a, b) => a - b);
    return Math.min(Math.max(0, (sorted[Math.floor(sorted.length / 2)] - Math.min(minimumPing, sorted[0])) / 2), JITTER_CAP_MS);
};

const recordTpsPacket = () => {
    const now = System.nanoTime();
    if (lastTpsNano > 0) {
        const elapsed = Math.max(1, (now - lastTpsNano) / 1_000_000 - estimateJitter());
        addSample(tpsSamples, Math.min(20, 1000 / elapsed), TPS_WINDOW_SIZE);
        currentTps += (averageTps() - currentTps) * TPS_EMA_ALPHA;
    }
    lastTpsNano = now;
};

const requestPing = () => {
    if (!Player.getPlayer() || waitingForPing) return;
    Client.sendPacket(new ServerboundClientCommandPacket(ServerboundClientCommandPacket.Action.REQUEST_STATS));
    pingStartNano = System.nanoTime();
    waitingForPing = true;
};

const resolvePing = () => {
    if (!waitingForPing) return;
    const elapsed = (System.nanoTime() - pingStartNano) / 1_000_000;
    waitingForPing = false;
    addSample(pingSamples, elapsed, MAX_PING_HISTORY);
    minimumPing = Math.min(minimumPing, elapsed);
    averagePing = pingSamples.reduce((sum, value) => sum + value, 0) / pingSamples.length;
};

const reset = () => {
    lastTpsNano = 0;
    currentTps = 20;
    tpsSamples = [];
    pingSamples = [];
    averagePing = 0;
    waitingForPing = false;
    minimumPing = Infinity;
};

register('worldLoad', reset);
register('packetReceived', recordTpsPacket).setFilteredClass(ClientboundPingPacket);
register('packetReceived', resolvePing).setFilteredClass(ClientboundAwardStatsPacket);
register('packetReceived', () => (waitingForPing = false)).setFilteredClass(ClientboundLoginPacket);
register('step', requestPing).setDelay(1);

export const getPing = () => Math.round(averagePing);

export function getTPS() {
    const tps = Number(currentTps);
    return Number.parseFloat((Number.isFinite(tps) ? Math.max(0, Math.min(20, tps)) : 20).toFixed(2));
}

export function getTpsColor(tps) {
    if (tps > 19.8) return 0x00aa00;
    if (tps > 19) return 0x55ff55;
    if (tps > 17.5) return 0xffaa00;
    if (tps > 12) return 0xff5555;
    return 0xaa0000;
}

export function getPingColor(ping) {
    if (ping < 50) return 0x55ff55;
    if (ping < 100) return 0x00aa00;
    if (ping < 149) return 0xffff55;
    if (ping < 249) return 0xffaa00;
    return 0xff5555;
}

export const getServerInfo = () => ({ ping: getPing(), tps: getTPS() });
