const vscode = require('vscode');
const wsServer = require('./websocket-server');

function activate(context) {
    console.log('Extension "RNStorageManager" is now active!');

    let storageData = [];

    let disposable = vscode.commands.registerCommand('extension.viewStorage', () => {
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
            panel.webview.html = getWebviewContent(storageData);
        }

        wsServer.onMessage = (message) => {
            console.log('Received message from RN:', message);
            if (message.type === 'STORAGE_DATA') {
                storageData = message.data;
                updateWebview();
            }
        };

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'updateStorage':
                        wsServer.broadcast({
                            type: 'UPDATE_VALUE',
                            data: message.data
                        });
                        break;
                    case 'refreshStorage':
                        wsServer.broadcast({
                            type: 'GET_STORAGE'
                        });
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        wsServer.start();
        updateWebview();
    });

    context.subscriptions.push(disposable);
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
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px;
            }
            th, td { 
                padding: 12px; 
                text-align: left; 
                border: 1px solid #ddd;
                vertical-align: top;
            }
            th { background-color: #f5f5f5; }
            textarea {
                width: 100%;
                min-height: 100px;
                font-family: monospace;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 4px;
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
            .controls {
                margin-top: 8px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>React Native Storage Viewer</h1>
                <button onclick="refreshStorage()">Refresh</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Key</th>
                        <th>Value</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>${item.key}</td>
                            <td>
                                <textarea id="value-${item.key}">${formatValue(item.value)}</textarea>
                            </td>
                            <td class="controls">
                                <button onclick="updateStorage('${item.key}')">Update</button>
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

            function refreshStorage() {
                vscode.postMessage({
                    command: 'refreshStorage'
                });
            }
        </script>
    </body>
    </html>`;
}

module.exports = {
    activate,
    deactivate
};