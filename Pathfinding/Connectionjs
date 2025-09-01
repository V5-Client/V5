import request from 'requestV2';
import { Runtime } from '../Utility/Constants';
import { stopPathingMovement } from './Pathfinder';

const path = './config/ChatTriggers/assets/Pathfinding.exe';
let process = null;

function loadMap(map) {
    const url = `http://localhost:3000/api/loadmap?map=${map}`;
    request({
        url: url,
        timeout: 5000,
    })
        .then(() => {})
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
        process.destroy();
        process = null;
        console.log('Program stopped');
        keepAlive.unregister();
    }
}

export function runProgram() {
    if (!FileLib.exists(path)) {
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

    new JavaThread(() => {
        try {
            process = new JavaProcessBuilder(path).start();
            const sc = new JavaScanner(process.getInputStream());
            console.log('Process started');

            while (process !== null && process.isAlive()) {
                JavaThread.sleep(50);
                while (sc.hasNextLine()) {
                    console.log(sc.nextLine());
                }
            }

            if (process !== null) process.waitFor();
            console.log('Process finished.');
        } catch (e) {
            console.log(`Error running pathfinder process: ${e}`);
            process = null;
        }
    }).start();

    let attempts = 0;
    let maxAttempts = 10;

    let poller = register('tick', () => {
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
        console.log(`Pinging server (Attempt ${attempts}/${maxAttempts})`);

        request({ url: 'http://localhost:3000/keepalive', timeout: 500 })
            .then(() => {
                console.log('Server is connected.');
                poller.unregister();
                loadMap('mines');
            })
            .catch(() => {});
    });
}

register('worldLoad', () => runProgram(), stopPathingMovement());

register('gameUnload', () => stopProgram(), stopPathingMovement());

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
                url: 'http://localhost:3000/keepalive',
                timeout: 5000,
                json: true,
            })
                .then(() => {})
                .catch(() => {});
        } catch (e) {}
        lastKeepAlive = Date.now();
        console.log(`Keep-alive sent at ${Date.now()}`);
    }
}).unregister();
