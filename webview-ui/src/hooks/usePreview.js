import { useState, useEffect, useCallback } from 'react';
import { vscodeService } from '../services/vscode';

const DEFAULT_URL = 'http://localhost:3000';
const PROXY_BASE_URL = 'http://localhost:3111/';

export function usePreview() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [previewSrc, setPreviewSrc] = useState(PROXY_BASE_URL);
  const [isInspectActive, setIsInspectActive] = useState(false);

  const loadUrl = useCallback(() => {
    if (!url) return;

    try {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;
      const pathname = parsedUrl.pathname;
      const search = parsedUrl.search;

      // Update proxy target to Origin only
      vscodeService.setTargetUrl(origin).then(() => {
        // Load iframe using proxy port + pathname + search
        const separator = search ? '&' : '?';
        setPreviewSrc(`http://localhost:3111${pathname}${search}${separator}_cb=${Date.now()}`);
      });
    } catch {
      // Fallback for incomplete/invalid URL
      vscodeService.setTargetUrl(url).then(() => {
        setPreviewSrc(`${PROXY_BASE_URL}?_cb=${Date.now()}`);
      });
    }
  }, [url]);

  const toggleInspect = useCallback(() => {
    setIsInspectActive(prev => {
      const nextState = !prev;
      const iframe = document.getElementById('previewFrame');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          command: 'toggleInspect',
          active: nextState
        }, '*');
      }
      return nextState;
    });
  }, []);

  const syncInspectState = useCallback(() => {
    const iframe = document.getElementById('previewFrame');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        command: 'toggleInspect',
        active: isInspectActive
      }, '*');
    }
  }, [isInspectActive]);

  // Sync initial URL on mount
  useEffect(() => {
    try {
      const parsedUrl = new URL(DEFAULT_URL);
      vscodeService.setTargetUrl(parsedUrl.origin);
    } catch {
      vscodeService.setTargetUrl(DEFAULT_URL);
    }
  }, []);

  // Listen to messages from the iframe (e.g. selection deactivated it)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data) {
        if (event.data.command === 'inspectDeactivated') {
          setIsInspectActive(false);
        } else if (event.data.command === 'toggleStateChanged') {
          setIsInspectActive(event.data.active);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return {
    url,
    setUrl,
    previewSrc,
    loadUrl,
    isInspectActive,
    toggleInspect,
    syncInspectState
  };
}
