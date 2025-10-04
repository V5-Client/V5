import request from 'requestV2';
import { Links } from '../Utility/Constants';
import { Runtime } from '../Utility/Constants';
import { stopPathing } from './Pathwalker';

const scriptInstanceId = Date.now() + Math.random();
const lockFilePath = 'config/ChatTriggers/assets/pathfinder.lock';
const initTimestampPath =
    'config/ChatTriggers/assets/pathfinder_init.timestamp';
const currentMapPath = 'config/ChatTriggers/assets/pathfinder_current.map';
console.log(`Pathfinder script instance ${scriptInstanceId} loaded.`);

const assetsDir = new java.io.File(
    'config/ChatTriggers/assets'
).getAbsolutePath();
const exePath = `${assetsDir}/Pathfinding.exe`;

let process = null;
const localhost = `${Links.PATHFINDER_API_URL}`;
const port = parseInt(Links.PATHFINDER_API_URL.split(':').pop());

let programState = 'STOPPED'; // 'STOPPED', 'INITIALIZING', 'STARTING', 'RUNNING'
let startupCallbacks = { success: [], failure: [] };

let currentMap = null;
try {
    let savedMap = FileLib.read(currentMapPath);
    if (savedMap) {
        currentMap = savedMap;
        console.log(`Restored previous map state: '${currentMap}'`);
    }
} catch (e) {}

function forceStopProcessSync() {
    console.log(
        'Executing synchronous kill command for any orphaned processes...'
    );
    try {
        const os = java.lang.System.getProperty('os.name').toLowerCase();
        const command = os.includes('win')
            ? 'taskkill /F /IM Pathfinding.exe'
            : 'killall -9 Pathfinding.exe';
        Runtime.getRuntime().exec(command).waitFor();
        console.log('Synchronous kill command finished.');
    } catch (e) {}
}

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
    if (programState !== 'RUNNING') return;

    const url = `${localhost}/api/loadmap?map=${map}`;
    request({ url, timeout: 5000 })
        .then(() => {
            console.log(`Successfully loaded map '${map}'.`);
            currentMap = map;
            FileLib.write(currentMapPath, map);
        })
        .catch((err) => {
            const errorMessage = `Failed to load map '${map}'. The server may have been busy or unstable.`;
            console.log(`${errorMessage} Raw error: ${err}`);
            global.showNotification(
                'Map Load Failed',
                errorMessage,
                'ERROR',
                8000
            );
        });
}

export function stopProgram(callerInstanceId) {
    let ownerId = FileLib.read(lockFilePath);

    if (callerInstanceId && ownerId && ownerId != callerInstanceId) {
        console.log(
            `Stop request from obsolete instance (${callerInstanceId}) ignored. Current owner is ${ownerId}.`
        );
        return;
    }

    if (programState === 'STOPPED') return;

    programState = 'STOPPED';
    currentMap = null; // Reset internal state
    console.log('Attempting to stop Pathfinder process...');
    FileLib.delete(lockFilePath);
    FileLib.delete(currentMapPath);
    keepAlive.unregister();

    if (process !== null) {
        try {
            process.destroyForcibly();
        } catch (e) {}
        process = null;
    }

    new java.lang.Thread(() => {
        forceStopProcessSync();
    }).start();
}

export function runProgram(onSuccess, onFailure) {
    if (programState !== 'STOPPED') {
        return;
    }
    programState = 'STARTING';
    console.log("Program state set to 'STARTING'.");
    startupCallbacks = { success: [onSuccess], failure: [onFailure] };
    const fail = (error) => {
        programState = 'STOPPED';
        startupCallbacks.failure.forEach((cb) => cb && cb(error));
        startupCallbacks = { success: [], failure: [] };
    };
    console.log('Ensuring clean state before startup...');
    forceStopProcessSync();
    FileLib.delete(lockFilePath);
    if (!waitForPortToBeFree(port, 5000)) {
        fail(new Error(`Port ${port} remained in use.`));
        return;
    }
    FileLib.write(lockFilePath, scriptInstanceId);
    console.log(
        `Instance ${scriptInstanceId} has claimed ownership via lock file.`
    );

    new java.lang.Thread(() => {
        try {
            const pb = new java.lang.ProcessBuilder(exePath).directory(
                new java.io.File(assetsDir)
            );
            process = pb.start();
            const stdOut = new java.util.Scanner(process.getInputStream());
            const stdErr = new java.util.Scanner(process.getErrorStream());
            console.log('Pathfinder process holder started.');
            while (process && process.isAlive()) {
                java.lang.Thread.sleep(50);
                while (stdOut.hasNextLine())
                    console.log(`[Pathfinding.exe] ${stdOut.nextLine()}`);
                while (stdErr.hasNextLine())
                    console.log(`[Pathfinding.exe ERROR] ${stdErr.nextLine()}`);
            }
            const exitCode = process ? process.exitValue() : -1;
            console.log(
                `Pathfinder process finished with exit code ${exitCode}.`
            );
            if (programState === 'STARTING') {
                fail(
                    new Error(
                        `Process exited with code ${exitCode} during startup.`
                    )
                );
            } else if (programState !== 'STOPPED') {
                programState = 'STOPPED';
                keepAlive.unregister();
            }
        } catch (e) {
            console.log(`Error running pathfinder process: ${e}`);
            process = null;
            if (programState === 'STARTING') fail(e);
            else programState = 'STOPPED';
        }
    }).start();

    let attempts = 0;
    const maxAttempts = 20;
    const poller = register('tick', () => {
        if (programState !== 'STARTING') {
            poller.unregister();
            return;
        }
        if (attempts++ >= maxAttempts) {
            poller.unregister();
            console.log('Server failed to respond in time.');
            stopProgram();
            fail(new Error('Server polling timed out.'));
            return;
        }
        request({
            url: `${localhost}/keepalive`,
            timeout: 500,
            connectTimeout: 500,
        })
            .then(() => {
                poller.unregister();
                console.log('Server is connected.');
                programState = 'RUNNING';
                keepAlive.register();
                startupCallbacks.success.forEach((cb) => cb && cb());
                startupCallbacks = { success: [], failure: [] };
            })
            .catch(() => {});
    });
}

function onSuccessfulInit() {
    programState = 'RUNNING';
    keepAlive.register();
    console.log('Pathfinder is running. Loading map...');
    loadMap('mines');
    stopPathing();
}

function initializePathfinder() {
    if (programState !== 'STOPPED') return;

    const now = Date.now();
    const lastInitTime = parseInt(FileLib.read(initTimestampPath)) || 0;
    // If initialization was attempted in the last 2 seconds, abort
    if (now - lastInitTime < 2000) {
        console.log(
            'Initialization recently attempted. Backing off to prevent race condition.'
        );
        return;
    }
    FileLib.write(initTimestampPath, now.toString());

    programState = 'INITIALIZING';
    console.log('Initializing Pathfinder connection...');

    request({
        url: `${localhost}/keepalive`,
        timeout: 500,
        connectTimeout: 500,
    })
        .then(() => {
            console.log('Existing Pathfinder process detected. Adopting it.');
            FileLib.write(lockFilePath, scriptInstanceId);
            console.log(
                `Instance ${scriptInstanceId} has adopted the process and claimed ownership.`
            );
            onSuccessfulInit();
        })
        .catch(() => {
            console.log(
                'No responsive Pathfinder process detected. Starting a new one.'
            );
            programState = 'STOPPED';
            runProgram(onSuccessfulInit, (error) => {
                console.log(`Failed to start Pathfinder: ${error}`);
            });
        });
}

let stopDebounce = null;

register('worldLoad', () => {
    if (stopDebounce) {
        stopDebounce.interrupt();
        stopDebounce = null;
    }
    initializePathfinder();
});

register('gameUnload', () => {
    stopPathing();
    console.log('Game unloaded. Scheduling Pathfinder to stop in 5 seconds...');
    const threadInstanceId = scriptInstanceId;
    stopDebounce = new java.lang.Thread(() => {
        try {
            java.lang.Thread.sleep(5000);
            stopProgram(threadInstanceId);
        } catch (e) {}
    });
    stopDebounce.start();
});

Runtime.getRuntime().addShutdownHook(
    new java.lang.Thread(() => {
        stopPathing();
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
        }).catch(() => {
            console.log('Keep-alive failed. Assuming process is dead.');
            stopProgram(scriptInstanceId);
        });
    }
}).unregister();
