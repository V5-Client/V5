import WebSocket from 'WebSocket';
import { Links, StandardCharsets, Base64 } from '../Constants';
import { ChatMessageC2S } from '../Packets';
import { Chat } from '../Chat';
import { Utils } from '../Utils';
import { v5Command } from '../V5Commands';
import { returnDiscord } from '../../gui/Utils';
import { ScheduleTask } from '../ScheduleTask';

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
let authToken = null;
let start = Date.now();

function handleIncomingMessage(raw) {
    try {
        const data = JSON.parse(raw);
        if (data.type === 'message') {
            const sender = data.user || 'Unknown';
            Chat.messageIrc(`&9${sender}&r: ${data.msg}`);
        } else if (data.type === 'error') {
            Chat.messageIrc(`Error: ${data.code || 'Unknown'}`);
        } else if (data.type === 'system') {
            if (data.code === 'PREFIX_UPDATED') {
                Chat.messageIrc('Your prefix has been changed');
            } else if (data.code === 'MUTED') {
                Chat.messageIrc('You have been muted until ' + new Date(data.mute_expires_at * 1000).toISOString());
            } else {
                Chat.messageIrc(`System: ${data.code || ''}`);
            }
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
    if (!authToken) return;
    returnDiscord(authToken);
    const wsUrl = `${Links.WEBSOCKET_URL}?token=${authToken}`;
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
        Chat.messageIrc('Connection error: ' + exception);
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
    if (isConnected) return Chat.messageIrc('Already connected to irc!');
    if (reconnectAttempts < 10) {
        reconnectAttempts++;
        let delay = Math.ceil((1000 * Math.pow(5, reconnectAttempts - 1)) / 50);
        if (reconnectAttempts == 1) delay = 0;
        ScheduleTask(delay, () => {
            if (gameUnload) return;
            if (isConnected) return Chat.messageIrc('Already connected to irc!');
            Chat.messageIrc('Reconnecting...');
            connectIRC();
            start = Date.now();
        });
    } else {
        Chat.messageIrc('&cFailed to connect to chat! /v5 irc reconnect, backend might be down.');
    }
}

function connectIRC() {
    const token = SecureLoader.INSTANCE.getJwtToken();

    if (token) {
        authToken = token;
        connectWebSocket();
    } else {
        Chat.messageIrc('&cSecureLoader has not authenticated. Chat is unavailable.');
    }
}

register('gameUnload', () => {
    gameUnload = true;
    ws?.close();
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
    attemptReconnect();
});

connectIRC();
