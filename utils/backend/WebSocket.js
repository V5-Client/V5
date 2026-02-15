import WebSocket from 'WebSocket';
import { returnDiscord } from '../../gui/Utils';
import { Chat } from '../Chat';
import { Links } from '../Constants';
import { ChatMessageC2S } from '../Packets';
import { ScheduleTask } from '../ScheduleTask';
import { v5Command } from '../V5Commands';
import { handleIRCMessage } from './IRC';
import { handleRemoteMessage } from './RemoteControl';

let SecureLoader = null;

try {
    SecureLoader = Java.type('com.chattriggers.ctjs.internal.launch.SecureLoader');
} catch (e) {
    Chat.message(
        "SecureLoader not found, IRC won't work, this is epsilon's fault. Will add 'dev' mode to loader soon to allow developing while still having loader irc."
    );
}

let reconnectAttempts = 0;
let gameUnload = false;
let isConnected = false;
let ws = null;
let start = Date.now();

function handleIncomingMessage(raw) {
    try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return false;

        if (data.type === 'remote') {
            handleRemoteMessage(data);
            return;
        } else {
            handleIRCMessage(data);
        }
    } catch (e) {
        Chat.messageIrc('An error occurred parsing message:');
        console.error('V5 Caught error' + e + e.stack);
    }
}

function sendChatMessage(content) {
    if (!isConnected || !ws) return;
    try {
        ws.send(content);
    } catch (e) {
        Chat.messageIrc('Failed to send message: ');
        console.error('V5 Caught error' + e + e.stack);
    }
}

function connectWebSocket() {
    if (ws) {
        try {
            ws.onClose = () => {};
            ws.onError = () => {};
            ws.close();
        } catch (e) {}
        ws = null;
    }

    const token = SecureLoader && SecureLoader.INSTANCE ? SecureLoader.INSTANCE.getJwtToken() : null;

    if (!token) return Chat.messageIrc('&cSecureLoader has not authenticated. Chat is unavailable.');
    returnDiscord(token);
    const wsUrl = `${Links.WEBSOCKET_URL}?token=${token}`;
    ws = new WebSocket(wsUrl);

    ws.onOpen = () => {
        reconnectAttempts = 0;
        isConnected = true;
        sendChatMessage(`Time taken to connect: ${Date.now() - start}ms`);
    };

    ws.onMessage = (message) => {
        handleIncomingMessage(message);
    };

    ws.onError = (exception) => {
        console.error('WebSocket error:', exception);
        if (isConnected) Chat.messageIrc('Connection error: ' + exception);
        isConnected = false;
        attemptReconnect();
    };

    ws.onClose = (code, reason) => {
        if (code == '1000') return;
        isConnected = false;
        Chat.log(`Disconnected from chat server (code ${code}, reason: ${reason})`);
        attemptReconnect();
    };

    ws.connect();
}

function attemptReconnect() {
    if (gameUnload) return;
    if (reconnectAttempts < 10) {
        reconnectAttempts++;
        let delay = Math.ceil((1000 * Math.pow(5, reconnectAttempts - 1)) / 50);
        if (reconnectAttempts == 1) delay = 2000;
        ScheduleTask(delay, () => {
            if (gameUnload) return;
            if (isConnected) return;
            Chat.messageIrc('Reconnecting...');
            connectWebSocket();
            start = Date.now();
        });
    } else {
        Chat.messageIrc('&cFailed to connect to chat! /v5 irc reconnect, backend might be down.');
    }
}

register('gameUnload', () => {
    gameUnload = true;
    if (ws) {
        ws.onClose = null;
        ws.close();
    }
});

register('packetSent', (packet, event) => {
    let message;
    try {
        message = packet.chatMessage();
    } catch (e) {
        console.error('V5 Caught error' + e + e.stack);
    }
    if (!message || !message.startsWith('#')) return;

    sendChatMessage(message.substring(1));

    cancel(event);
}).setFilteredClass(ChatMessageC2S);

v5Command('reconnectIRC', () => {
    reconnectAttempts = 0;
    isConnected = false;
    attemptReconnect();
});

connectWebSocket();
