import request from 'requestV2';
import { Runtime, Links } from '../Utility/Constants';
//import { stopPathing } from './PathAPI';
import { Utils } from '../Utility/Utils';
import { Chat } from '../Utility/Chat';
const ProcessBuilder = Java.type('java.lang.ProcessBuilder');
const Scanner = Java.type('java.util.Scanner');
const InputStreamReader = Java.type('java.io.InputStreamReader');
const StandardCharsets = Java.type('java.nio.charset.StandardCharsets');

const assetsDir = new java.io.File(
    'config/ChatTriggers/assets'
).getAbsolutePath();
const path = `${assetsDir}/Pathfinding.exe`;
const localhost = Links.PATHFINDER_API_URL;

let threads = [];
let process = null;
let lastKeepAlive = Date.now() - 50_000;

const Maps = {
    'Dwarven Mines': 'mines',
    Galatea: 'galatea',
    Hub: 'hub',
};

function isPathMessage(line) {
    return (
        line.includes('path.') ||
        // line.includes('nodes in') ||
        // line.includes('took') ||
        line.includes('time taken') ||
        line.includes('Path length:')
    );
}

export function runProgram() {
    //stopProgram();
    keepAlive.register();

    const thread = new Thread(() => {
        try {
            process = new ProcessBuilder(path)
                .directory(new java.io.File(assetsDir))
                .start();
            const reader = new InputStreamReader(
                process.getInputStream(),
                StandardCharsets.UTF_8
            );
            const sc = new Scanner(reader);

            const errReader = new InputStreamReader(
                process.getErrorStream(),
                StandardCharsets.UTF_8
            );
            const errSc = new Scanner(errReader);

            while (
                process !== null &&
                process.isAlive() &&
                !Thread.currentThread().isInterrupted()
            ) {
                try {
                    Thread.sleep(50);
                } catch (e) {
                    break;
                }

                while (sc.hasNextLine()) {
                    let line = sc.nextLine();

                    if (line.includes('Thanks for using the TPMM Pathfinder')) {
                        const area = Utils.area();

                        if (Maps[area]) {
                            const value = Maps[area];
                            const key = Object.keys(Maps).find(
                                (key) => Maps[key] === value
                            );

                            loadMap(Maps[area]);
                        } else {
                            console.log(
                                `No matching map found for area: ${area}`
                            );
                        }
                    }

                    console.log(line);
                    if (isPathMessage(line)) {
                        Chat.debugMessage(line);
                    }
                }

                while (errSc.hasNextLine()) {
                    let errLine = errSc.nextLine();
                    console.log('[ERROR] ' + errLine);
                }
            }

            if (process !== null) process.waitFor();
            process = null;
        } catch (e) {
            console.log(e);
        }
    });
    thread.start();
    threads.push(thread);
}

export function loadMap(map) {
    if (process == null) return;

    const url = `${localhost}/api/loadmap?map=${map}`;
    request({ url, timeout: 5000 })
        .then(() => {
            console.log(`Successfully loaded map '${map}'.`);
            global.showNotification(
                `Loaded ${map}!`,
                'Connection successfully loaded the island you are on',
                'SUCCESS',
                4000
            );
        })
        .catch((err) => {
            console.log(`Error loading map ${map}: ${err}`);
            global.showNotification(
                'Map Load Failed',
                `Failed to load map ${map}`,
                'ERROR',
                8000
            );
        });
}

export function stopProgram() {
    if (process !== null) {
        process.destroy();
        process = null;
        keepAlive.unregister();
        threads.forEach((thread) => thread.interrupt());
        threads = [];
        console.log('Pathfinding program stopped.');
    }
}

Runtime.getRuntime().addShutdownHook(
    new java.lang.Thread(() => {
        threads.forEach((thread) => thread.interrupt());
        threads = [];
        //stopPathing();
        stopProgram();
    })
);

const keepAlive = register('tick', () => {
    if (Date.now() - lastKeepAlive > 60_000 && process !== null) {
        request({
            url: `${localhost}/keepalive`,
            timeout: 5000,
            json: true,
        });
        lastKeepAlive = Date.now();
        console.log(`Keep-alive sent at ${Date.now()}`);
    }
}).unregister();

register('worldUnload', stopProgram);
register('worldLoad', runProgram);
