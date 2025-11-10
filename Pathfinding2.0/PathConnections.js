import request from 'requestV2';

import { Links, System, ProcessBuilder, Scanner, InputStreamReader, StandardCharsets } from '../Utility/Constants';
import { PathfindingMessages } from './PathConfig';

const assetsDir = new java.io.File('config/ChatTriggers/assets').getAbsolutePath();
const path = `${assetsDir}/Pathfinding.exe`;
const localhost = Links.PATHFINDER_API_URL;

let threads = [];
let lastKeepAlive = Date.now() - 50_000;

//const Maps = {
//   'Dwarven Mines': 'mines',
//    Galatea: 'galatea',
//    Hub: 'hub',
//};

function isPathMessage(line) {
    return line.includes('path.') | line.includes('time taken') || line.includes('Path length:');
}

function isPathfindingProcessRunning() {
    const os = System.getProperty('os.name');
    let command;
    let args;

    keepAlive.register();

    if (os.startsWith('Windows')) {
        command = 'tasklist';
        args = ['/fi', 'IMAGENAME eq Pathfinding.exe'];
    } else if (os.startsWith('Mac') || os.startsWith('Linux')) {
        // someone test this out (nathan)
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

export function runProgram() {
    if (isPathfindingProcessRunning()) {
        console.log('Pathfinding program is already running. Skipping startup.');
        return;
    }

    const thread = new Thread(() => {
        try {
            let process = new ProcessBuilder(path).directory(new java.io.File(assetsDir)).start();
            console.log('Pathfinding program started successfully.');

            const reader = new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8);
            const sc = new Scanner(reader);

            const errReader = new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8);
            const errSc = new Scanner(errReader);

            while (process !== null && process.isAlive() && !Thread.currentThread().isInterrupted()) {
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

            if (process !== null) process.waitFor();
            process = null;
        } catch (e) {
            console.log(e);
            console.error('Pathfinding program failed to start or crashed.');
        }
    });
    thread.start();
    threads.push(thread);
}

/*export function loadMap(map) {
    if (process == null || !process.isAlive()) return;

    const url = `${localhost}/api/loadmap?map=${map}`;
    request({ url, timeout: 5000 })
        .then(() => {
            console.log(`Successfully loaded map '${map}'.`);
            global.showNotification(`Loaded ${map}!`, 'Connection successfully loaded the island you are on', 'SUCCESS', 4000);
        })
        .catch((err) => {
            console.log(`Error loading map ${map}: ${err}`);
            global.showNotification('Map Load Failed', `Failed to load map ${map}`, 'ERROR', 8000);
        });
} */

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

register('worldLoad', runProgram);
