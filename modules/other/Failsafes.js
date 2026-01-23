import { ModuleBase } from '../../utils/ModuleBase';
import { getSetting } from '../../gui/GuiSave';
import { File } from '../../utils/Constants';
import { Chat } from '../../utils/Chat';
import { DisconnectS2C } from '../../utils/Packets';
import { AlertUtils } from '../../failsafes/AlertUtils';

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
        this.actionDelay = { low: 500, high: 2000 };
        this.pingOnCheck = true;
        this.playSoundOnCheck = true;

        this.on('packetReceived', (packet) => {
            if (!this.clipOnBan) return;
            const reason = packet?.reason();
            const fullText = reason?.getString();
            const lowerText = fullText?.toLowerCase();
            if (
                lowerText?.includes('banned') ||
                lowerText?.includes('cheating') ||
                lowerText?.includes('boosting') ||
                lowerText?.includes('security') ||
                lowerText?.includes('chat')
            ) {
                ChatLib.command('v5 clip', true);
            }
        }).setFilteredClass(DisconnectS2C);

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
        this.addRangeSlider(
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
            'Discord ping on Check',
            (value) => {
                this.pingOnCheck = value;
            },
            'Toggle discord ping on check',
            this.pingOnCheck
        );
        this.addToggle(
            'Play sound on check',
            (value) => {
                this.playSoundOnCheck = value;
            },
            'Toggle play sound on check',
            this.playSoundOnCheck
        );
        this.addMultiToggle('Failsafe sound', this.getFilesinDir('failsafes/sounds'), true, (v) => {
            // someone sort this out properly
            const selectedFiles = getSetting('Failsafes', 'Failsafe sound');
            const enabledNames = selectedFiles.filter((fileObject) => fileObject.enabled).map((fileObject) => fileObject.name);

            const singleEnabledName = enabledNames[0] + '.wav';

            AlertUtils.setFailsafeSound(singleEnabledName);
        });
    }

    getFilesinDir(folder) {
        let mcDir = new File(Client.getMinecraft().runDirectory);
        let configPath = new File(mcDir, 'config/ChatTriggers/modules/V5/' + folder);

        if (!configPath.exists() || !configPath.isDirectory()) {
            Chat.message(`&cError: Directory not found.`);
            return [];
        }

        const fileArray = configPath.listFiles();
        const fileNames = [];

        if (!fileArray) return [];

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];

            let name = file.getName();

            if (name.endsWith('.wav')) {
                name = name.replace('.wav', '');

                fileNames.push(name);
            }
        }

        return fileNames;
    }
}

export default new Failsafes();
