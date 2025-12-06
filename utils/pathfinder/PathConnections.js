import request from 'requestV2';

import { Links, System, ProcessBuilder, Scanner, InputStreamReader, StandardCharsets, Runtime } from '../Constants';
import { PathfindingMessages } from './PathConfig';

const assetsDir = new java.io.File('config/ChatTriggers/assets').getAbsolutePath();
const path = `${assetsDir}/Pathfinding.exe`;
const localhost = Links.PATHFINDER_API_URL;

let threads = [];
let pathfindingProcess = null;
let lastKeepAlive = Date.now() - 50_000;
let keepAliveRegistered = false;

function isPathMessage(line) {
    return line.includes('path.') || line.includes('time taken') || line.includes('Path length:');
}

function isPathfindingProcessRunning() {
    const os = System.getProperty('os.name');
    let command;
    let args;

    if (os.startsWith('Windows')) {
        command = 'tasklist';
        args = ['/fi', 'IMAGENAME eq Pathfinding.exe'];
    } else if (os.startsWith('Mac') || os.startsWith('Linux')) {
        command = 'pgrep';
        args = ['-f', 'Pathfinding.exe'];
    } else {
        console.error(`Unsupported OS for process check: ${os}`);
        return false;
    }

    try {
        const checkProcess = new ProcessBuilder(command, ...args).start();
        checkProcess.waitFor();

        const reader = new InputStreamReader(checkProcess.getInputStream(), StandardCharsets.UTF_8);
        const sc = new Scanner(reader);

        if (os.startsWith('Windows')) {
            while (sc.hasNextLine()) {
                const line = sc.nextLine();
                if (line.includes('Pathfinding.exe')) return true;
            }
        } else {
            return sc.hasNextLine();
        }
    } catch (e) {
        console.error(`Error running process check command on ${os}:`, e);
    }
    return false;
}

const keepAlive = register('tick', () => {
    if (Date.now() - lastKeepAlive > 60_000) {
        request({
            url: `${localhost}/keepalive`,
            timeout: 5000,
            json: true,
        });
        lastKeepAlive = Date.now();
        console.log(`Keep-alive sent at ${Date.now()}`);
    }
}).unregister();

function startKeepAlive() {
    if (!keepAliveRegistered) {
        keepAlive.register();
        keepAliveRegistered = true;
        console.log('Pathfinding keep-alive registered.');
    }
}

export function runProgram() {
    if (isPathfindingProcessRunning()) {
        console.log('Pathfinding program is already running. Skipping startup.');
        startKeepAlive();
        return;
    }

    const thread = new Thread(() => {
        try {
            pathfindingProcess = new ProcessBuilder(path).directory(new java.io.File(assetsDir)).start();
            console.log('Pathfinding program started successfully.');

            startKeepAlive();

            const reader = new InputStreamReader(pathfindingProcess.getInputStream(), StandardCharsets.UTF_8);
            const sc = new Scanner(reader);

            const errReader = new InputStreamReader(pathfindingProcess.getErrorStream(), StandardCharsets.UTF_8);
            const errSc = new Scanner(errReader);

            while (pathfindingProcess !== null && pathfindingProcess.isAlive() && !Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(50);
                } catch (e) {
                    break;
                }

                while (sc.hasNextLine()) {
                    let line = sc.nextLine();
                    console.log(line);
                    if (isPathMessage(line)) PathfindingMessages(line);
                }

                while (errSc.hasNextLine()) {
                    let errLine = errSc.nextLine();
                    console.warn('Pathfinding Error: ' + errLine);
                }
            }

            if (pathfindingProcess !== null) pathfindingProcess.waitFor();
            pathfindingProcess = null;
        } catch (e) {
            console.log(e);
            console.error('Pathfinding program failed to start or crashed.');
        }
    });
    thread.start();
    threads.push(thread);
}

export function stopProgram() {
    keepAlive.unregister();
    keepAliveRegistered = false;

    threads.forEach((thread) => thread.interrupt());
    threads = [];

    if (pathfindingProcess !== null) {
        pathfindingProcess.destroyForcibly();
        pathfindingProcess = null;
        console.log('Pathfinding program stopped via process handle.');
    }

    if (isPathfindingProcessRunning()) {
        console.log('Pathfinding process detected as running. Attempting forceful termination by name...');

        const os = System.getProperty('os.name');
        let command;
        let args;

        if (os.startsWith('Windows')) {
            command = 'taskkill';
            args = ['/F', '/IM', 'Pathfinding.exe'];
        } else if (os.startsWith('Mac') || os.startsWith('Linux')) {
            command = 'pkill';
            args = ['-f', 'Pathfinding.exe'];
        } else {
            console.error(`Unsupported OS for process termination: ${os}`);
            return;
        }

        try {
            const killProcess = new ProcessBuilder(command, ...args).start();
            killProcess.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
            console.log('Pathfinding program forcefully terminated by OS command.');
        } catch (e) {
            console.error('Error running process termination command:', e);
        }
    } else {
        console.log('Pathfinding program was not running or has already stopped.');
    }
}

Runtime.getRuntime().addShutdownHook(
    new java.lang.Thread(() => {
        if (pathfindingProcess !== null) {
            console.log('JVM Shutdown Hook: Forcibly destroying Rust process...');
            pathfindingProcess.destroyForcibly();
            threads.forEach((thread) => thread.interrupt());
            console.log('JVM Shutdown Hook cleanup complete.');
        }

        if (isPathfindingProcessRunning()) {
            const os = System.getProperty('os.name');
            let command;
            let args;
            if (os.startsWith('Windows')) {
                command = 'taskkill';
                args = ['/F', '/IM', 'Pathfinding.exe'];
            } else if (os.startsWith('Mac') || os.startsWith('Linux')) {
                command = 'pkill';
                args = ['-f', 'Pathfinding.exe'];
            }
            if (command) {
                try {
                    new ProcessBuilder(command, ...args).start().waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                } catch (e) {}
            }
        }
    })
);

register('worldLoad', runProgram);
register('worldUnload', stopProgram);
