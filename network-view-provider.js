// network-view-provider.js
const vscode = require('vscode');

// Funciones auxiliares para formatear datos en la vista
function getStatusColor(status) {
    if (!status) return '#888888'; // Pendiente
    if (status >= 200 && status < 300) return '#1bc020'; // Éxito
    if (status >= 300 && status < 400) return '#f0ce11'; // Redirección
    if (status >= 400) return '#ef2222'; // Error
    return '#888888';
}

function getDuration(startTime, endTime) {
    if (!startTime || !endTime) {
        return 'Pending...';
    }
    return `${endTime - startTime}ms`;
}

function getContentType(headers) {
    if (!headers) return '';
    const contentType = headers['content-type'] || headers['Content-Type'];
    if (!contentType) return '';
    
    // Extraer el tipo MIME principal
    const parts = contentType.split(';');
    return parts[0].trim();
}

function truncateAndMakeExpandable(text, maxLength = 100) {
    if (!text || text.length <= maxLength) {
        return text;
    }
    
    const id = `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return `
        <div class="expandable-content" id="${id}">
            ${text}
        </div>
        <a class="expand-collapse" onclick="toggleExpand(this)">Show more</a>
    `;
}

function formatHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
        return '';
    }
    
    return Object.keys(headers)
        .map(key => {
            const value = headers[key];
            // Si es un encabezado de autorización o es muy largo, truncarlo
            if (key.toLowerCase() === 'authorization' || (typeof value === 'string' && value.length > 100)) {
                return `<div class="request-headers"><strong>${key}:</strong> ${truncateAndMakeExpandable(value)}</div>`;
            }
            return `<div class="request-headers"><strong>${key}:</strong> ${value}</div>`;
        })
        .join('');
}

function formatBody(body, contentType) {
    if (!body) {
        return '';
    }
    
    try {
        // Intentar formatear como JSON si parece ser JSON
        if (typeof body === 'string' && 
            (body.startsWith('{') || body.startsWith('[')) && 
            (contentType && contentType.includes('json'))) {
            const parsed = JSON.parse(body);
            return JSON.stringify(parsed, null, 2);
        }
    } catch (e) {
        // Si falla, devolver como texto plano
    }
    
    return String(body);
}

function getNetworkWebviewContent(data = []) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>React Native Network Monitor</title>
        <style>
            body, html { 
                padding: 0; 
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #1e1e1e;
                color: #e0e0e0;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            .container { 
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .header { 
                display: flex; 
                justify-content: flex-start;
                align-items: center;
                padding: 20px 20px;

                border-bottom: 1px solid #444;
                flex-shrink: 0;
            }
            .table-container {
                flex: 1;
                overflow: auto;
                width: 100%;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                table-layout: fixed;
            }
            th, td { 
                padding: 8px 12px; 
                text-align: left; 
                border-bottom: 1px solid #444;
            }
            th { 
                position: sticky;
                top: 0;
                background-color: #252525;
                z-index: 10;
            }
            
            /* Anchos de columnas */
            .method-column {
                width: 80px;
            }
            .url-column {
                width: auto; /* Toma el espacio restante */
            }
            .status-column {
                width: 80px;
            }
            .type-column {
                width: 120px;
            }
            .time-column {
                width: 80px;
            }
            
            .url-cell {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .status-badge {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 5px;
            }
            .request-row {
                cursor: pointer;
                background-color: #1e1e1e;
            }
            .request-row:hover {
                background-color: #252525;
            }
            .request-details {
                display: none;
                padding: 15px;
                background-color: #1e1e1e; 
                color: #e0e0e0;
                border-bottom: 1px solid #444;
            }
            .details-visible {
                display: table-row;
            }
            .details-section {
                margin-bottom: 15px;
            }
            .details-header {
                font-weight: bold;
                margin-bottom: 5px;
                padding-bottom: 5px;
                border-bottom: 1px solid #444;
                color: #e0e0e0;
            }
            .tabs {
                display: flex;
                margin-bottom: 15px;
                border-bottom: 1px solid #444;
            }
            .tab {
                padding: 8px 16px;
                cursor: pointer;
                border: 1px solid transparent;
                border-bottom: none;
                margin-right: 5px;
                color: #e0e0e0;
            }
            .tab.active {
                background-color: #2d2d2d;
                border-color: #444;
                border-radius: 4px 4px 0 0;
            }
            .tab-content {
                display: none;
                padding: 15px;
                background-color: #2d2d2d;
                border-radius: 0 0 4px 4px;
                overflow-x: auto;
            }
            .tab-content.active {
                display: block;
            }
            .code-block {
                font-family: monospace;
                white-space: pre-wrap;
                padding: 10px;
                background-color: #2d2d2d;
                color: #e0e0e0;
                border-radius: 4px;
                overflow-x: auto;
                max-width: 100%;
            }
            button {
                padding: 8px 16px;
                background-color: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                margin-right: 8px;
            }
            button:hover {
                background-color: #005999;
            }
            .btn_delete{
                background-color: #ef2222;
            }
            .btn_delete:hover{
                background-color: #d90f0f;
            }
            .server-running {
                background-color: rgba(27, 192, 32, 0.1);
                color: #1bc020;
                padding: 5px 10px;
                border-radius: 4px;
            }
            .server-stopped {
                background-color: rgba(239, 34, 34, 0.1);
                color: #ef2222;
                padding: 5px 10px;
                border-radius: 4px;
            }
            .dot-running {
                background-color: #1bc020;
            }
            .dot-stopped {
                background-color: #ef2222;
            }
            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                color: #888;
                padding: 20px;
            }
            .method {
                font-weight: bold;
            }
            .method-GET { color: #2196F3; }
            .method-POST { color: #4CAF50; }
            .method-PUT { color: #FF9800; }
            .method-DELETE { color: #F44336; }
            .method-PATCH { color: #9C27B0; }
            
            .request-headers {
                word-break: break-all;
            }
            
            .expandable-content {
                max-height: 100px;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }
            
            .expandable-content.expanded {
                max-height: none;
            }
            
            .expand-collapse {
                cursor: pointer;
                color: #007acc;
                margin-top: 5px;
                display: inline-block;
            }

            input[type="number"] {
                background-color: #3c3c3c;
                color: #e0e0e0;
                border: 1px solid #555;
                padding: 5px;
                border-radius: 4px;
                width: 80px;
            }
            
            .port-control {
                display: flex;
                align-items: center;
                margin-left: 20px;
                padding-left: 20px;
                border-left: 1px solid #444;
            }
            
            .port-control span {
                margin-right: 5px;
            }
            
            .server-status {
                display: flex;
                align-items: center;
                margin-left: 20px;
                padding-left: 20px;
                border-left: 1px solid #444;
            }
            
            td.details-cell {
                padding: 0;
            }
            
            .details-content {
                padding: 15px;
            }
            
            /* Aseguramos que los detalles ocupen todo el ancho */
            tr.details-row {
                width: 100%;
                display: table-row;
            }
            
            tr.details-row td {
                width: 100%;
                display: table-cell;
            }
            
            .details-content {
                width: 100%;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <button onclick="refreshNetwork()">Refresh</button>
                <button class="btn_delete" onclick="clearNetworkHistory()">Clear All</button>
                
                <div class="port-control">
                    <span>Port:</span>
                    <input type="number" id="portInput" placeholder="12380" style="width: 80px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;" />
                    &nbsp;
                    <button onclick="changePort()" style="background-color: #12e212; padding: 4px 8px;">Apply</button>
                </div>
                
                <div class="server-status">
                    <div id="serverStatus">
                        <span style="width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; display: inline-block;" id="statusDot"></span>
                        <span id="statusText"></span>
                    </div>
                </div>
            </div>
            
            ${data.length === 0 ? 
                `<div class="empty-state">
                    <h3>No network requests captured yet</h3>
                    <p>Network requests will appear here once your React Native app makes them.</p>
                </div>` :
                `<div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th class="method-column">Method</th>
                                <th class="url-column">URL</th>
                                <th class="status-column">Status</th>
                                <th class="type-column">Type</th>
                                <th class="time-column">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((request, index) => `
                                <tr class="request-row" data-request-id="${request.id}" onclick="toggleDetails(${request.id})">
                                    <td class="method-column"><span class="method method-${request.method}">${request.method}</span></td>
                                    <td class="url-column"><div class="url-cell" title="${request.url}">${request.url}</div></td>
                                    <td class="status-column">
                                        <span class="status-badge" style="background-color: ${getStatusColor(request.status)};"></span>
                                        ${request.status || 'Pending'}
                                    </td>
                                    <td class="type-column">${getContentType(request.headers)}</td>
                                    <td class="time-column">${getDuration(request.startTime, request.endTime)}</td>
                                </tr>
                                <tr id="details-row-${request.id}" class="details-row" style="display: none;">
                                    <td colspan="5" class="details-cell">
                                        <div class="details-content">
                                            <div class="tabs">
                                                <div class="tab active" onclick="showTab(${request.id}, 'headers')">Headers</div>
                                                <div class="tab" onclick="showTab(${request.id}, 'request')">Request</div>
                                                <div class="tab" onclick="showTab(${request.id}, 'response')">Response</div>
                                            </div>
                                            
                                            <div id="tab-${request.id}-headers" class="tab-content active">
                                                <div class="details-section">
                                                    <div class="details-header">General</div>
                                                    <div>
                                                        <div><strong>Request URL:</strong> ${request.url}</div>
                                                        <div><strong>Request Method:</strong> ${request.method}</div>
                                                        <div><strong>Status Code:</strong> ${request.status || 'Pending'}</div>
                                                    </div>
                                                </div>
                                                <div class="details-section">
                                                    <div class="details-header">Request Headers</div>
                                                    <div>${formatHeaders(request.headers)}</div>
                                                </div>
                                            </div>
                                            
                                            <div id="tab-${request.id}-request" class="tab-content">
                                                <div class="details-section">
                                                    <div class="details-header">Request Body</div>
                                                    <pre class="code-block">${formatBody(request.requestBody, getContentType(request.headers))}</pre>
                                                </div>
                                            </div>
                                            
                                            <div id="tab-${request.id}-response" class="tab-content">
                                                <div class="details-section">
                                                    <div class="details-header">Response Body</div>
                                                    <pre class="code-block">${formatBody(request.responseBody, getContentType(request.headers))}</pre>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`
            }
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            
            function toggleDetails(requestId) {
                const detailsRow = document.getElementById('details-row-' + requestId);
                if (detailsRow.style.display === 'none') {
                    detailsRow.style.display = 'table-row';
                } else {
                    detailsRow.style.display = 'none';
                }
            }
            
            function showTab(requestId, tabName) {
                // Obtener todas las pestañas para este request
                const tabContainer = document.querySelector('#details-row-' + requestId + ' .tabs');
                const tabs = tabContainer.querySelectorAll('.tab');
                
                // Desactivar todas las pestañas
                tabs.forEach(tab => tab.classList.remove('active'));
                
                // Ocultar todos los contenidos de las pestañas
                const tabContents = document.querySelectorAll('[id^="tab-' + requestId + '"]');
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Activar la pestaña seleccionada
                event.target.classList.add('active');
                
                // Mostrar el contenido de la pestaña seleccionada
                const contentElement = document.getElementById('tab-' + requestId + '-' + tabName);
                contentElement.classList.add('active');
            }
            
            function clearNetworkHistory() {
                vscode.postMessage({
                    command: 'clearNetworkHistory'
                });
            }
            
            function refreshNetwork() {
                vscode.postMessage({
                    command: 'refreshNetwork'
                });
            }
            
            function changePort() {
                const portInput = document.getElementById('portInput');
                const newPort = parseInt(portInput.value);
                
                if (newPort && newPort > 0 && newPort < 65536) {
                    vscode.postMessage({
                        command: 'changePort',
                        data: { port: newPort }
                    });
                    portInput.value = '';
                } else {
                    alert('Please enter a valid port number (1-65535)');
                }
            }
            
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
            
            // Función para expandir/colapsar contenido
            function toggleExpand(element) {
                const content = element.previousElementSibling;
                content.classList.toggle('expanded');
                element.textContent = content.classList.contains('expanded') ? 'Show less' : 'Show more';
            }
            
            // Listener de mensajes
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

            // Ajustar altura inicial
            function setInitialHeight() {
                const container = document.querySelector('.container');
                const header = document.querySelector('.header');
                const tableContainer = document.querySelector('.table-container');
                
                if (container && header && tableContainer) {
                    tableContainer.style.height = (container.offsetHeight - header.offsetHeight) + 'px';
                }
            }
            
            window.addEventListener('load', setInitialHeight);
            window.addEventListener('resize', setInitialHeight);
        </script>
    </body>
    </html>`;
}

module.exports = {
    getNetworkWebviewContent,
    formatHeaders,
    formatBody,
    getStatusColor,
    getDuration,
    getContentType
};