const WebSocket = require('ws');
const net = require('net');

class WebSocketServer {
    constructor() {
        this.wss = null;
        this.clients = new Set();
        this.onMessage = null;
        this.port = 12380;
        this.networkRequests = new Map(); // Para almacenar solicitudes de red
        this.sortField = 'startTime'; // Campo por defecto para ordenación
        this.sortDirection = 'desc'; // Dirección por defecto (descendente = más nuevo primero)
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
                        
                        // Manejar eventos de red
                        if (parsedData.type === 'NETWORK_EVENT') {
                            this.handleNetworkEvent(parsedData);
                        } else if (parsedData.type === 'NETWORK_SORT') {
                            // Manejar solicitud de ordenación
                            this.setSortOrder(parsedData.data.field, parsedData.data.direction);
                            this.broadcast({
                                type: 'NETWORK_HISTORY',
                                data: this.getAllNetworkRequests()
                            });
                        } else if (parsedData.type === 'NETWORK_REFRESH') {
                            // Solicitar actualización al cliente
                            this.broadcast({
                                type: 'REQUEST_REFRESH'
                            });
                        }
                        
                        if (this.onMessage) {
                            this.onMessage(parsedData);
                        }
                        
                        // No difundir ciertos mensajes que son específicos para cada cliente
                        if (parsedData.type !== 'NETWORK_SORT' && parsedData.type !== 'NETWORK_REFRESH') {
                            this.broadcast(parsedData);
                        }
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
                
                // Enviar solicitudes de red existentes
                if (this.networkRequests.size > 0) {
                    ws.send(JSON.stringify({
                        type: 'NETWORK_HISTORY',
                        data: this.getAllNetworkRequests()
                    }));
                }
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

    // Nuevo método para manejar eventos de red
    handleNetworkEvent(message) {
        const { eventType, data } = message;
        
        if (!data || !data.id) {
            return;
        }
        
        switch (eventType) {
            case 'REQUEST_STARTED':
                // Almacenar nueva solicitud
                this.networkRequests.set(data.id, data);
                break;
                
            case 'REQUEST_COMPLETED':
            case 'REQUEST_FAILED':
            case 'REQUEST_ABORTED':
                // Actualizar solicitud existente
                if (this.networkRequests.has(data.id)) {
                    this.networkRequests.set(data.id, data);
                }
                break;
            case 'CLEAR_NETWORK_HISTORY':
                console.log('🧹 Clearing network history');
                this.networkRequests.clear();
                // Notificar a todos los clientes que el historial se ha limpiado
                this.broadcast({
                    type: 'NETWORK_EVENT',
                    eventType: 'CLEAR_NETWORK_HISTORY',
                    data: {}
                });
                break;
        }
        
        // Limitar el tamaño del historial (mantener máximo 100 solicitudes)
        if (this.networkRequests.size > 100) {
            const oldestKeys = Array.from(this.networkRequests.keys()).slice(0, this.networkRequests.size - 100);
            oldestKeys.forEach(key => this.networkRequests.delete(key));
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

    // Método para obtener todas las solicitudes de red
    getAllNetworkRequests() {
        const requests = Array.from(this.networkRequests.values());
        
        // Aplicar ordenación
        return requests.sort((a, b) => {
            // Primero comprobar si el campo existe en ambos objetos
            const valA = a[this.sortField] !== undefined ? a[this.sortField] : '';
            const valB = b[this.sortField] !== undefined ? b[this.sortField] : '';
            
            // Calcular la comparación según el tipo de datos
            let comparison = 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else {
                // Convertir a cadena para comparación
                const strA = String(valA);
                const strB = String(valB);
                comparison = strA.localeCompare(strB);
            }
            
            // Aplicar la dirección de ordenación
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    }
    
    // Método para limpiar el historial de red
    clearNetworkHistory() {
        this.networkRequests.clear();
        this.broadcast({
            type: 'NETWORK_EVENT',
            eventType: 'CLEAR_NETWORK_HISTORY',
            data: {}
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

    handleNetworkEvent(message) {
        const { eventType, data } = message;
        
        if (!data) {
            return;
        }
        
        switch (eventType) {
            case 'REQUEST_STARTED':
                // Almacenar nueva solicitud si tiene un ID
                if (data.id) {
                    console.log(`🌐 Network request started: ${data.method} ${data.url}`);
                    this.networkRequests.set(data.id, data);
                    // Notificar a todos los clientes sobre la nueva solicitud
                    this.broadcast({
                        type: 'NETWORK_UPDATE',
                        eventType: 'REQUEST_ADDED',
                        data
                    });
                }
                break;
                
            case 'REQUEST_COMPLETED':
            case 'REQUEST_FAILED':
            case 'REQUEST_ABORTED':
            case 'REQUEST_PENDING':
                // Actualizar solicitud existente
                if (data.id) {
                    const existingRequest = this.networkRequests.get(data.id);
                    if (existingRequest) {
                        console.log(`🌐 Network request updated: ${data.method} ${data.url} - Status: ${data.status}`);
                        // Actualizar solo los campos nuevos para preservar datos existentes
                        Object.assign(existingRequest, data);
                        this.networkRequests.set(data.id, existingRequest);
                    } else {
                        console.log(`🌐 Network request completed (new): ${data.method} ${data.url}`);
                        this.networkRequests.set(data.id, data);
                    }
                    
                    // Notificar a todos los clientes
                    this.broadcast({
                        type: 'NETWORK_UPDATE',
                        eventType: 'REQUEST_UPDATED',
                        data
                    });
                }
                break;
                
            case 'CLEAR_NETWORK_HISTORY':
                // Limpiar historial
                console.log(`🧹 Network history cleared`);
                this.networkRequests.clear();
                this.broadcast({
                    type: 'NETWORK_UPDATE',
                    eventType: 'HISTORY_CLEARED',
                    data: {}
                });
                break;
                
            case 'REQUEST_REFRESH':
                console.log(`🔄 Network refresh requested`);
                // Reenviar la solicitud a todos los clientes
                this.broadcast({
                    type: 'REQUEST_REFRESH'
                });
                break;
        }
        
        // Limitar el tamaño del historial (mantener máximo 1000 solicitudes)
        if (this.networkRequests.size > 1000) {
            // Ordenar por hora de inicio para mantener las más recientes
            const sortedEntries = Array.from(this.networkRequests.entries())
                .sort(([, a], [, b]) => b.startTime - a.startTime);
            
            // Eliminar las solicitudes más antiguas
            const entriesToRemove = sortedEntries.slice(1000);
            entriesToRemove.forEach(([key]) => this.networkRequests.delete(key));
        }
    }

    setSortOrder(field, direction) {
        if (field) this.sortField = field;
        if (direction) this.sortDirection = direction;
        console.log(`Set sort order: ${this.sortField} ${this.sortDirection}`);
    }

    
}

module.exports = new WebSocketServer();