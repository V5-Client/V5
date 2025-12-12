import { ModuleBase } from '../../utils/ModuleBase';

class Failsafes extends ModuleBase {
    constructor() {
        super({
            name: 'Failsafes',
            subcategory: 'Core',
            description: 'Failsafe settings.',
            tooltip: 'Failsafe config.',
            showEnabledToggle: false,
        });

        this.tp = true;
        this.rotation = true;
        this.velocity = true;
        this.slotChange = true;
        this.chatMention = true;
        this.playerGreif = true;
        this.clipOnBan = true;
        this.playerProximityDistance = 3;
        this.actionDelay = 500;
        this.pingOnCheck = true;

        this.on('packetReceived', (packet) => {
            if (!this.clipOnBan) return;
            const reason = packet.reason();
            const fullText = reason.getString();
            const lowerText = fullText.toLowerCase();
            if (
                lowerText.includes('banned') ||
                lowerText.includes('cheating') ||
                lowerText.includes('boosting') ||
                lowerText.includes('security') ||
                lowerText.includes('chat')
            ) {
                ChatLib.command('clip', true);
            }
        }).setFilteredClass(net.minecraft.network.packet.s2c.common.DisconnectS2CPacket);

        this.addToggle(
            'TP Failsafe',
            (value) => {
                this.tp = value;
            },
            'Enable teleport failsafe',
            this.tp
        );
        this.addToggle(
            'Rotation Failsafe',
            (value) => {
                this.rotation = value;
            },
            'Enable rotation failsafe',
            this.rotation
        );
        this.addToggle(
            'Velocity Failsafe',
            (value) => {
                this.velocity = value;
            },
            'Enable velocity failsafe',
            this.velocity
        );
        this.addToggle(
            'Slot Change Failsafe',
            (value) => {
                this.slotChange = value;
            },
            'Enable slot change failsafe',
            this.slotChange
        );
        this.addToggle(
            'Chat Mention Failsafe',
            (value) => {
                this.chatMention = value;
            },
            'Enable chat mention failsafe',
            this.chatMention
        );
        this.addToggle(
            'Player Greif Failsafe',
            (value) => {
                this.playerGreif = value;
            },
            'Enable player greif failsafe',
            this.playerGreif
        );
        this.addSlider(
            'Failsafe Detection Delay (ms)',
            500,
            5000,
            this.actionDelay,
            (value) => {
                this.actionDelay = value;
            },
            'Delay in milliseconds between detection of failsafe'
        );
        this.addSlider(
            'Player Proximity Distance',
            1,
            10,
            this.playerProximityDistance,
            (value) => {
                this.playerProximityDistance = value;
            },
            'Distance in blocks for player nearby detection'
        );
        this.addToggle(
            'Clip on ban',
            (value) => {
                this.clipOnBan = value;
            },
            'Toggle clip on ban',
            this.clipOnBan
        );
        this.addToggle(
            'Ping on check',
            (value) => {
                this.pingOnCheck = value;
            },
            'Toggle ping on check',
            this.pingOnCheck
        );
    }
}

export default new Failsafes();
