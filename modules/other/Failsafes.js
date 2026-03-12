import { AlertUtils } from '../../failsafes/AlertUtils';
import { getSetting } from '../../gui/GuiSave';
import { Chat } from '../../utils/Chat';
import { File, globalAssetsDir, V5Auth } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { DisconnectS2C, LoginDisconnectS2C } from '../../utils/Packets';
import { MacroState } from '../../utils/MacroState';
import Clipping from '../../utils/Clipping';
const JURL = Java.type('java.net.URL');
const JHttpURLConnection = Java.type('java.net.HttpURLConnection');
const JOutputStreamWriter = Java.type('java.io.OutputStreamWriter');
const JScanner = Java.type('java.util.Scanner');

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
        this.pingOnCheck = 'Ping';
        this.playSoundOnCheck = true;

        register('packetReceived', (packet) => {
            const reason = packet?.reason();
            const fullText = reason?.getString?.() || reason?.toString?.();
            const lowerText = fullText?.toLowerCase();

            if (this.isBanReason(lowerText)) {
                const lastMacro = MacroState.getLastActiveMacro() || 'None';
                this.postBanLog(fullText, lastMacro, MacroState.isMacroRunning());

                if (this.clipOnBan) {
                    Client.scheduleTask(40, () => Clipping.saveClip());
                }
            }
        }).setFilteredClasses([LoginDisconnectS2C, DisconnectS2C]);

        // Helper to keep code clean

        // this.on('command', (...args) => {
        //     const lastMacro = MacroState.getLastActiveMacro() || 'None';
        //     this.postBanLog('Test Banned for Cheating', lastMacro, MacroState.isMacroRunning(), true);
        //     if (this.clipOnBan) ChatLib.command('v5 clip', true);
        // }).setName('testbanlog');

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
            ['TP', 'Rotation', 'Velocity', 'Slot Change', 'Chat Mention', 'Player Grief'],
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
        this.addDirectMultiToggle(
            'Discord ping on Check',
            ['None', 'Embed Only', 'Ping', 'Screenshot Only', 'Ping & Screenshot'],
            true,
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
            this.getFilesinDir(),
            true,
            () => {
                const selectedFiles = getSetting('Failsafes', 'Failsafe sound');
                if (!Array.isArray(selectedFiles)) return;
                const enabledNames = selectedFiles.filter((fileObject) => fileObject.enabled).map((fileObject) => fileObject.name);
                if (enabledNames.length === 0) return;

                const singleEnabledName = enabledNames[0] + '.wav';

                AlertUtils.setFailsafeSound(singleEnabledName);
            },
            null,
            false,
            sectionName
        );
    }

    isBanReason(text) {
        if (!text) return false;
        return text.includes('banned') || text.includes('cheating') || text.includes('boosting') || text.includes('security');
    }

    postBanLog(reason, lastMacro, currentlyMacroing, verbose = false) {
        new Thread(() => {
            try {
                const jwt = V5Auth.getJwtToken();
                const configContents = this.getConfigFileContents();
                const url = new JURL('https://backend.rdbt.top/api/logs/bans');
                const conn = url.openConnection();
                conn.setRequestMethod('POST');
                conn.setDoOutput(true);
                conn.setRequestProperty('Authorization', `Bearer ${jwt}`);
                conn.setRequestProperty('Content-Type', 'application/json; charset=UTF-8');

                const body = JSON.stringify({
                    reason: reason,
                    lastMacro: lastMacro,
                    currentlyMacroing: currentlyMacroing,
                    ingame_username: Player?.getName?.() || 'unknown',
                    config_contents: configContents,
                });

                const wr = new JOutputStreamWriter(conn.getOutputStream());
                wr.write(body);
                wr.close();

                const status = conn.getResponseCode();
                if (status >= 200 && status < 300) {
                    if (verbose) console.log(`Ban log sent.`);
                } else {
                    console.error(`Error sending ban log. Status: ${status}`);
                }
                conn.disconnect();
            } catch (e) {
                console.error(`Exception sending ban log: ${e}`);
            }
        }).start();
    }

    getConfigFileContents() {
        try {
            return FileLib.read('V5Config', 'config.json');
        } catch (e) {
            console.error(`Exception reading config for ban log: ${e}`);
            return null;
        }
    }

    getFilesinDir() {
        const targetPath = new File(globalAssetsDir, 'failsafes/sounds');

        if (!targetPath.exists() || !targetPath.isDirectory()) {
            Chat.message(`&cError: Directory not found.`);
            return [];
        }

        const fileArray = targetPath.listFiles();
        const fileNames = [];
        const seen = new Set();

        if (!fileArray) return [];

        for (const file of fileArray) {
            let name = file.getName();

            if (name.endsWith('.wav')) {
                name = name.replaceAll('.wav', '');
                if (!seen.has(name)) {
                    seen.add(name);
                    fileNames.push(name);
                }
            }
        }

        return fileNames.sort((a, b) => a.localeCompare(b));
    }
}

export default new Failsafes();
