/* global acquireVsCodeApi */

class VSCodeService {
  constructor() {
    this.vscode = null;
    try {
      this.vscode = acquireVsCodeApi();
    } catch {
      console.warn('VS Code API not found, running in browser fallback mode.');
    }
  }

  postMessage(message) {
    if (this.vscode) {
      this.vscode.postMessage(message);
    } else {
      console.log('[Dev Browser] Sent message to VS Code:', message);
    }
  }

  setTargetUrl(url) {
    if (this.vscode) {
      this.postMessage({
        command: 'setTargetUrl',
        url
      });
    }

    // Always update the proxy server directly via fetch to avoid race conditions
    return fetch('http://localhost:3111/set-target', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    })
    .then(res => res.json())
    .then(data => {
      console.log('Proxy target URL updated successfully via HTTP:', data.url);
      return data;
    })
    .catch(err => {
      console.error('Failed to update proxy target URL via HTTP:', err);
      // Fallback: resolve anyway to try reloading
      return null;
    });
  }
}

export const vscodeService = new VSCodeService();
