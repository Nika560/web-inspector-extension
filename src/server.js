const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

let vscode = null;
try {
    vscode = require('vscode');
} catch (e) {
    // running in standalone node mode
}

let server = null;
const PORT = 3111;
const OUTPUT_FILE_PATH = path.join('C:', 'Users', 'nguye', '.gemini', 'antigravity-ide', 'scratch', 'inspect_css.json');
let targetBaseUrl = 'http://localhost:3000'; // Default target

function setTargetUrl(url) {
    targetBaseUrl = url;
}

function startLocalServer() {
    if (server) {
        return;
    }

    server = http.createServer((req, res) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Serve inspector.js from static directory
        if (req.method === 'GET' && req.url === '/inspector.js') {
            const inspectorScriptPath = path.join(__dirname, '..', 'static', 'inspector.js');
            fs.readFile(inspectorScriptPath, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error loading inspector script');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(data);
            });
            return;
        }

        // Handle URL updates directly via HTTP (useful in standalone mode)
        if (req.method === 'POST' && req.url === '/set-target') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.url) {
                        targetBaseUrl = data.url;
                        console.log('Target URL updated via HTTP to:', targetBaseUrl);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'success', url: targetBaseUrl }));
                    } else {
                        res.writeHead(400);
                        res.end('Missing url');
                    }
                } catch (e) {
                    res.writeHead(400);
                    res.end('Invalid JSON');
                }
            });
            return;
        }

        // Handle element data sent from client
        if (req.method === 'POST' && req.url === '/element') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    // Write to the shared scratch file for the Agent to access
                    fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');

                    // Format prompt containing both HTML and CSS
                    const prompt = `Here is the inspected element <${data.tagName}>:\n\nHTML:\n\`\`\`html\n${data.outerHTML}\n\`\`\`\n\nCSS:\n\`\`\`css\n${data.css}\n\`\`\``;

                    // Copy prompt to clipboard so it can be pasted anywhere
                    if (vscode) {
                        vscode.env.clipboard.writeText(prompt).then(() => {
                            console.log('Prompt copied to clipboard');
                        });

                        // Open VS Code Chat / Continue Chat and send the prompt
                        const openChatWithOptions = () => {
                            return vscode.commands.executeCommand('workbench.action.chat.open', {
                                query: prompt,
                                isPartialQuery: true
                            });
                        };

                        const openChatWithDirectString = () => {
                            return vscode.commands.executeCommand('workbench.action.chat.open', prompt);
                        };

                        const focusContinueChat = () => {
                            return vscode.commands.executeCommand('continue.focusContinueInputWithoutClear');
                        };

                        openChatWithOptions()
                            .catch(() => openChatWithDirectString())
                            .catch(() => focusContinueChat())
                            .then(() => {
                                vscode.window.showInformationMessage(`Inspected element sent to AI Agent & copied to clipboard!`);
                            })
                            .catch((err) => {
                                console.error('Failed to open chat window:', err);
                                vscode.window.showInformationMessage(`Copied inspected element to clipboard! Paste it into your AI chat.`);
                            });
                    } else {
                        console.log('--- ELEMENT INSPECTED (Standalone Mode) ---');
                        console.log('Tag:', data.tagName);
                        // Copy to clipboard on Windows in standalone mode
                        try {
                            const tempFile = path.join(__dirname, 'temp_prompt.txt');
                            fs.writeFileSync(tempFile, prompt, 'utf8');
                            const { exec } = require('child_process');
                            exec(`clip < "${tempFile}"`, (err) => {
                                if (err) {
                                    console.error('Failed to copy to clipboard in standalone mode:', err);
                                } else {
                                    console.log('Prompt successfully copied to clipboard (Standalone Mode)');
                                }
                                try { fs.unlinkSync(tempFile); } catch (e) {}
                            });
                        } catch (clipErr) {
                            console.error('Error during standalone clipboard copy:', clipErr);
                        }
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success' }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Invalid JSON');
                }
            });
            return;
        }

        // Proxy all other requests to the target URL safely
        try {
            const parsedReqUrl = new URL(req.url, 'http://dummy.com');
            const targetUrlObj = new URL(targetBaseUrl);
            
            // Correctly join the target pathname and the request pathname
            let targetPathname = targetUrlObj.pathname;
            if (targetPathname.endsWith('/') && parsedReqUrl.pathname.startsWith('/')) {
                targetUrlObj.pathname = targetPathname + parsedReqUrl.pathname.slice(1);
            } else if (!targetPathname.endsWith('/') && !parsedReqUrl.pathname.startsWith('/')) {
                targetUrlObj.pathname = targetPathname + '/' + parsedReqUrl.pathname;
            } else {
                targetUrlObj.pathname = targetPathname + parsedReqUrl.pathname;
            }
            
            targetUrlObj.search = parsedReqUrl.search;

            const proxyHeaders = { ...req.headers };
            delete proxyHeaders['host'];
            delete proxyHeaders['accept-encoding'];

            const clientModule = targetUrlObj.protocol === 'https:' ? https : http;

            const proxyReq = clientModule.request(targetUrlObj, {
                method: req.method,
                headers: proxyHeaders
            }, (proxyRes) => {
                const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();

                const responseHeaders = { ...proxyRes.headers };
                delete responseHeaders['x-frame-options'];
                delete responseHeaders['content-security-policy'];

                if (contentType.includes('text/html')) {
                    let htmlData = '';
                    proxyRes.on('data', (chunk) => {
                        htmlData += chunk.toString();
                    });
                    proxyRes.on('end', () => {
                        const scriptTag = `<script src="http://localhost:${PORT}/inspector.js"></script>`;
                        let modifiedHtml = htmlData;
                        if (htmlData.includes('</body>')) {
                            modifiedHtml = htmlData.replace('</body>', `${scriptTag}</body>`);
                        } else {
                            modifiedHtml = htmlData + scriptTag;
                        }
                        
                        delete responseHeaders['content-length'];
                        res.writeHead(proxyRes.statusCode, responseHeaders);
                        res.end(modifiedHtml);
                    });
                } else {
                    res.writeHead(proxyRes.statusCode, responseHeaders);
                    proxyRes.pipe(res);
                }
            });

            proxyReq.on('error', (err) => {
                res.writeHead(502, { 'Content-Type': 'text/plain' });
                res.end(`Proxy Error: Could not connect to target URL ${targetBaseUrl}. Make sure your local server is running!`);
            });

            req.pipe(proxyReq);
        } catch (err) {
            res.writeHead(400);
            res.end('Invalid URL');
        }
    });

    server.listen(PORT, () => {
        console.log(`Inspector server running at http://localhost:${PORT}`);
    });
}

function deactivateServer() {
    if (server) {
        server.close();
        server = null;
    }
}

module.exports = {
    startLocalServer,
    deactivateServer,
    setTargetUrl
};
