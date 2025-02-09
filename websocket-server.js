const WebSocket = require('ws');

class WebSocketServer {
    constructor() {
        this.wss = null;
        this.clients = new Set();
        this.onMessage = null;
    }

    start(port = 8082) {
        if (this.ws) {
            console.log('🔄 WebSocket already exists, closing previous connection');
            this.ws.close();
            this.ws = null;
        }

        try {
            this.wss = new WebSocket.Server({ port });
                console.log(`WebSocket server starting on port ${port}`);

            this.wss.on('connection', (ws) => {
                console.log('New client connected');
                this.clients.add(ws);

                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message.toString());
                        console.log('Received message:', data);
                        if (this.onMessage) {
                            this.onMessage(data);
                        }
                        this.broadcast(data);
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                });

                ws.on('close', () => {
                    console.log('Client disconnected');
                    this.clients.delete(ws);
                });

                // Request initial storage data
                ws.send(JSON.stringify({ type: 'GET_STORAGE' }));
            });

        } catch (error) {
            console.error('Error starting WebSocket server:', error);
        }
    }

    broadcast(message) {
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    stop() {
        if (this.wss) {
            console.log('Stopping WebSocket server');
            this.wss.close();
            this.wss = null;
            this.clients.clear();
        }
    }
}

module.exports = new WebSocketServer();