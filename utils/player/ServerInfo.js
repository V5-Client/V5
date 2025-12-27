import { System } from '../Constants.js';

class NetworkMonitor {
    constructor() {
        this.lastTpsPacket = 0;
        this.tpsAlpha = 0.3;
        this.currentTps = 20;

        this.pingHistory = [];
        this.maxHistory = 5;
        this.waitingForPing = false;
        this.pingStartNano = 0;
        this.avgPing = 0;
    }

    recordTpsPacket() {
        const now = Date.now();
        if (this.lastTpsPacket > 0) {
            const delta = now - this.lastTpsPacket;
            const instant = Math.min(20, 20000 / delta);
            this.currentTps = instant * this.tpsAlpha + this.currentTps * (1 - this.tpsAlpha);
        }
        this.lastTpsPacket = now;
    }

    sendPingRequest() {
        if (!this.waitingForPing) {
            const Packet = net.minecraft.network.packet.c2s.play.ClientStatusC2SPacket;
            Client.sendPacket(new Packet(Packet.class_2800.REQUEST_STATS));
            this.pingStartNano = System.nanoTime();
            this.waitingForPing = true;
        }
    }

    resolvePing() {
        if (this.waitingForPing) {
            const elapsedMs = (System.nanoTime() - this.pingStartNano) / 1_000_000;
            this.waitingForPing = false;

            this.pingHistory.push(elapsedMs);
            if (this.pingHistory.length > this.maxHistory) {
                this.pingHistory.shift();
            }

            let sum = 0;
            for (var i = 0; i < this.pingHistory.length; i++) {
                sum += this.pingHistory[i];
            }
            this.avgPing = sum / this.pingHistory.length;
        }
    }

    reset() {
        this.lastTpsPacket = 0;
        this.currentTps = 20;
        this.pingHistory = [];
        this.avgPing = 0;
        this.waitingForPing = false;
    }
}

const monitor = new NetworkMonitor();

register('worldLoad', () => monitor.reset());

register('packetReceived', (packet) => {
    monitor.recordTpsPacket();
}).setFilteredClass(net.minecraft.network.packet.s2c.play.WorldTimeUpdateS2CPacket);

register('packetReceived', (packet) => {
    monitor.resolvePing();
}).setFilteredClass(net.minecraft.network.packet.s2c.play.StatisticsS2CPacket);

register('packetReceived', () => {
    monitor.waitingForPing = false;
}).setFilteredClass(net.minecraft.network.packet.s2c.play.GameJoinS2CPacket);

register('step', () => {
    monitor.sendPingRequest();
}).setDelay(1);

export const ServerInfo = {
    getPing: () => Math.round(monitor.avgPing),
    getTPS: () => parseFloat(monitor.currentTps.toFixed(1)),
    getServerInfo: function () {
        return {
            ping: this.getPing(),
            tps: this.getTPS(),
        };
    },
};
