import WebSocket from 'WebSocket';
import requestV2 from 'requestV2';
import { Links, StandardCharsets, Base64 } from '../Constants';
import { ChatMessageC2S } from '../Packets';
import { Chat } from '../Chat';
import { Utils } from '../Utils';
import { v5Command } from '../V5Commands';
import { returnDiscord } from '../../gui/Utils';

let reconnectAttempts = 0;
let gameUnload = false;
let isConnected = false;
let ws = null;
let authToken = null;
let start = Date.now();
let currentDevice = null;

const jwtFile = `AuthCache/do_not_share_this_file`;

function parseJwtPayload(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = Base64.getUrlDecoder().decode(parts[1]);
    const json = new java.lang.String(decoded, StandardCharsets.UTF_8);
    return JSON.parse(json);
}

function isJwtValid(token) {
    if (!token) return false;
    const payload = parseJwtPayload(token);
    if (!payload || !payload.exp) return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowSeconds + 30;
}

function saveJwt(token) {
    try {
        Utils.writeConfigFile(jwtFile, { jwt: token });
    } catch (e) {
        console.error('Failed to save chat token: ');
        console.error('V5 Caught error' + e + e.stack);
    }
}

function loadSavedJwt() {
    try {
        const saved = Utils.getConfigFile(jwtFile)?.jwt;
        if (isJwtValid(saved)) {
            authToken = saved;
            return authToken;
        }
    } catch (e) {
        console.error('Failed to load saved chat token: ');
        console.error('V5 Caught error' + e + e.stack);
    }
    return null;
}

function setJwtAndConnect(token) {
    if (!isJwtValid(token)) {
        Chat.messageIrc('&cInvalid or expired JWT. Please log in again.');
        return;
    }
    authToken = token;
    saveJwt(authToken);
    Chat.messageIrc('&aChat token updated. Connecting...');
    connectWebSocket();
}

function attemptReconnect() {
    if (gameUnload) return;
    if (isConnected) return Chat.messageIrc('Already connected to irc!');
    if (reconnectAttempts < 10) {
        reconnectAttempts++;
        let delay = Math.ceil((1000 * Math.pow(5, reconnectAttempts - 1)) / 50);
        if (reconnectAttempts == 1) delay = 0;
        Client.scheduleTask(delay, () => {
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

function pollDeviceCode(deviceCode, expiresAtMs, attempt) {
    if (gameUnload) return;
    if (Date.now() > expiresAtMs) {
        Chat.messageIrc('&cLogin expired. Run /v5 irc reconnect.');
        return;
    }

    requestV2({
        url: `${Links.BASE_API_URL}/api/auth/device/poll?device_code=${deviceCode}`,
        method: 'GET',
        json: true,
        resolveWithFullResponse: true,
    })
        .then((res) => {
            if (res.statusCode === 200 && res.body?.token) {
                setJwtAndConnect(res.body.token);
                currentDevice = null;
                return;
            }
            if (res.body?.error === 'EXPIRED') {
                Chat.messageIrc('&cLogin expired. Run /v5 irc reconnect.');
                currentDevice = null;
                return;
            }
            const nextAttempt = attempt + 1;
            const delayMs = Math.min(5000, 1000 + nextAttempt * 500);
            Client.scheduleTask(Math.ceil(delayMs / 50), () => pollDeviceCode(deviceCode, expiresAtMs, nextAttempt));
        })
        .catch((err) => {
            console.error('Device poll failed', err);
            const nextAttempt = attempt + 1;
            const delayMs = Math.min(5000, 1000 + nextAttempt * 500);
            Client.scheduleTask(Math.ceil(delayMs / 50), () => pollDeviceCode(deviceCode, expiresAtMs, nextAttempt));
        });
}

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
                Utils.writeConfigFile(jwtFile, { jwt: 'reset' }); // prefix is stored in jwt
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

function connectIRC() {
    if (loadSavedJwt()) {
        connectWebSocket();
        return;
    }
    requestV2({
        url: `${Links.BASE_API_URL}/api/auth/device/start`,
        method: 'POST',
        json: true,
        resolveWithFullResponse: true,
    })
        .then((res) => {
            if (res.statusCode !== 200 || !res.body?.device_code || !res.body?.login_url) {
                Chat.messageIrc('&cFailed to start login.');
                return;
            }
            currentDevice = {
                code: res.body.device_code,
                expiresAt: Date.now() + (res.body.expires_in || 0) * 1000,
            };
            // THIS LINK DOES NOT SEEM TO BE CLICKABLE, PLS FIX TODO FIX TODO
            Chat.messageIrc(Chat.formatLink('Login with Discord', res.body.login_url));
            Utils.openBrowser(res.body.login_url);
            pollDeviceCode(res.body.device_code, currentDevice.expiresAt, 0);
        })
        .catch((err) => {
            Chat.messageIrc('&cDevice login start failed.');
            console.error('Device start failed', err);
        });
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
