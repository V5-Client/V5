import request from 'requestV2';
import { Links } from '../Utility/Constants';
import { Runtime } from '../Utility/Constants';
import { stopPathingMovement } from './Pathfinder';

const assetsDir = './config/ChatTriggers/assets/';
const exePath = `${assetsDir}Pathfinding.exe`;
let process = null;
const localhost = `${Links.PATHFINDER_API_URL}`;

function loadMap(map) {
    const url = `${localhost}/api/loadmap?map=${map}`;
    request({
        url: url,
        timeout: 5000,
    })
        .then(() => {
            console.log(`Successfully loaded map '${map}'.`);
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
    if (process !== null && !World.isLoaded()) {
        console.log('Attempting to stop Pathfinder process...');
        process.destroy();
        process = null;
        console.log('Program stopped');
        keepAlive.unregister();
    }
}

export function runProgram() {
    if (!FileLib.exists(exePath)) {
        global.showNotification(
            'Pathfinder.exe missing',
            'Download it and add it to the assets folder',
            'ERROR',
            8000
        );
        return;
    }
    stopProgram();
    keepAlive.register();

    console.log('Starting Pathfinder.exe...');

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
                while (stdOut.hasNextLine()) {
                    console.log(`[Pathfinder.exe] ${stdOut.nextLine()}`);
                }
                while (stdErr.hasNextLine()) {
                    console.log(`[Pathfinder.exe ERROR] ${stdErr.nextLine()}`);
                }
            }

            const exitCode = process !== null ? process.exitValue() : -1;
            console.log(
                `Pathfinder process finished with exit code ${exitCode}.`
            );
        } catch (e) {
            console.log(`Error running pathfinder process: ${e}`);
            process = null;
        }
    }).start();

    let attempts = 0;
    const maxAttempts = 10;

    const poller = register('tick', () => {
        if (process !== null && !process.isAlive()) {
            console.log('Process terminated unexpectedly.');
            global.showNotification(
                'Pathfinder Stopped',
                'Pathfinder.exe stopped unexpectedly.',
                'ERROR',
                8000
            );
            poller.unregister();
            stopProgram();
            return;
        }

        if (attempts >= maxAttempts) {
            console.log('Server failed to respond in time.');
            global.showNotification(
                'Pathfinder Failed',
                'Failed to connect to pathfinding server.',
                'ERROR',
                8000
            );
            poller.unregister();
            stopProgram();
            return;
        }

        attempts++;
        // console.log(`Pinging server (Attempt ${attempts}/${maxAttempts})`);

        request({ url: `${localhost}/keepalive`, timeout: 500 })
            .then(() => {
                console.log('Server is connected.');
                poller.unregister();
                loadMap('mines');
            })
            .catch(() => {});
    });
}

register('worldLoad', () => {
    runProgram();
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
    if (Date.now() - lastKeepAlive > 60_000) {
        try {
            request({
                url: `${localhost}/keepalive`,
                timeout: 5000,
                json: true,
            })
                .then(() => {})
                .catch(() => {});
        } catch (e) {}
        lastKeepAlive = Date.now();
    }
}).unregister();
