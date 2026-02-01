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
            hideInModules: true,
        });

        this.tp = true;
        this.rotation = true;
        this.velocity = true;
        this.slotChange = true;
        this.chatMention = true;
        this.playerGrief = true;
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

        const sectionName = 'Failsafes';

        this.addDirectMultiToggle(
            'Enabled Failsafes',
            ['TP', 'Rotation', 'Velocity', 'Slot Change', 'Chat Mention', 'Player Grief'],
            false,
            (value) => {
                const enabled = Array.isArray(value) ? value : [];
                this.tp = enabled.includes('TP');
                this.rotation = enabled.includes('Rotation');
                this.velocity = enabled.includes('Velocity');
                this.slotChange = enabled.includes('Slot Change');
                this.chatMention = enabled.includes('Chat Mention');
                this.playerGrief = enabled.includes('Player Grief');
            },
            'Select which failsafes are enabled',
            false,
            sectionName
        );
        this.addDirectRangeSlider(
            'Failsafe Detection Delay (ms)',
            500,
            5000,
            this.actionDelay,
            (value) => {
                this.actionDelay = value;
            },
            'Delay in milliseconds between detection of failsafe',
            sectionName
        );
        this.addDirectSlider(
            'Player Proximity Distance',
            1,
            10,
            this.playerProximityDistance,
            (value) => {
                this.playerProximityDistance = value;
            },
            'Distance in blocks for player nearby detection',
            sectionName
        );
        this.addDirectToggle(
            'Clip on ban',
            (value) => {
                this.clipOnBan = value;
            },
            'Toggle clip on ban',
            this.clipOnBan,
            sectionName
        );
        this.addDirectToggle(
            'Discord ping on Check',
            (value) => {
                this.pingOnCheck = value;
            },
            'Toggle discord ping on check',
            this.pingOnCheck,
            sectionName
        );
        this.addDirectToggle(
            'Play sound on check',
            (value) => {
                this.playSoundOnCheck = value;
            },
            'Toggle play sound on check',
            this.playSoundOnCheck,
            sectionName
        );
        this.addDirectMultiToggle(
            'Failsafe sound',
            this.getFilesinDir('failsafes/sounds'),
            true,
            (v) => {
                // someone sort this out properly
                const selectedFiles = getSetting('Failsafes', 'Failsafe sound');
                const enabledNames = selectedFiles.filter((fileObject) => fileObject.enabled).map((fileObject) => fileObject.name);

                const singleEnabledName = enabledNames[0] + '.wav';

                AlertUtils.setFailsafeSound(singleEnabledName);
            },
            null,
            false,
            sectionName
        );
    }

    getFilesinDir(folder) {
        const mcDir = new File(Client.getMinecraft().runDirectory);
        const primaryPath = new File(mcDir, 'config/ChatTriggers/modules/V5/' + folder);
        const loaderPath = new File(mcDir, 'config/ChatTriggers/assets/V5/' + folder);

        let targetPath = primaryPath;

        if (!targetPath.exists() || !targetPath.isDirectory()) {
            targetPath = loaderPath;
        }

        if (!targetPath.exists() || !targetPath.isDirectory()) {
            Chat.message(`&cError: Directory not found.`);
            return [];
        }

        const fileArray = targetPath.listFiles();
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
