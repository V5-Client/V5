import WebSocket from 'WebSocket';
import { chatIrc } from '../Chat';
import { Links } from '../Constants';
import { returnDiscord } from '../NetworkUtils';
import { ServerboundChatPacket } from '../Packets';
import { ScheduleTask } from '../ScheduleTask';
import { v5Command } from '../V5Commands';
import { handleIRCMessage, isAutoMeowEnabled, isIrcEnabled, isRandomChoiceMeowEnabled } from './IRC';

let reconnectAttempts = 0;
let gameUnload = false;
let isConnected = false;
let ws = null;
let connectedAtMs = 0;
let reconnectScheduled = false;
let nextSocketGeneration = 0;
let activeSocketGeneration = 0;
const connectionKey = java.util.UUID.randomUUID().toString().replace(/-/g, '');
const STABLE_CONNECTION_MS = 10000;
const CONNECT_TIMEOUT_MS = 5000;
const MAX_RECONNECT_DELAY_TICKS = 20 * 60;

function isCurrentSocket(socket, generation) {
    return ws === socket && generation === activeSocketGeneration;
}

function handleSocketDisconnect({ code, reason, exception }) {
    isConnected = false;

    const closeCode = Number(code);
    if (closeCode === 1000) {
        ws = null;
        connectedAtMs = 0;
        return;
    }

    const connectedForMs = connectedAtMs ? Date.now() - connectedAtMs : 0;
    connectedAtMs = 0;
    if (connectedForMs >= STABLE_CONNECTION_MS) {
        reconnectAttempts = 0;
    }

    if (exception) {
        console.error('WebSocket error:', exception);
        chatIrc('Connection error: ' + exception);
    } else {
        console.log(`Disconnected from chat server (code ${code}, reason: ${reason})`);
    }
    attemptReconnect();
}

function handleIncomingMessage(raw) {
    try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return false;

        if (data.type === 'remote') {
            if (data.action === 'crash_game') {
                gameUnload = true;
                reconnectScheduled = false;
                isConnected = false;
                ws?.close();
                ws = null;
                V5Auth.shutDownHard();
                return true;
            }
            return;
        }

        handleIRCMessage(data);
        if (isIrcEnabled() && isAutoMeowEnabled() && data.type === 'message' && `${data.msg ?? ''}`.trim().toLowerCase() === 'meow') {
            const meows = isRandomChoiceMeowEnabled()
                ? ['meow!', 'mrrp!', 'mreow!', 'mroew!', 'mew!', 'mrow!', 'nya!', 'prrrt!', 'mraow!', 'mrrow!']
                : ['meow!'];
            sendChatMessage(meows[Math.floor(Math.random() * meows.length)]);
        }
    } catch (e) {
        chatIrc('An error occurred parsing message:');
        console.error(e);
    }
}

function sendChatMessage(content) {
    if (!isConnected || !ws) return;
    try {
        ws.send(content);
    } catch (e) {
        chatIrc('Failed to send message: ');
        console.error(e);
    }
}

function connectWebSocket() {
    const socketGeneration = ++nextSocketGeneration;
    activeSocketGeneration = socketGeneration;
    const previousSocket = ws;
    ws = null;

    if (previousSocket) {
        try {
            previousSocket.close();
        } catch (e) {
            console.error(e);
        }
    }

    const token = V5Auth.getFreshJwtToken();

    if (!token) {
        isConnected = false;
        return chatIrc('&cLoader has not authenticated. IRC is unavailable.');
    }
    returnDiscord(token);
    const socket = new WebSocket(Links.WEBSOCKET_URL);
    ws = socket;
    connectedAtMs = 0;
    socket.socket?.addHeader?.('Authorization', `Bearer ${token}`);
    socket.socket?.addHeader?.('X-Connection-Key', connectionKey);
    socket.socket?.setConnectionLostTimeout?.(15);
    let disconnectHandled = false;
    const onClient = (callback) =>
        Client.scheduleTask(0, () => {
            if (isCurrentSocket(socket, socketGeneration)) callback();
        });
    const handleDisconnectOnce = (payload) => {
        if (!isCurrentSocket(socket, socketGeneration)) return;
        if (disconnectHandled) return;
        disconnectHandled = true;
        handleSocketDisconnect(payload);
    };

    socket.onOpen = () => {
        onClient(() => {
            reconnectScheduled = false;
            isConnected = true;
            connectedAtMs = Date.now();
        });
    };

    socket.onMessage = (message) => {
        onClient(() => handleIncomingMessage(message));
    };

    socket.onError = (exception) => {
        onClient(() => handleDisconnectOnce({ exception }));
    };

    socket.onClose = (code, reason) => {
        onClient(() => handleDisconnectOnce({ code, reason }));
    };

    socket.connect();
    setTimeout(() => {
        if (!isCurrentSocket(socket, socketGeneration) || isConnected) return;
        handleDisconnectOnce({
            exception: `Connection timed out after ${CONNECT_TIMEOUT_MS}ms`,
        });
        socket.close();
    }, CONNECT_TIMEOUT_MS);
}

function attemptReconnect() {
    if (gameUnload) return;
    if (isConnected) return chatIrc('Already connected to irc!');
    if (reconnectScheduled) return;

    reconnectAttempts++;
    let delay = Math.ceil((1000 * Math.pow(2, Math.max(0, reconnectAttempts - 1))) / 50);
    if (reconnectAttempts === 1) delay = 0;
    delay = Math.min(delay, MAX_RECONNECT_DELAY_TICKS);
    reconnectScheduled = true;

    ScheduleTask(delay, () => {
        reconnectScheduled = false;
        if (gameUnload) return;
        if (isConnected) return chatIrc('Already connected to irc!');
        connectWebSocket();
    });
}

register('gameUnload', () => {
    gameUnload = true;
    isConnected = false;
    ws?.close();
    ws = null;
});

register('packetSent', (packet, event) => {
    let message;
    try {
        message = packet.message();
    } catch (e) {
        console.error(e);
    }
    if (!message || !message.startsWith('#')) return;

    sendChatMessage(message.substring(1));

    cancel(event);
}).setFilteredClass(ServerboundChatPacket);

const reconnectIRC = () => {
    reconnectAttempts = 0;
    attemptReconnect();
};

v5Command('irc', reconnectIRC);
v5Command('irc reconnect', reconnectIRC);

connectWebSocket();
