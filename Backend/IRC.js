import WebSocket from 'WebSocket';
import RequestV2 from 'RequestV2';
import { Links, StandardCharsets, Base64 } from '../Utility/Constants';
import { Chat } from '../Utility/Chat';
import { Utils } from '../Utility/Utils';

let reconnectAttempts = 0;
let gameUnload = false;
let isConnected = false;
let ws = null;
let authToken = null;
let start = Date.now();

function openBrowser(url) {
    try {
        java.awt.Desktop.getDesktop().browse(new java.net.URI(url));
    } catch (e) {
        console.error('Failed to open browser: ' + e);
    }
}

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
        Utils.writeConfigFile(getTokenFileName(), { jwt: token });
    } catch (e) {
        console.error('Failed to save chat token: ' + e);
    }
}

function loadSavedJwt() {
    try {
        const saved = Utils.getConfigFile(getTokenFileName())?.jwt;
        if (isJwtValid(saved)) {
            authToken = saved;
            return authToken;
        }
    } catch (e) {
        console.error('Failed to load saved chat token: ' + e);
    }
    return null;
}

function attemptReconnect() {
    if (gameUnload) return;
    if (reconnectAttempts < 10) {
        reconnectAttempts++;
        const delay = Math.ceil((1000 * Math.pow(5, reconnectAttempts - 1)) / 50);
        //Chat.irc(`Attempting to reconnect in ${delay / 20} seconds...`);
        Client.scheduleTask(delay, () => {
            if (gameUnload) return;
            if (isConnected) return;
            Chat.irc('Reconnecting...');
            connectIRC();
        });
    } else {
        Chat.irc('&cFailed to connect to chat! /ct load or wait, backend might be down.');
    }
}

function handleIncomingMessage(raw) {
    try {
        const data = JSON.parse(raw);
        if (data.type === 'message') {
            const sender = data.user || data.mc_username || 'Unknown';
            Chat.irc(`&9${sender}&r: ${data.msg}`);
        } else if (data.type === 'error') {
            Chat.irc(`Error: ${data.code || 'Unknown'}`);
        } else if (data.type === 'system') {
            Chat.irc(`System: ${data.code || ''}`);
        }
    } catch (e) {
        Chat.irc(`An error occurred parsing message: ${e}`);
    }
}

function sendChatMessage(content) {
    if (!isConnected || !ws) return;
    try {
        ws.send(content);
    } catch (e) {
        Chat.irc('Failed to send message: ' + e);
    }
}

function connectWebSocket() {
    if (!authToken) return;

    const wsUrl = `${Links.WEBSOCKET_URL}?token=${authToken}`;
    ws = new WebSocket(wsUrl);

    ws.onOpen = () => {
        //Chat.irc('Connected to chat server');
        reconnectAttempts = 0;
        isConnected = true;
        sendChatMessage(`Time taken to connect: ${Date.now() - start}ms`);
    };

    ws.onMessage = (message) => {
        handleIncomingMessage(message);
    };

    ws.onError = (exception) => {
        console.error('WebSocket error:', exception);
        Chat.irc('Connection error: ' + exception);
        isConnected = false;
        if (!gameUnload) attemptReconnect();
    };

    ws.onClose = (code, reason) => {
        if (code == '1000') return;
        if (code == '1006') {
            Chat.irc('Backend restarting.');
        } else {
            Chat.irc(`Disconnected from chat server (code ${code}, reason: ${reason})`);
        }
        isConnected = false;
        if (!gameUnload) attemptReconnect();
    };

    start = Date.now();
    ws.connect();
}

function login() {
    const username = Player.getName();
    const serverId = global.SESSION_SERVER_HASH;
    RequestV2({
        url: `${Links.BASE_API_URL}/api/auth/login`,
        method: 'POST',
        body: {
            username,
            serverId,
        },
        json: true,
        resolveWithFullResponse: true,
    }).then((data) => {
        if (data.body.error === 'NOT_LINKED') {
            const linkUrl = `${Links.BASE_API_URL}/api/auth/discord/login?state=${data.body.code}`;
            Chat.irc(Chat.formatLink('Link Discord', linkUrl));
            Chat.irc('Do /reconnectIRC after you have linked your discord');
            openBrowser(linkUrl);
            return;
        }

        if (!data.body.token) {
            Chat.irc('Login failed.');
            return;
        }

        authToken = data.body.token;
        saveJwt(authToken);
        connectWebSocket();
    });
}

function getTokenFileName() {
    const uuid = Player.getUUID()?.toString()?.replaceAll('-', '');
    return `authCache/${uuid}.json`;
}

function connectIRC() {
    start = Date.now();
    if (loadSavedJwt()) {
        connectWebSocket();
        return;
    }

    RequestV2({
        url: 'https://sessionserver.mojang.com/session/minecraft/join',
        method: 'POST',
        body: {
            accessToken: Client.getMinecraft().getSession().getAccessToken(),
            selectedProfile: Player.getUUID().toString().replaceAll('-', ''),
            serverId: global.SESSION_SERVER_HASH,
        },
        resolveWithFullResponse: true,
    })
        .then((response) => {
            if (response.statusCode !== 204) {
                Chat.irc('Failed to authenticate with Mojang.');
            } else {
                login();
            }
        })
        .catch((e) => {
            Chat.irc('Login error: ' + JSON.stringify(e));
            console.error('Login error stack', e);
            attemptReconnect();
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
    } catch (e) {}
    if (!message || !message.startsWith('#')) return;

    sendChatMessage(message.substring(1).trim()); // remove space after # if you have it.

    cancel(event);
}).setFilteredClass(net.minecraft.network.packet.c2s.play.ChatMessageC2SPacket);

register('command', () => {
    reconnectAttempts = 0;
    attemptReconnect();
}).setCommandName('reconnectIRC');

connectIRC();
import { returnDiscord } from '../GUI/Utils';
returnDiscord(authToken);
