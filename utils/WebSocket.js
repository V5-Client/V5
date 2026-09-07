export default class WebSocket {
    constructor(address) {
        this.onMessage = () => {};
        this.onError = () => {};
        this.onOpen = () => {};
        this.onClose = () => {};

        this.socket = new JavaAdapter(
            org.java_websocket.client.WebSocketClient,
            {
                onMessage: (message) => this.onMessage(message),
                onError: (exception) => this.onError(exception),
                onOpen: (handshake) => this.onOpen(handshake),
                onClose: (code, reason, remote) => this.onClose(code, reason, remote),
            },
            new java.net.URI(address)
        );
    }

    send(message) {
        this.socket.send(message);
    }

    connect() {
        this.socket.connect();
    }

    close() {
        this.socket.close();
    }

    reconnect() {
        this.socket.reconnect();
    }
}
