import { chat } from './Chat';
import { formatDurationMs, formatUptime } from './TimeUtils';
import { getConfigFile, writeConfigFile } from './Utils';

const SESSION_RESUME_WINDOW_MS = 5 * 60 * 1000;
const LAST_MACRO_TOGGLE_TITLE = 'Global Toggle Last Used Macro';

export const modules = new Map();
const enabledMacros = new Set();
const macroStartTimes = new Map();
const lastDisableMeta = new Map();
let lastActiveMacros = [];
let running = false;
let activeMacro = null;
let startTime = 0;
let lastMacroToggleKey = null;
let hasBoundLastMacroToggleKey = false;

const getLastActiveMacro = () => lastActiveMacros[0] || null;
export const getLastActiveMacros = () => lastActiveMacros;
export const getModule = (name) => modules.get(name);
export const isMacroRunning = () => running;
export const getActiveMacro = () => activeMacro;
export const getStartTime = () => startTime;
export const getEnabledMacros = () => Array.from(enabledMacros);
export const getLastDisableMeta = (name) => (name ? lastDisableMeta.get(name) || null : null);
export const getModuleStartTime = (name) => (name ? macroStartTimes.get(name) || 0 : 0);

export function registerModule(module) {
    if (module.name) modules.set(module.name, module);
}

export function isFailsafeMacroRunning() {
    for (const name of enabledMacros) {
        const module = getModule(name);
        if (module?.isMacro && module.ignoreFailsafes !== true) return true;
    }
    return false;
}

export function onModuleEnabled(moduleName) {
    const module = getModule(moduleName);
    if (!moduleName || !module?.isMacro) return;

    const wasEmpty = enabledMacros.size === 0;
    const now = Date.now();
    enabledMacros.add(moduleName);
    if (!macroStartTimes.has(moduleName)) {
        const last = getLastDisableMeta(moduleName);
        const canResume = last && typeof last.timestamp === 'number' && typeof last.durationMs === 'number' && now - last.timestamp <= SESSION_RESUME_WINDOW_MS;
        macroStartTimes.set(moduleName, canResume ? now - last.durationMs : now);
    }

    if (wasEmpty) startTime = getModuleStartTime(moduleName);
    running = true;
    activeMacro = moduleName;
    lastActiveMacros = lastActiveMacros.filter((name) => name !== moduleName);
    lastActiveMacros.unshift(moduleName);
}

export function onModuleDisabled(moduleName, context = 'user') {
    if (!moduleName || !enabledMacros.has(moduleName)) return;

    const now = Date.now();
    const moduleStart = getModuleStartTime(moduleName);
    lastDisableMeta.set(moduleName, { context: context || 'user', timestamp: now, durationMs: moduleStart ? now - moduleStart : 0 });
    enabledMacros.delete(moduleName);
    macroStartTimes.delete(moduleName);

    if (!enabledMacros.size) {
        running = false;
        activeMacro = null;
        startTime = 0;
    } else {
        activeMacro = Array.from(enabledMacros).pop();
    }
}

export function getModuleDuration(moduleName) {
    const moduleStart = getModuleStartTime(moduleName);
    if (moduleStart) return formatUptime(moduleStart);
    const duration = getLastDisableMeta(moduleName)?.durationMs || 0;
    return duration > 0 ? formatDurationMs(duration) : '';
}

export function getModuleElapsedMs(moduleName) {
    const moduleStart = getModuleStartTime(moduleName);
    return moduleStart ? Date.now() - moduleStart : getLastDisableMeta(moduleName)?.durationMs || 0;
}

export const getModuleActiveHours = (moduleName) => getModuleElapsedMs(moduleName) / 3600000;

function toggleLastUsedMacroFromUser() {
    const macroName = getLastActiveMacro();
    if (!macroName) {
        chat('&eNo recently used macro to toggle.');
        return false;
    }

    const module = getModule(macroName);
    if (!module?.isMacro || typeof module.requestToggleFromUser !== 'function') {
        chat(`&cUnable to toggle last macro: ${macroName}.`);
        return false;
    }
    module.requestToggleFromUser();
    return true;
}

export function setupLastMacroToggleKey() {
    if (hasBoundLastMacroToggleKey) return;
    hasBoundLastMacroToggleKey = true;

    const keybinds = getConfigFile('keybinds.json') || {};
    lastMacroToggleKey = new KeyBind(LAST_MACRO_TOGGLE_TITLE, keybinds[LAST_MACRO_TOGGLE_TITLE] || Keyboard.KEY_NONE, 'v5_core');
    lastMacroToggleKey.registerKeyPress(toggleLastUsedMacroFromUser);

    register('gameUnload', () => {
        const keycode = lastMacroToggleKey?.getKeyCode();
        if (typeof keycode !== 'number') return;
        const savedKeybinds = getConfigFile('keybinds.json') || {};
        savedKeybinds[LAST_MACRO_TOGGLE_TITLE] = keycode;
        writeConfigFile('keybinds.json', savedKeybinds);
    });
}
