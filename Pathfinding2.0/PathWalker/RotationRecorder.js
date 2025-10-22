// dont forget to remove before release

import { File } from '../../Utility/Constants';
import { Chat } from '../../Utility/Chat';
const configName = 'V5Config';
const rotationsDir = 'rotations';

if (!FileLib.exists(configName, rotationsDir)) {
    let dir = new File(
        './config/ChatTriggers/modules/' + configName,
        rotationsDir
    );
    dir.mkdir();
}

let isRecording = false;
let recordedData = [];
let startTime = null;

export function startRecording() {
    if (isRecording) {
        return;
    }

    isRecording = true;
    recordedData = [];
    startTime = Date.now();
    Chat.message('§a[Recorder] Started recording rotations');
}

export function stopRecording() {
    if (!isRecording) {
        return;
    }

    isRecording = false;
    Chat.message(
        `§c[Recorder] Stopped recording (${recordedData.length} samples)`
    );
}

export function recordRotation(yaw, pitch) {
    if (!isRecording) return;

    const timestamp = Date.now() - startTime;
    recordedData.push({
        time: timestamp,
        yaw: normalizeAngle(yaw),
        pitch: normalizeAngle(pitch),
    });
}

// Normalize angle to -180 to 180
function normalizeAngle(angle) {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
}

export function saveRecording(filename = null) {
    if (recordedData.length === 0) {
        Chat.message('§e[Recorder] No data to save');
        return;
    }

    if (!filename) {
        const now = new Date();
        const timestamp = now
            .toISOString()
            .replace(/[:.]/g, '-')
            .substring(0, 19);
        filename = `rotation_${timestamp}.json`;
    }

    const data = {
        recordedAt: new Date().toISOString(),
        startTime: startTime,
        duration: Date.now() - startTime,
        samples: recordedData.length,
        data: recordedData,
    };

    try {
        const relativePath = `${rotationsDir}/${filename}`;
        const jsonString = JSON.stringify(data, null, 2);

        if (FileLib.exists(configName, relativePath)) {
            FileLib.delete(configName, relativePath);
        }

        FileLib.append(configName, relativePath, jsonString);

        Chat.message(`§a[Recorder] Saved ${recordedData.length} samples`);
        Chat.message(`§7[Recorder] File: ${filename}`);
        Chat.message(
            `§7[Recorder] Path: ./config/ChatTriggers/modules/${configName}/${relativePath}`
        );
    } catch (e) {
        Chat.message(`§c[Recorder] Error saving: ${e}`);
        console.error(e);
    }
}

export function isCurrentlyRecording() {
    return isRecording;
}

export function getRecordedCount() {
    return recordedData.length;
}

// manual recording commands
register('command', () => {
    startRecording();
}).setName('startrecord');

register('command', () => {
    if (!isRecording) {
        Chat.message('§c[Recorder] Not recording');
        return;
    }
    stopRecording();
    Chat.message(
        '§e[Recorder] Recording stopped but not saved. Use /saverecord to save.'
    );
}).setName('stoprecord');

register('command', (...args) => {
    const filename = args.length > 0 ? args.join('_') + '.json' : null;

    if (isRecording) {
        Chat.message(
            '§e[Recorder] Stopping recording and saving with timestamp name'
        );
        stopRecording();
    }

    saveRecording(filename);
}).setName('saverecord');

register('tick', () => {
    if (!isRecording) return;

    const yaw = Player.getYaw();
    const pitch = Player.getPitch();

    if (yaw !== null && pitch !== null) {
        recordRotation(yaw, pitch);
    }
});
Chat.message('§7  /startrecord - Start recording');
Chat.message('§7  /stoprecord - Stop recording');
Chat.message('§7  /saverecord [name] - Save recording');
