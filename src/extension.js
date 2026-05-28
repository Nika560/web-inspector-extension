const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { startLocalServer, deactivateServer, setTargetUrl } = require('./server');

function activate(context) {
    console.log('Web Inspector Extension is active.');

    // Start local server to receive element data and act as a transparent proxy
    startLocalServer();

    // Register open command
    let disposable = vscode.commands.registerCommand('web-inspector.open', function () {
        const panel = vscode.window.createWebviewPanel(
            'webInspector',
            'Web Inspector & CSS Extractor',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'webview-ui', 'dist'))
                ]
            }
        );

        panel.webview.html = getWebviewContent(panel, context);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'setTargetUrl') {
                setTargetUrl(message.url);
                console.log('Target URL updated to:', message.url);
            }
        });
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(panel, context) {
    const distPath = path.join(context.extensionPath, 'webview-ui', 'dist');
    const htmlPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(htmlPath)) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Web Inspector</title>
            <style>
                body { font-family: sans-serif; padding: 20px; background-color: #1e1e1e; color: #d4d4d4; text-align: center; }
                code { background: #2d2d2d; padding: 4px 8px; border-radius: 4px; color: #4fc1ff; }
            </style>
        </head>
        <body>
            <h3>Webview UI not built</h3>
            <p>Please build the project first by running:</p>
            <p><code>npm run build</code> inside the <code>webview-ui</code> directory.</p>
        </body>
        </html>`;
    }

    let html = fs.readFileSync(htmlPath, 'utf8');

    // Replace relative assets paths (Vite's default \`/assets/filename.ext\`) with VS Code Webview URIs
    html = html.replace(/(src|href)="\\/assets\\/([^"]+)"/g, (match, attr, fileName) => {
        const fileUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(distPath, 'assets', fileName)));
        return \`\${attr}="\${fileUri}"\`;
    });

    return html;
}

function deactivate() {
    deactivateServer();
}

module.exports = {
    activate,
    deactivate
}
