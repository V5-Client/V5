import request from 'requestV2';
import { Runtime } from '../Utility/Constants';
import { Links } from '../Utility/Constants';
const ProcessBuilder = Java.type("java.lang.ProcessBuilder");
const Scanner = Java.type("java.util.Scanner");
const InputStreamReader = Java.type("java.io.InputStreamReader");
const StandardCharsets = Java.type("java.nio.charset.StandardCharsets");

const assetsDir = new java.io.File('config/ChatTriggers/assets').getAbsolutePath();
const path = `${assetsDir}/Pathfinding.exe`;
const localhost = Links.PATHFINDER_API_URL;

let process = null;
let lastKeepAlive = Date.now() - 50_000;

export function runProgram() {
    stopProgram();
    keepAlive.register();

    new Thread(() => {
        try {
            process = new ProcessBuilder(path)
                .directory(new java.io.File(assetsDir))
                .start();
            const reader = new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8);
            const sc = new Scanner(reader);

            console.log("Program started");
            loadMap("mines");

            while (process !== null && process.isAlive()) {
                Thread.sleep(50);

                while (sc.hasNextLine()) {
                    let line = sc.nextLine();
                    console.log(line);
                }
            }

            if (process !== null) process.waitFor();
            console.log("Program finished");
        } catch (e) {
            console.log(e);
        }
    }).start();
}

function loadMap(map) {
    if (process == null) return;

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

export function stopProgram() {
    if (process !== null) {
        process.destroy();
        process = null;
        console.log("Program stopped");
        keepAlive.unregister();
    }
}

Runtime.getRuntime().addShutdownHook(
    new java.lang.Thread(() => {
        stopPathing();
        stopProgram();
    })
);

const keepAlive = register('tick', () => {
    if (Date.now() - lastKeepAlive > 60_000 && process !== null) {
        request({
            url: `${localhost}/keepalive`,
            timeout: 5000,
            json: true,
        })
        lastKeepAlive = Date.now();
        console.log(`Keep-alive sent at ${Date.now()}`);
    }
}).unregister();

register('worldUnload', stopProgram);
register('worldLoad', runProgram);