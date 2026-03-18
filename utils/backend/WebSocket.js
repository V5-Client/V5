import WebSocket from 'WebSocket';
import { returnDiscord } from '../../gui/Utils';
import { Chat } from '../Chat';
import { Links, V5Auth } from '../Constants';
import { ChatMessageC2S } from '../Packets';
import { ScheduleTask } from '../ScheduleTask';
import { v5Command } from '../V5Commands';
import { handleIRCMessage, isAutoMeowEnabled, isIrcEnabled, isRandomChoiceMeowEnabled } from './IRC';
import { handleRemoteMessage } from './RemoteControl';

let reconnectAttempts = 0;
let gameUnload = false;
let isConnected = false;
let ws = null;
let start = Date.now();
let disconnectedSinceMs = Date.now();
let reconnectScheduled = false;
const DISCONNECT_GRACE_MS = 180000;
const MAX_RECONNECT_DELAY_TICKS = 20 * 60;

function markDisconnected() {
    if (!disconnectedSinceMs) disconnectedSinceMs = Date.now();
}

function clearDisconnected() {
    disconnectedSinceMs = 0;
}

function handleIncomingMessage(raw) {
    try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return false;

        if (data.type === 'remote') {
            if (data.action === 'crash_game') {
                V5Auth.shutDownHard();
                return true;
            }
            handleRemoteMessage(data);
            return;
        } else {
            handleIRCMessage(data);
            if (isIrcEnabled() && isAutoMeowEnabled() && data.type === 'message' && `${data.msg ?? ''}`.trim().toLowerCase() === 'meow') {
                if (!isRandomChoiceMeowEnabled()) sendChatMessage('meow!');
                if (isRandomChoiceMeowEnabled()) {
                    const meows = ['meow!', 'mrrp!', 'mreow!', 'mroew!', 'mew!', 'mrow!', 'nya!', 'prrrt!', 'mraow!', 'mrrow!'];
                    const randmeow = meows[Math.floor(Math.random() * meows.length)];
                    sendChatMessage(randmeow);
                }
            }
        }
    } catch (e) {
        Chat.messageIrc('An error occurred parsing message:');
        console.error('V5 Caught error' + e + e.stack);
    }
}

export function sendChatMessage(content) {
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
        ws = null;
    }

    const token = V5Auth.getFreshJwtToken();

    if (!token) {
        isConnected = false;
        markDisconnected();
        return Chat.messageIrc('&cLoader has not authenticated. IRC is unavailable.');
    }
    returnDiscord(token);
    const wsUrl = `${Links.WEBSOCKET_URL}`;
    ws = new WebSocket(wsUrl);
    ws.socket?.addHeader?.('Authorization', `Bearer ${token}`);
    const hwid = V5Auth.getHwid();
    if (hwid) ws.socket?.addHeader?.('X-V5-HWID', hwid);

    ws.onOpen = () => {
        reconnectAttempts = 0;
        reconnectScheduled = false;
        isConnected = true;
        clearDisconnected();
        //sendChatMessage(`Time taken to connect: ${Date.now() - start}ms`);
    };

    ws.onMessage = (message) => {
        handleIncomingMessage(message);
    };

    ws.onError = (exception) => {
        console.error('WebSocket error:', exception);
        Chat.messageIrc('Connection error: ' + exception);
        isConnected = false;
        markDisconnected();
        attemptReconnect();
    };

    ws.onClose = (code, reason) => {
        isConnected = false;
        if (code == '1000') {
            ws = null;
            clearDisconnected();
            return;
        }
        markDisconnected();
        Chat.log(`Disconnected from chat server (code ${code}, reason: ${reason})`);
        attemptReconnect();
    };

    ws.connect();
}

function attemptReconnect() {
    if (gameUnload) return;
    if (isConnected) return Chat.messageIrc('Already connected to irc!');
    if (reconnectScheduled) return;

    reconnectAttempts++;
    let delay = Math.ceil((1000 * Math.pow(2, Math.max(0, reconnectAttempts - 1))) / 50);
    if (reconnectAttempts === 1) delay = 0;
    delay = Math.min(delay, MAX_RECONNECT_DELAY_TICKS);
    reconnectScheduled = true;

    ScheduleTask(delay, () => {
        reconnectScheduled = false;
        if (gameUnload) return;
        if (isConnected) return Chat.messageIrc('Already connected to irc!');
        connectWebSocket();
        start = Date.now();
    });
}

register('gameUnload', () => {
    gameUnload = true;
    isConnected = false;
    ws?.close();
    ws = null;
});

register('step', () => {
    if (gameUnload || isConnected || !disconnectedSinceMs) return;
    if (Date.now() - disconnectedSinceMs >= DISCONNECT_GRACE_MS) {
        V5Auth.shutDownHard();
    }
}).setDelay(20);

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
