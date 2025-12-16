import { System } from '../Constants.js';

const GameJoin = net.minecraft.network.packet.s2c.play.GameJoinS2CPacket;
const Statistics = net.minecraft.network.packet.s2c.play.StatisticsS2CPacket;
const ClientStatus = net.minecraft.network.packet.c2s.play.ClientStatusC2SPacket;
const WorldTimeUpdate = net.minecraft.network.packet.s2c.play.WorldTimeUpdateS2CPacket;

class ServerInfoClass {
    constructor() {
        this.prevTime = null;
        this.averageTps = 20;
        this.tpsWindow = 5;

        this.averagePing = 0;
        this.pingWindow = 5;
        this.isPinging = false;
        this.pingCache = -1;
        this.lastPingAt = -1;

        this.system = System;

        this.initializeTracking();
    }

    initializeTracking() {
        register('worldLoad', () => {
            this.prevTime = null;
            this.averageTps = 20;
            this.pingCache = -1;
            this.isPinging = false;
            this.averagePing = 0;
        });

        register('packetReceived', () => {
            if (this.lastPingAt > 0) {
                this.lastPingAt = -1;
                this.isPinging = false;
            }
        }).setFilteredClass(GameJoin);

        // ping calculation
        register('packetReceived', () => {
            if (this.lastPingAt > 0) {
                let diff = Math.abs((this.system.nanoTime() - this.lastPingAt) / 1_000_000);
                this.lastPingAt *= -1;
                this.pingCache = diff;
                let alpha = 2 / (this.pingWindow + 1);
                this.averagePing = diff * alpha + (this.averagePing > 0 ? this.averagePing * (1 - alpha) : diff);
                this.isPinging = false;
            }
        }).setFilteredClass(Statistics);

        // tps calculation
        register('packetReceived', () => {
            if (this.prevTime !== null) {
                let time = Date.now() - this.prevTime;
                let instantTps = MathLib.clampFloat(20000 / time, 0, 20);
                let alpha = 2 / (this.tpsWindow + 1);
                this.averageTps = instantTps * alpha + this.averageTps * (1 - alpha);
            }
            this.prevTime = Date.now();
        }).setFilteredClass(WorldTimeUpdate);

        // send ping requests
        register('step', () => {
            this.sendPing();
        }).setDelay(1);
    }

    sendPing() {
        if (!this.isPinging) {
            Client.sendPacket(new ClientStatus(ClientStatus.class_2800.REQUEST_STATS));
            this.lastPingAt = this.system.nanoTime();
            this.isPinging = true;
        }
    }

    /**
     * Get the current server ping in milliseconds
     * @returns {number} The average ping in milliseconds, or -1 if not available
     */
    getPing() {
        return Math.round(this.averagePing);
    }

    /**
     * Get the current server TPS (Ticks Per Second)
     * @returns {number} The average TPS, typically between 0-20
     */
    getTPS() {
        return parseFloat(this.averageTps.toFixed(1));
    }

    getServerInfo() {
        return {
            ping: this.getPing(),
            tps: this.getTPS(),
        };
    }
}

export const ServerInfo = new ServerInfoClass();
