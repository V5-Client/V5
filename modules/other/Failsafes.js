import { AlertUtils } from '../../failsafes/AlertUtils';
import { getSetting } from '../../gui/GuiSave';
import { File, globalAssetsDir } from '../../utils/Constants';
import { ModuleBase } from '../../utils/ModuleBase';
import { ClientboundDisconnectPacket, ClientboundLoginDisconnectPacket } from '../../utils/Packets';
import { MacroState } from '../../utils/MacroState';
import { Executor } from '../../utils/ThreadExecutor';
import { TimeUtils } from '../../utils/TimeUtils';
const JURL = Java.type('java.net.URL');
const JOutputStreamWriter = Java.type('java.io.OutputStreamWriter');

class Failsafes extends ModuleBase {
    constructor() {
        super({
            name: 'Failsafes',
            subcategory: 'Core',
            description: 'Failsafe settings.',
            tooltip: 'Failsafe config.',
            hideInModules: true,
        });

        this.lastBanLogTime = 0;

        register('packetReceived', (packet) => {
            const reason = packet?.reason();
            const fullText = reason?.getString?.() || reason?.toString?.();
            this.postBanLog(fullText);
        }).setFilteredClasses([ClientboundLoginDisconnectPacket, ClientboundDisconnectPacket]);

        const sectionName = 'Failsafes';
        const enabledFailsafes = ['TP', 'Rotation', 'Velocity', 'Slot Change', 'Chat Mention', 'Player Grief', 'Block', 'Smart'];

        this.addDirectMultiToggle('Enabled Failsafes', enabledFailsafes, false, null, 'Select which failsafes are enabled', enabledFailsafes, sectionName);
        this.addDirectMultiToggle(
            'Failsafe Sensitivity',
            ['Relaxed', 'Normal', 'High', 'Strict'],
            true,
            null,
            'Global failsafe sensitivity preset',
            'Normal',
            sectionName
        );
        this.addDirectRangeSlider(
            'Failsafe Detection Delay (ms)',
            500,
            5000,
            { low: 500, high: 2000 },
            null,
            'Delay in milliseconds between detection of failsafe',
            sectionName
        );
        this.addDirectSlider('Player Proximity Distance', 1, 10, 3, null, 'Distance in blocks for player nearby detection', sectionName);
        this.addDirectToggle('Pause macro on failsafe', null, 'Pause the running macro until the failsafe response finishes', true, sectionName);
        this.addDirectMultiToggle(
            'Min severity to fire alert overlay',
            ['low', 'medium', 'high', 'very high'],
            true,
            null,
            'Minimum severity required to show the failsafe overlay and response bot',
            'high',
            sectionName
        );
        this.addDirectTextInput(
            'Chat Mention - High Severity Words',
            'wdr, report, cheat, hack, exploit, macro',
            null,
            'Comma-separated high-severity chat words',
            sectionName
        );
        this.addDirectTextInput('Chat Mention - Medium Severity Words', '', null, 'Comma-separated medium-severity chat words', sectionName);
        this.addDirectTextInput('Player Grief - Whitelist', '', null, 'Comma-separated player names ignored by player grief checks', sectionName);
        this.addDirectMultiToggle(
            'Discord ping on Check',
            ['None', 'Embed Only', 'Ping', 'Screenshot Only', 'Ping & Screenshot'],
            true,
            null,
            'Toggle discord ping on check',
            'Ping',
            sectionName
        );
        this.addDirectToggle('Play sound on check', null, 'Toggle play sound on check', true, sectionName);
        this.addDirectMultiToggle(
            'Failsafe sound',
            this.getFilesInDir(),
            true,
            () => {
                const selectedFiles = getSetting('Failsafes', 'Failsafe sound');
                const selectedFile = (Array.isArray(selectedFiles) ? selectedFiles : []).find((file) => file.enabled);
                if (selectedFile) AlertUtils.setFailsafeSound(`${selectedFile.name}.ogg`);
            },
            null,
            false,
            sectionName
        );
    }

    postBanLog(reason) {
        if (!reason?.includes('https://www.hypixel.net/appeal')) return;

        const now = Date.now();
        if (now - this.lastBanLogTime < 60000) return;
        this.lastBanLogTime = now;

        Executor.execute(() => {
            const jwt = V5Auth.getFreshJwtToken();
            if (!jwt) {
                console.error('Skipping ban log: no fresh auth token available.');
                return;
            }
            const url = new JURL('https://backend.rdbt.top/api/logs/bans');
            const conn = url.openConnection();
            conn.setRequestMethod('POST');
            conn.setDoOutput(true);
            conn.setRequestProperty('Authorization', `Bearer ${jwt}`);
            conn.setRequestProperty('Content-Type', 'application/json; charset=UTF-8');

            const lastMacros = MacroState.getLastActiveMacros();
            const lastMacroMeta = MacroState.getLastDisableMeta(lastMacros[0]);
            const lastDisableTimestamp = lastMacroMeta?.timestamp;
            const within5Minutes = typeof lastDisableTimestamp === 'number' && Date.now() - lastDisableTimestamp <= 5 * 60 * 1000;

            const body = JSON.stringify({
                reason: reason,
                lastMacro: lastMacros.join(', ') || 'None',
                currentlyMacroing: MacroState.isMacroRunning() || within5Minutes,
                macroRuntime: MacroState.isMacroRunning() ? TimeUtils.formatUptime(MacroState.getStartTime()) : null,
                ingame_username: Player?.getName?.() || 'unknown',
                config_contents: this.getConfigFileContents(),
                installed_mods: new File('./mods').listFiles().join('\n'),
            });

            const wr = new JOutputStreamWriter(conn.getOutputStream());
            wr.write(body);
            wr.close();

            const status = conn.getResponseCode();
            if (status < 200 || status >= 300) {
                console.error(`Error sending ban log. Status: ${status}`);
            }
            conn.disconnect();
        });
    }

    getConfigFileContents() {
        try {
            return FileLib.read('V5Config', 'config.json');
        } catch (e) {
            console.error(`Exception reading config for ban log: ${e}`);
            return null;
        }
    }

    getFilesInDir() {
        const targetPath = new File(globalAssetsDir, 'failsafes/sounds');

        if (!targetPath.exists() || !targetPath.isDirectory()) {
            this.message('&cError: Directory not found.');
            return [];
        }

        return Array.from(targetPath.listFiles() || [])
            .filter((file) => file.getName().endsWith('.ogg'))
            .map((file) => file.getName().slice(0, -4))
            .sort((a, b) => a.localeCompare(b));
    }
}

export default new Failsafes();
