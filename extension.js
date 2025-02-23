const vscode = require('vscode');
const wsServer = require('./websocket-server');
const networkViewProvider = require('./network-view-provider');

// Configuración para ordenación de la red
let networkSortConfig = {
    field: 'startTime',     // Por defecto ordenar por tiempo de inicio
    direction: 'desc'       // Descendente (más nuevos primero)
};

function activate(context) {
    console.log('Extension "RNStorageManager" is now active!');

    let storageData = [];
    let networkData = []; // Para almacenar datos de red

    // Comando para ver el almacenamiento
    let disposableViewStorage = vscode.commands.registerCommand('extension.viewStorage', () => {
        const panel = vscode.window.createWebviewPanel(
            'storageViewer',
            'React Native Storage Viewer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        function updateWebview() {
            panel.webview.html = getWebviewContent(storageData);  // Solo cambia esta línea
            panel.webview.postMessage({
                type: 'SERVER_STATUS',
                data: {
                    running: wsServer.wss !== null,
                    port: wsServer.port
                }
            });
        }

        wsServer.onMessage = (messageData) => {
            try {
                if (!messageData) {
                    console.error('Received empty message');
                    return;
                }
                
                if (messageData.type === 'STORAGE_DATA' && messageData.data) {
                    storageData = messageData.data;
                    updateWebview();
                } else if (messageData.type === 'SERVER_STATUS') {
                    panel.webview.postMessage({
                        type: 'SERVER_STATUS',
                        data: messageData.data
                    });
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'clearNetworkHistory':
                        wsServer.broadcast({
                            type: 'NETWORK_EVENT',
                            eventType: 'CLEAR_NETWORK_HISTORY',
                            data: {}
                        });
                        // También limpiar los datos locales
                        networkData = [];
                        updateWebview();
                        break;
                    case 'refreshNetwork':
                        // Solicitar actualización explícita
                        wsServer.broadcast({
                            type: 'NETWORK_REFRESH'
                        });
                        // Después de 5 segundos, notificar finalización (en caso de que no haya respuesta)
                        setTimeout(() => {
                            panel.webview.postMessage({
                                type: 'REFRESH_COMPLETE'
                            });
                        }, 5000);
                        break;
                    case 'sortNetwork':
                        // Actualizar la configuración de ordenación
                        networkSortConfig = {
                            field: message.data.field || 'startTime',
                            direction: message.data.direction || 'desc'
                        };
                        
                        // Establecer el orden en el servidor
                        wsServer.setSortOrder(networkSortConfig.field, networkSortConfig.direction);
                        
                        // Solicitar nueva lista ordenada
                        networkData = wsServer.getAllNetworkRequests();
                        updateWebview(networkSortConfig);
                        break;
                    case 'updateStorage':
                        wsServer.broadcast({
                            type: 'UPDATE_VALUE',
                            data: message.data
                        });
                        break;
                    case 'deleteStorage':
                        wsServer.broadcast({
                            type: 'DELETE_VALUE',
                            data: message.data
                        });
                        break;
                    case 'refreshStorage':
                        wsServer.broadcast({
                            type: 'GET_STORAGE'
                        });
                        break;
                    case 'clearAllStorage':
                        wsServer.broadcast({
                            type: 'CLEAR_ALL_STORAGE'
                        });
                        break;
                    case 'changePort':
                        console.log('Changing port to:', message.data.port);
                        wsServer.setPort(message.data.port);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        wsServer.start();
        updateWebview();
    });

    // Nuevo comando para ver las solicitudes de red
    let disposableViewNetwork = vscode.commands.registerCommand('extension.viewNetwork', () => {
        const panel = vscode.window.createWebviewPanel(
            'networkViewer',
            'React Native Network Monitor',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        function updateWebview() {
            panel.webview.html = networkViewProvider.getNetworkWebviewContent(networkData);
            // Enviar el estado del servidor
            panel.webview.postMessage({
                type: 'SERVER_STATUS',
                data: {
                    running: wsServer.wss !== null,
                    port: wsServer.port
                }
            });
        }

        // Guardar el onMessage original
        const originalOnMessage = wsServer.onMessage;
        
        // Definir un nuevo manejador de mensajes
        wsServer.onMessage = (messageData) => {
            try {
                // Llamar al handler original para mantener funcionalidad existente
                if (originalOnMessage && messageData.type !== 'NETWORK_EVENT' && messageData.type !== 'NETWORK_HISTORY') {
                    originalOnMessage(messageData);
                }
                
                // Procesar mensajes relacionados con la red
                if (messageData.type === 'NETWORK_EVENT') {
                    const { eventType, data } = messageData;
                    
                    if (eventType === 'CLEAR_NETWORK_HISTORY') {
                        networkData = [];
                    } else if (data && data.id) {
                        // Actualizar o agregar la solicitud
                        const existingIndex = networkData.findIndex(req => req.id === data.id);
                        if (existingIndex >= 0) {
                            networkData[existingIndex] = data;
                        } else {
                            // Añadir al principio para mostrar los más recientes primero
                            networkData.unshift(data);
                        }
                        
                        // Limitar a 100 solicitudes por rendimiento
                        if (networkData.length > 100) {
                            networkData = networkData.slice(0, 100);
                        }
                    }
                    
                    updateWebview();
                } else if (messageData.type === 'NETWORK_HISTORY') {
                    // Actualizar todo el historial
                    networkData = messageData.data || [];
                    updateWebview();
                } else if (messageData.type === 'SERVER_STATUS') {
                    panel.webview.postMessage({
                        type: 'SERVER_STATUS',
                        data: messageData.data
                    });
                }
            } catch (error) {
                console.error('Error processing network message:', error);
            }
        };

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'clearNetworkHistory':
                        wsServer.broadcast({
                            type: 'NETWORK_EVENT',
                            eventType: 'CLEAR_NETWORK_HISTORY',
                            data: {}
                        });
                        // También limpiar los datos locales
                        networkData = [];
                        updateWebview();
                        break;
                    case 'refreshNetwork':
                        // Solicitar historial de red
                        networkData = wsServer.getAllNetworkRequests();
                        updateWebview();
                        break;
                    case 'changePort':
                        console.log('Changing port to:', message.data.port);
                        wsServer.setPort(message.data.port);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        panel.onDidDispose(() => {
            // Restaurar el handler original cuando se cierra el panel
            wsServer.onMessage = originalOnMessage;
        }, null, context.subscriptions);

        wsServer.start();
        
        // Inicializar con los datos existentes
        networkData = wsServer.getAllNetworkRequests();
        updateWebview();
    });

    let disposableSetPort = vscode.commands.registerCommand('extension.setStoragePort', async () => {
        const port = await vscode.window.showInputBox({
            prompt: "Enter port number",
            placeHolder: "12380"
        });
        
        if (port) {
            wsServer.setPort(parseInt(port));
        }
    });
    
    context.subscriptions.push(disposableViewStorage);
    context.subscriptions.push(disposableViewNetwork);
    context.subscriptions.push(disposableSetPort);
}

function deactivate() {
    wsServer.stop();
}

function getWebviewContent(data = []) {
    const formatValue = (value) => {
        try {
            const parsed = JSON.parse(value);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return value;
        }
    };

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>React Native Storage Viewer</title>
        <style>
            body { 
                padding: 20px; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { 
                display: flex; 
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            table { 
                table-layout: fixed; /* Esto es crucial */
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px;
            }
            th:first-child,
            .td_key {
                width: 150px; /* Ancho fijo en píxeles */
                max-width: 150px;
                min-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Ajustamos la columna de acciones */
            th:last-child,
            .controls {
                width: 200px;
                max-width: 200px;
                min-width: 200px;
            }
            th, td { 
                padding: 12px; 
                text-align: left; 
                border: 1px solid #ddd;
                vertical-align: top;
            }
            th { background-color: transparent; }
            .txt_area_value {
                width: 100%;
                min-height: 100px;
                max-height: 300px; /* Altura máxima */
                font-family: monospace;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                resize: vertical; /* Permite redimensionar solo verticalmente */
                overflow-y: auto; /* Scroll vertical */
                box-sizing: border-box;
            }
            button {
                padding: 8px 16px;
                background-color: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: #005999;
            }

            .btn_edit{
                background-color: #1bc020;
            }
            .btn_edit:hover{
                background-color: #12e212;
            }
            .btn_delete{
                background-color: #ef2222;
            }
            .btn_delete:hover{
                background-color: #d90f0f;
            }
            .btn_copy{
                background-color: #f0ce11;
            }
            .btn_copy:hover{
                background-color: #ecce56;
            }
            .controls {
                text-align: center;
                /* max-width: 50px; */
                width: 10%; /* Ancho fijo para la columna de acciones */
            }
            .controls button {
                display: inline-grid;
                margin: 5px auto;
            }
            .container-txt_area {
                width: auto;
                position: relative;
                padding: 10px;
            }
            .center { text-align: center;  }
            .td_key {
                width: 8%; /* Reducido de 15% a 8% */
                word-break: break-all;
                overflow-wrap: break-word;
            }

            .preview-container {
                white-space: pre-wrap;
                font-family: monospace;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
                min-height: 50px;     /* Reducido de 100px a 50px */
                max-height: 50px;    /* Reducido de 300px a 150px */
                overflow-y: auto; /* Scroll vertical */
                background-color: transparent;
                word-break: break-word; /* Rompe palabras largas */
                width: 100%;
                box-sizing: border-box;
            }

            .edit-mode .preview-container {
                display: none;
            }

            .edit-mode .txt_area_value {
                display: block;
            }

            .preview-mode .preview-container {
                display: block;
            }

            .preview-mode .txt_area_value {
                display: none;
            }

            .toggle-edit {
                position: absolute;
                right: 10px;
                top: 10px;
                background: #666;
                padding: 4px 8px;
                font-size: 12px;
            }

            /* Agregar en la sección de estilos */
            .server-running {
                background-color: rgba(27, 192, 32, 0.1);
                color: #1bc020;
            }

            .server-stopped {
                background-color: rgba(239, 34, 34, 0.1);
                color: #ef2222;
            }

            .dot-running {
                background-color: #1bc020;
            }

            .dot-stopped {
                background-color: #ef2222;
            }
            
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                 <div style="display: flex; align-items: center; gap: 10px;">
                    <button onclick="refreshStorage()">Refresh</button>
                    <button class="btn_delete" onclick="clearAllStorage()">Clear All</button>
                    <div style="display: flex; align-items: center; gap: 5px; margin-left: 15px; padding-left: 15px; border-left: 1px solid #ddd;">
                        <span>Port:</span>
                        <input 
                            type="number" 
                            id="portInput" 
                            placeholder="12380" 
                            style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"
                        />
                        <button onclick="changePort()" class="btn_edit" style="padding: 4px 8px;">
                            Apply
                        </button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px; margin-left: 15px; padding-left: 15px; border-left: 1px solid #ddd;">
                        <div id="serverStatus" style="display: flex; align-items: center; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 10px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; margin-right: 5px;" id="statusDot"></span>
                            <span id="statusText"></span>
                        </div>
                    </div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                        <th class="center">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td class="td_key">${item.key}</td>
                            <td class="container-txt_area preview-mode">
                                <div style="position: relative;">
                                    <button class="toggle-edit" onclick="toggleEditMode('${item.key}')">
                                        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                            <path fill-rule="evenodd" d="M4.998 7.78C6.729 6.345 9.198 5 12 5c2.802 0 5.27 1.345 7.002 2.78a12.713 12.713 0 0 1 2.096 2.183c.253.344.465.682.618.997.14.286.284.658.284 1.04s-.145.754-.284 1.04a6.6 6.6 0 0 1-.618.997 12.712 12.712 0 0 1-2.096 2.183C17.271 17.655 14.802 19 12 19c-2.802 0-5.27-1.345-7.002-2.78a12.712 12.712 0 0 1-2.096-2.183 6.6 6.6 0 0 1-.618-.997C2.144 12.754 2 12.382 2 12s.145-.754.284-1.04c.153-.315.365-.653.618-.997A12.714 12.714 0 0 1 4.998 7.78ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd"/>
                                        </svg>
                                    </button>
                                    <div class="preview-container">${formatValue(item.value)}</div>
                                    <textarea id="value-${item.key}" class="txt_area_value">${formatValue(item.value)}</textarea>
                                </div>
                            </td>
                            <td class="controls">
                                <button class="btn_edit" onclick="updateStorage('${item.key}')">
                                    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                        <path fill-rule="evenodd" d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.414A2 2 0 0 0 20.414 6L18 3.586A2 2 0 0 0 16.586 3H5Zm10 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 7V5h8v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z" clip-rule="evenodd"/>
                                      </svg>                                      
                                </button>
                                <button class="btn_delete" onclick="deleteStorage('${item.key}')">
                                    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                        <path fill-rule="evenodd" d="M8.586 2.586A2 2 0 0 1 10 2h4a2 2 0 0 1 2 2v2h3a1 1 0 1 1 0 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a1 1 0 0 1 0-2h3V4a2 2 0 0 1 .586-1.414ZM10 6h4V4h-4v2Zm1 4a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Zm4 0a1 1 0 1 0-2 0v8a1 1 0 1 0 2 0v-8Z" clip-rule="evenodd"/>
                                      </svg>
                                </button>
                                <button class="btn_copy" onclick="copyStorage('${item.key}')">
                                    <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                                        <path fill-rule="evenodd" d="M18 3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1V9a4 4 0 0 0-4-4h-3a1.99 1.99 0 0 0-1 .267V5a2 2 0 0 1 2-2h7Z" clip-rule="evenodd"/>
                                        <path fill-rule="evenodd" d="M8 7.054V11H4.2a2 2 0 0 1 .281-.432l2.46-2.87A2 2 0 0 1 8 7.054ZM10 7v4a2 2 0 0 1-2 2H4v6a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" clip-rule="evenodd"/>
                                      </svg>                                      
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <script>
            const vscode = acquireVsCodeApi();

            function updateStorage(key) {
                const value = document.getElementById('value-' + key).value;
                vscode.postMessage({
                    command: 'updateStorage',
                    data: { key, value }
                });
            }

            function deleteStorage(key) {
                vscode.postMessage({
                    command: 'deleteStorage',
                    data: { key }
                });
            }

            function refreshStorage() {
                vscode.postMessage({
                    command: 'refreshStorage'
                });
            }

            function clearAllStorage() {
                vscode.postMessage({
                    command: 'clearAllStorage'
                });
            }

            function copyStorage(key) {
                const value = document.getElementById('value-' + key).value;
                navigator.clipboard.writeText(value).then(function() {
                    console.log('Async: Copying to clipboard was successful!');
                }, function(err) {
                    console.error('Async: Could not copy text: ', err);
                });
            }

            function changePort() {
                const portInput = document.getElementById('portInput');
                const newPort = parseInt(portInput.value);

                portInput.value = '';
                
                if (newPort && newPort > 0 && newPort < 65536) {
                    vscode.postMessage({
                        command: 'changePort',
                        data: { port: newPort }
                    });
                } else {
                    alert('Please enter a valid port number (1-65535)');
                }
            }

            function toggleEditMode(key) {
                const container = document.querySelector(\`#value-\${key}\`).parentElement.parentElement;
                const button = container.querySelector('.toggle-edit');
                const isEditMode = container.classList.contains('edit-mode');
                
                if (isEditMode) {
                    container.classList.remove('edit-mode');
                    container.classList.add('preview-mode');
                    button.innerHTML = \`
                        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                            <path fill-rule="evenodd" d="M4.998 7.78C6.729 6.345 9.198 5 12 5c2.802 0 5.27 1.345 7.002 2.78a12.713 12.713 0 0 1 2.096 2.183c.253.344.465.682.618.997.14.286.284.658.284 1.04s-.145.754-.284 1.04a6.6 6.6 0 0 1-.618.997 12.712 12.712 0 0 1-2.096 2.183C17.271 17.655 14.802 19 12 19c-2.802 0-5.27-1.345-7.002-2.78a12.712 12.712 0 0 1-2.096-2.183 6.6 6.6 0 0 1-.618-.997C2.144 12.754 2 12.382 2 12s.145-.754.284-1.04c.153-.315.365-.653.618-.997A12.714 12.714 0 0 1 4.998 7.78ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd"/>
                        </svg>

                    \`;
                } else {
                    container.classList.add('edit-mode');
                    container.classList.remove('preview-mode');
                    button.innerHTML = \`
                        <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                            <path d="m4 15.6 3.055-3.056A4.913 4.913 0 0 1 7 12.012a5.006 5.006 0 0 1 5-5c.178.009.356.027.532.054l1.744-1.744A8.973 8.973 0 0 0 12 5.012c-5.388 0-10 5.336-10 7A6.49 6.49 0 0 0 4 15.6Z"/>
                            <path d="m14.7 10.726 4.995-5.007A.998.998 0 0 0 18.99 4a1 1 0 0 0-.71.305l-4.995 5.007a2.98 2.98 0 0 0-.588-.21l-.035-.01a2.981 2.981 0 0 0-3.584 3.583c0 .012.008.022.01.033.05.204.12.402.211.59l-4.995 4.983a1 1 0 1 0 1.414 1.414l4.995-4.983c.189.091.386.162.59.211.011 0 .021.007.033.01a2.982 2.982 0 0 0 3.584-3.584c0-.012-.008-.023-.011-.035a3.05 3.05 0 0 0-.21-.588Z"/>
                            <path d="m19.821 8.605-2.857 2.857a4.952 4.952 0 0 1-5.514 5.514l-1.785 1.785c.767.166 1.55.25 2.335.251 6.453 0 10-5.258 10-7 0-1.166-1.637-2.874-2.179-3.407Z"/>
                        </svg>
                    \`;
                }
            }

            // Agregar al final del script
            function updateServerStatus(isRunning, port, error) {
                const statusContainer = document.getElementById('serverStatus');
                const statusDot = document.getElementById('statusDot');
                const statusText = document.getElementById('statusText');
                const portInput = document.getElementById('portInput');
                
                if (error) {
                    statusContainer.className = 'server-stopped';
                    statusDot.className = 'dot-stopped';
                    statusText.textContent = error;
                    portInput.placeholder = '12380';
                    return;
                }
                
                if (isRunning) {
                    statusContainer.className = 'server-running';
                    statusDot.className = 'dot-running';
                    statusText.textContent = 'Server running on port ' + port;
                    portInput.placeholder = port.toString();
                } else {
                    statusContainer.className = 'server-stopped';
                    statusDot.className = 'dot-stopped';
                    statusText.textContent = 'Server stopped';
                }
            }

            // Agregar el listener de mensajes
            window.addEventListener('message', event => {
                const message = event.data;
                if (message?.type === 'SERVER_STATUS') {
                    updateServerStatus(
                        message.data.running, 
                        message.data.port,
                        message.data.error
                    );
                }
            });
        </script>
    </body>
    </html>`;
}

module.exports = {
    activate,
    deactivate
};