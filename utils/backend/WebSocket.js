import WebSocket from 'WebSocket';
import { returnDiscord } from '../../gui/Utils';
import { Chat } from '../Chat';
import { Links, V5Auth } from '../Constants';
import { ChatMessageC2S } from '../Packets';
import { ScheduleTask } from '../ScheduleTask';
import { v5Command } from '../V5Commands';
import { handleIRCMessage } from './IRC';
import { handleRemoteMessage } from './RemoteControl';

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
            ws.close();
        } catch (e) {
            console.error('V5 Caught error' + e + e.stack);
        }
    }

    const token = V5Auth.INSTANCE.getJwtToken();

    if (!token) return Chat.messageIrc('&cLoader has not authenticated. IRC is unavailable.');
    returnDiscord(token);
    const wsUrl = `${Links.WEBSOCKET_URL}?token=${encodeURIComponent(token)}`;
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
            connectWebSocket();
            start = Date.now();
        });
    } else {
        Chat.messageIrc('&cFailed to connect to chat! /v5 irc reconnect, backend might be down.');
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

connectWebSocket();
