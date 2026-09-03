import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const [root, requestsPath, commandsPath, metricsPath, mode] = process.argv.slice(2);
const encode = (value) => Buffer.from(String(value)).toString('base64');
const metricKey = (text, size) => `${size}\0${text}`;
const metrics = new Map();
if (metricsPath) {
    for (const line of readFileSync(metricsPath, 'utf8').trim().split('\n')) {
        if (!line) continue;
        const [size, encoded, width] = line.split('\t');
        metrics.set(metricKey(Buffer.from(encoded, 'base64').toString(), size), Number(width));
    }
}

const commands = [];
const measurements = new Map();
const command = (name, ...args) => commands.push([name, ...args].join('\t'));
const signed = (value) => value | 0;

class Color {
    constructor(red, green, blue, alpha = 1) {
        if (green === undefined) {
            const value = Number(red) >>> 0;
            this.red = (value >>> 16) & 255;
            this.green = (value >>> 8) & 255;
            this.blue = value & 255;
            this.alpha = (value >>> 24) & 255 || 255;
        } else {
            this.red = Math.round(red * 255);
            this.green = Math.round(green * 255);
            this.blue = Math.round(blue * 255);
            this.alpha = Math.round(alpha * 255);
        }
    }
    getRed() {
        return this.red;
    }
    getGreen() {
        return this.green;
    }
    getBlue() {
        return this.blue;
    }
    getAlpha() {
        return this.alpha;
    }
    getRGB() {
        return signed((this.alpha << 24) | (this.red << 16) | (this.green << 8) | this.blue);
    }
}

const font = {};
const Render2D = {
    screen: { getWidth: () => 480, getHeight: () => 270 },
    getDefaultFont: () => font,
    textWidth(text, size) {
        const key = metricKey(text, size);
        measurements.set(key, [size, text]);
        return metrics.get(key) ?? String(text).length * Number(size) * 0.5;
    },
    text: (text, x, y, size, color, ignoredFont, align) => command('text', encode(text), x, y, size, signed(color), align),
    drawRect: (x, y, width, height, color) => command('rect', x, y, width, height, signed(color)),
    drawRoundedRect: (x, y, width, height, radius, color) => command('round', x, y, width, height, radius, signed(color)),
    drawRoundedRectVaried: (x, y, width, height, color, tl, tr, br, bl) => command('varied', x, y, width, height, signed(color), tl, tr, br, bl),
    drawImage: (path, x, y, width, height, radius = 0, alpha = 1) => command('image', encode(path), x, y, width, height, radius, alpha),
    drawImageFromUrl: () => {},
    drawDropShadow: (x, y, width, height, radius, blur, spread, color) => command('shadow', x, y, width, height, radius, blur, spread, signed(color)),
    save: () => command('save'),
    restore: () => command('restore'),
    translate: (x, y) => command('translate', x, y),
    scale: (x, y) => command('scale', x, y ?? x),
    rotate: (degrees) => command('rotate', degrees),
    scissor: (x, y, width, height) => command('scissor', x, y, width, height),
    resetScissor: () => command('resetScissor'),
    blurBackground: () => {},
    globalAlpha: (alpha) => command('alpha', alpha),
    registerV5Render: () => ({}),
    unregisterV5Render: () => {},
};

class Gui {
    isOpen() {
        return true;
    }
    open() {}
    close() {}
    registerOpened() {}
    registerClosed() {}
    registerClicked() {}
    registerMouseDragged() {}
    registerMouseReleased() {}
    registerScrolled() {}
}

const registration = new Proxy({}, { get: () => () => registration });
const globals = {
    console,
    Buffer,
    Render2D,
    Gui,
    Client: { getFPS: () => 144, getMouseX: () => -1, getMouseY: () => -1, getMinecraft: () => ({ execute: (callback) => callback() }) },
    Config: { wasWelcomeShown: () => false, markWelcomeShown: () => {}, getSendStatistics: () => false, setSendStatistics: () => {} },
    FileLib: { read: (folder, path) => readFileSync(resolve(root, path), 'utf8'), open: () => {} },
    Keyboard: { KEY_NONE: 0, isKeyDown: () => false },
    World: { getWorld: () => ({ playPlayerSound: () => {} }) },
    register: () => registration,
    cancel: () => {},
    Java: { type: () => class {} },
    java: { awt: { Color } },
};
const context = vm.createContext(globals);
const cache = new Map();

const synthetic = (identifier, exports) =>
    new vm.SyntheticModule(
        Object.keys(exports),
        function () {
            for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        },
        { context, identifier }
    );

const stubs = new Map([
    [
        resolve(root, 'utils/Constants.js'),
        {
            Color,
            CLIENT_VERSION: JSON.parse(readFileSync(resolve(root, 'metadata.json'))).version,
            globalAssetsDir: { getPath: () => resolve(root, 'assets') },
            Identifier: { fromNamespaceAndPath: () => ({}) },
            SoundCategory: { MASTER: {} },
            SoundEvent: { createVariableRangeEvent: () => ({}) },
            DataFlavor: {},
            Toolkit: { getDefaultToolkit: () => ({}) },
        },
    ],
    [
        resolve(root, 'utils/MacroState.js'),
        {
            modules: new Map(),
            getEnabledModulesRevision: () => 0,
            getModule: () => null,
        },
    ],
    [resolve(root, 'utils/Utils.js'), { getConfigFile: () => ({}), writeConfigFile: () => true, area: () => 'Garden', subArea: () => 'Plot 1' }],
    [resolve(root, 'utils/TimeUtils.js'), { formatUptime: () => '00:12:34' }],
    [resolve(root, 'utils/player/ServerInfo.js'), { getPing: () => 42, getPingColor: () => 0x55ff55, getTPS: () => 20, getTpsColor: () => 0x55ff55 }],
    [resolve(root, 'utils/NetworkUtils.js'), { getDiscordPfpPath: () => null }],
    [resolve(root, 'gui/GuiSave.js'), { loadSettings: () => {}, saveSettings: () => {} }],
    [resolve(root, 'gui/OverlayUtils.js'), { OverlayManager: { openGui: () => {} } }],
    [resolve(root, 'gui/MacroToggleGui.js'), { macroToggleGui: { draw: () => {} } }],
    [resolve(root, 'gui/Changelog.js'), { drawChangelog: () => {}, getChangelogContentHeight: () => 0 }],
]);

const getModule = (path) => {
    path = resolve(path.endsWith('.js') ? path : `${path}.js`);
    if (cache.has(path)) return cache.get(path);
    const stub = stubs.get(path);
    const module = stub
        ? synthetic(path, stub)
        : new vm.SourceTextModule(readFileSync(path, 'utf8'), {
              context,
              identifier: path,
              initializeImportMeta: (meta) => (meta.url = `file://${path}`),
          });
    cache.set(path, module);
    return module;
};

const load = async (path) => {
    const module = getModule(path);
    if (module.status === 'unlinked') await module.link((specifier, parent) => getModule(resolve(dirname(parent.identifier), specifier)));
    if (module.status === 'linked') await module.evaluate();
    return module;
};

const renderer = await load(resolve(root, 'gui/core/GuiRenderer.js'));
const state = (await load(resolve(root, 'gui/core/GuiState.js'))).namespace.GuiState;
const onboarding = (await load(resolve(root, 'gui/Onboarding.js'))).namespace.onboarding;
state.openStartTime = Date.now() - 1_000;
if (mode !== '--plain') onboarding.open();
renderer.namespace.drawGUI(-1, -1);

writeFileSync(requestsPath, [...measurements.values()].map(([size, text]) => `${size}\t${encode(text)}`).join('\n'));
writeFileSync(commandsPath, commands.join('\n'));
