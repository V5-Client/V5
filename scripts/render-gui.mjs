import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const loader = join(root, '..', 'V5Loader');
const cache = join(homedir(), '.gradle', 'caches', 'modules-2', 'files-2.1', 'io.github.humbleui');
const temporary = mkdtempSync(join(tmpdir(), 'v5-gui-'));

const findJar = (name) => {
    let match;
    const walk = (directory) => {
        if (match || !existsSync(directory)) return;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) walk(path);
            else if (entry.name === name) match = path;
        }
    };
    walk(cache);
    return match;
};

const platform = { linux: 'linux-x64', darwin: process.arch === 'arm64' ? 'macos-arm64' : 'macos-x64', win32: 'windows-x64' }[process.platform];
const jars = ['skija-shared-0.143.11.jar', `skija-${platform}-0.143.11.jar`, 'types-0.1.1.jar'].map(findJar);
if (!platform || jars.some((jar) => !jar)) throw new Error('Skija 0.143.11 is missing; run ../V5Loader/gradlew build once');

const run = (program, args) => {
    const result = spawnSync(program, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status) process.exit(result.status);
};
const java = (...args) => run('java', ['--enable-native-access=ALL-UNNAMED', '-cp', jars.join(delimiter), join(root, 'scripts', 'RenderGui.java'), ...args]);
const capture = (metrics = '') =>
    run('node', [
        '--no-warnings',
        '--experimental-vm-modules',
        join(root, 'scripts', 'CaptureGui.mjs'),
        root,
        join(temporary, 'requests'),
        join(temporary, 'commands'),
        metrics,
        ...process.argv.slice(2),
    ]);

try {
    capture();
    java('measure', loader, join(temporary, 'requests'), join(temporary, 'metrics'));
    capture(join(temporary, 'metrics'));
    java('render', join(temporary, 'commands'), join(root, 'scriptoutputs', 'v5-gui.png'));
} finally {
    rmSync(temporary, { recursive: true, force: true });
}
