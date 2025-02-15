const WebSocket = require('ws');
const net = require('net');

class WebSocketServer {
    constructor() {
        this.wss = null;
        this.clients = new Set();
        this.onMessage = null;
        this.port = 12380;
    }

    checkPortInUse(port) {
        return new Promise((resolve) => {
            const tester = net.createServer()
                .once('error', err => {
                    if (err.code === 'EADDRINUSE') {
                        resolve(true); // Puerto está en uso
                    } else {
                        resolve(false);
                    }
                })
                .once('listening', () => {
                    tester.once('close', () => resolve(false)) // Puerto está libre
                          .close();
                })
                .listen(port);
        });
    }

    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const testServer = new WebSocket.Server({ 
                port, 
                host: 'localhost' 
            }, (error) => {
                if (error) {
                    // Puerto no disponible
                    resolve(false);
                } else {
                    // Puerto disponible, cerrar el servidor de prueba
                    testServer.close(() => resolve(true));
                }
            });

            // Si hay error al crear el servidor, el puerto no está disponible
            testServer.on('error', () => {
                resolve(false);
            });
        });
    }

    async setPort(port) {
        if (!port || isNaN(port) || port < 1 || port > 65535) {
            console.error('Invalid port number:', port);
            return this;
        }
    
        this.port = parseInt(port);
        
        // Siempre detener el servidor actual si existe
        if (this.wss) {
            console.log(`Restarting WebSocket server with new port: ${this.port}`);
            this.stop();
        }
    
        // Intentar iniciar con el nuevo puerto
        try {
            await this.start();
        } catch (error) {
            console.error('Error starting server with new port:', error);
            // Intentar restaurar al puerto por defecto si hay error
            this.port = 12380;
            await this.start();
        }
        
        return this;
    }

    restart() {
        this.stop();
        setTimeout(() => {
            this.start();
        }, 1000); // Esperar 1 segundo antes de reiniciar
    }

    async start(port) {
        if (port) {
            this.setPort(port);
            return;
        }
    
        if (this.wss) {
            this.stop();
        }
    
        try {
            const portInUse = await this.checkPortInUse(this.port);
        
            if (portInUse) {
                const error = `Port ${this.port} is already in use`;
                console.error('❌', error);
                
                if (this.onMessage) {
                    this.onMessage({
                        type: 'SERVER_STATUS',
                        data: {
                            running: false,
                            error: error
                        }
                    });
                }
                // No retornar aquí, intentar con el puerto por defecto
                setTimeout(() => {
                    console.log('Reverting to default port...');
                    this.port = 12380;
                    this.start();
                    
                    // Notificar al usuario que se revirtió al puerto por defecto
                    if (this.onMessage) {
                        this.onMessage({
                            type: 'SERVER_STATUS',
                            data: {
                                running: true,
                                port: this.port,
                                message: 'Reverted to default port 12380'
                            }
                        });
                    }
                }, 3000);
                return;
            }
    
            this.wss = new WebSocket.Server({ 
                port: this.port,
                host: 'localhost',
                perMessageDeflate: false
            });
    
            console.log(`WebSocket server starting on port ${this.port}`);
    
            // Enviar estado inicial inmediatamente
            if (this.onMessage) {
                this.onMessage({
                    type: 'SERVER_STATUS',
                    data: {
                        running: true,
                        port: this.port
                    }
                });
            }

            console.log(`WebSocket server starting on port ${this.port}`);

            this.wss.on('error', (error) => {
                console.error('WebSocket Server Error:', error);
            });

            this.wss.on('connection', (ws) => {
                console.log('New client connected');
                this.clients.add(ws);

                ws.on('message', (message) => {
                    try {
                        let parsedData;
                        
                        // Asegurarnos que el mensaje es una cadena válida
                        if (typeof message === 'string') {
                            parsedData = JSON.parse(message);
                        } else if (Buffer.isBuffer(message)) {
                            parsedData = JSON.parse(message.toString());
                        } else {
                            parsedData = message;
                        }
                
                        console.log('Received message:', parsedData);
                        
                        if (this.onMessage) {
                            this.onMessage(parsedData);
                        }
                        
                        this.broadcast(parsedData);
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                });

                ws.on('close', () => {
                    console.log('Client disconnected');
                    this.clients.delete(ws);
                });

                ws.on('error', (error) => {
                    console.error('WebSocket Client Error:', error);
                    this.clients.delete(ws);
                });

                // Request initial storage data
                ws.send(JSON.stringify({ type: 'GET_STORAGE' }));
            });

        } catch (error) {
            console.error('Error starting WebSocket server:', error);
            // Notificar error
            if (this.onMessage) {
                this.onMessage({
                    type: 'SERVER_STATUS',
                    data: {
                        running: false,
                        error: error.message
                    }
                });
            }
            throw error; // Re-lanzar el error para manejarlo en la extensión
        }
    }

    broadcast(message) {
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Error broadcasting message:', error);
                    this.clients.delete(client);
                }
            }
        });
    }

    stop() {
        if (this.wss) {
            console.log('Stopping WebSocket server');
            
            // Cerrar todas las conexiones de clientes
            this.clients.forEach((client) => {
                try {
                    client.close();
                } catch (error) {
                    console.error('Error closing client connection:', error);
                }
            });
            
            this.clients.clear();

            // Cerrar el servidor
            this.wss.close(() => {
                console.log('WebSocket server closed');
            });
            
            this.wss = null;
        }
    }
}

module.exports = new WebSocketServer();