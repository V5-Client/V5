import request from 'requestV2';
import { Links } from '../Utility/Constants';
import { Runtime } from '../Utility/Constants';
import { stopPathingMovement } from './Pathfinder';

const assetsDir = new java.io.File(
    'config/ChatTriggers/assets'
).getAbsolutePath();
const exePath = `${assetsDir}/Pathfinding.exe`;

let process = null;
const localhost = `${Links.PATHFINDER_API_URL}`;
const port = parseInt(Links.PATHFINDER_API_URL.split(':').pop());

let programState = 'STOPPED'; // 'STOPPED', 'STARTING', 'RUNNING'
let currentMap = null;

function waitForPortToBeFree(port, timeout) {
    const startTime = Date.now();
    console.log(`Waiting for port ${port} to be free...`);
    while (Date.now() - startTime < timeout) {
        try {
            new java.net.Socket('127.0.0.1', port).close();
            java.lang.Thread.sleep(200);
        } catch (e) {
            if (e.javaException instanceof java.net.ConnectException) {
                console.log(`Port ${port} is free. Proceeding with startup.`);
                return true;
            }
            java.lang.Thread.sleep(200);
        }
    }
    console.log(
        `Timeout: Port ${port} did not become free within ${timeout}ms.`
    );
    return false;
}

function loadMap(map) {
    if (currentMap === map) {
        console.log(`Map '${map}' is already loaded.`);
        return;
    }
    const url = `${localhost}/api/loadmap?map=${map}`;
    request({
        url: url,
        timeout: 5000,
    })
        .then(() => {
            console.log(`Successfully loaded map '${map}'.`);
            currentMap = map;
        })
        .catch((err) => {
            console.log(`Failed to preload map '${map}': ${err}`);
            global.showNotification(
                'Map Load Failed',
                `Failed to preload map '${map}': ${err}`,
                'ERROR',
                8000
            );
        });
}

export function stopProgram() {
    programState = 'STOPPED';
    currentMap = null;
    console.log('Attempting to stop Pathfinder process...');
    keepAlive.unregister();

    if (process !== null) {
        console.log('Using process handle to forcefully terminate.');
        try {
            process.destroyForcibly();
            process.waitFor();
        } catch (e) {
            console.log(`Error during destroyForcibly: ${e}`);
        }
        process = null;
        console.log('Process handle cleared.');
    }

    try {
        const os = java.lang.System.getProperty('os.name').toLowerCase();
        console.log(`Executing system fallback kill command for any orphans.`);
        if (os.includes('win')) {
            Runtime.getRuntime()
                .exec('taskkill /F /IM Pathfinder.exe')
                .waitFor();
        } else {
            Runtime.getRuntime().exec('killall -9 Pathfinder.exe').waitFor();
        }
    } catch (e) {}

    console.log('Pathfinder stop sequence finished.');
}

export function runProgram() {
    if (programState !== 'STOPPED') {
        console.log(
            `Ignoring runProgram() call because state is '${programState}'.`
        );
        return;
    }
    programState = 'STARTING';
    console.log("Program state set to 'STARTING'.");

    if (!FileLib.exists(exePath)) {
        global.showNotification(
            'Pathfinder.exe missing',
            `Path not found: ${exePath}`,
            'ERROR',
            8000
        );
        programState = 'STOPPED';
        return;
    }

    if (programState !== 'STOPPED') {
        stopProgram();
    }

    if (!waitForPortToBeFree(port, 5000)) {
        global.showNotification(
            'Pathfinder Start Failed',
            `Port ${port} remained in use.`,
            'ERROR',
            8000
        );
        programState = 'STOPPED';
        return;
    }

    keepAlive.register();

    console.log(`Starting Pathfinder.exe with working directory: ${assetsDir}`);

    const JavaProcessBuilder = java.lang.ProcessBuilder;
    const JavaScanner = java.util.Scanner;
    const JavaThread = java.lang.Thread;
    const JavaFile = java.io.File;

    new JavaThread(() => {
        try {
            const processBuilder = new JavaProcessBuilder(exePath);
            processBuilder.directory(new JavaFile(assetsDir));
            process = processBuilder.start();

            const stdOut = new JavaScanner(process.getInputStream());
            const stdErr = new JavaScanner(process.getErrorStream());
            console.log('Pathfinder process holder started.');
            while (process !== null && process.isAlive()) {
                JavaThread.sleep(50);
                while (stdOut.hasNextLine())
                    console.log(`[Pathfinder.exe] ${stdOut.nextLine()}`);
                while (stdErr.hasNextLine())
                    console.log(`[Pathfinder.exe ERROR] ${stdErr.nextLine()}`);
            }
            programState = 'STOPPED';
            const exitCode = process !== null ? process.exitValue() : -1;
            console.log(
                `Pathfinder process finished with exit code ${exitCode}. State reset.`
            );
        } catch (e) {
            console.log(`Error running pathfinder process: ${e}`);
            process = null;
            programState = 'STOPPED';
        }
    }).start();

    let attempts = 0;
    const maxAttempts = 20;
    const poller = register('tick', () => {
        if (process !== null && !process.isAlive()) {
            console.log('Process terminated unexpectedly during startup poll.');
            poller.unregister();
            keepAlive.unregister();
            programState = 'STOPPED';
            return;
        }
        if (attempts >= maxAttempts) {
            console.log('Server failed to respond in time.');
            poller.unregister();
            stopProgram();
            return;
        }
        attempts++;
        request({ url: `${localhost}/keepalive`, timeout: 500 })
            .then(() => {
                console.log('Server is connected.');
                programState = 'RUNNING';
                poller.unregister();
            })
            .catch(() => {});
    });
}

register('worldLoad', () => {
    if (programState === 'STOPPED') {
        runProgram();
    }
    stopPathingMovement();
});
register('gameUnload', () => {
    stopProgram();
    stopPathingMovement();
});
const runtime = Runtime.getRuntime();
runtime.addShutdownHook(
    new java.lang.Thread(() => {
        stopPathingMovement();
        stopProgram();
    })
);
let lastKeepAlive = Date.now() - 50_000;
let keepAlive = register('tick', () => {
    if (programState === 'RUNNING' && Date.now() - lastKeepAlive > 60_000) {
        lastKeepAlive = Date.now();
        request({
            url: `${localhost}/keepalive`,
            timeout: 5000,
            json: true,
        }).catch(() => {});
    }
}).unregister();

register('command', () => {
    loadMap('mines');
}).setName('loadmap', true);
