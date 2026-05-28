(function() {
    // Prevent double injection
    if (window.__webInspectorInitialized) return;
    window.__webInspectorInitialized = true;

    console.log("Web Inspector Script Loaded! Press Alt+Shift+I to toggle Inspect Mode.");

    let active = false;
    let hoveredElement = null;

    // Create high-fidelity hover overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '999999';
    overlay.style.border = '2px solid rgba(14, 99, 156, 0.8)';
    overlay.style.backgroundColor = 'rgba(14, 99, 156, 0.1)';
    overlay.style.transition = 'all 0.1s ease';
    overlay.style.display = 'none';
    document.body.appendChild(overlay);

    // Overlay label for element tag name and class
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.background = '#0e639c';
    label.style.color = '#ffffff';
    label.style.fontSize = '11px';
    label.style.fontFamily = 'monospace';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '3px';
    label.style.whiteSpace = 'nowrap';
    label.style.top = '-22px';
    label.style.left = '0';
    label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    overlay.appendChild(label);

    // Toggle inspector on/off (keyboard shortcut or programmatically)
    function toggleInspector(state) {
        active = state !== undefined ? state : !active;
        if (!active) {
            overlay.style.display = 'none';
            if (hoveredElement) {
                hoveredElement = null;
            }
            console.log("Web Inspector Deactivated");
        } else {
            console.log("Web Inspector Activated");
        }
    }

    // Keyboard shortcut to toggle: Alt+Shift+I
    window.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && e.code === 'KeyI') {
            toggleInspector();
            window.parent.postMessage({ command: 'toggleStateChanged', active: active }, '*');
        }
    });

    // Listen to messages from the parent window
    window.addEventListener('message', (e) => {
        if (e.data && e.data.command === 'toggleInspect') {
            toggleInspector(e.data.active);
        }
    });

    // Handle mouse movement to draw overlay
    window.addEventListener('mousemove', (e) => {
        if (!active) return;
        
        // Find the element under the cursor, ignoring our overlay
        overlay.style.display = 'none';
        const el = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.display = 'block';

        if (!el || el === document.body || el === document.documentElement) {
            overlay.style.display = 'none';
            return;
        }

        if (el !== hoveredElement) {
            hoveredElement = el;
            const rect = el.getBoundingClientRect();
            
            overlay.style.left = rect.left + 'px';
            overlay.style.top = rect.top + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
            
            let name = el.tagName.toLowerCase();
            if (el.id) name += `#${el.id}`;
            if (el.className) {
                const classes = Array.from(el.classList).join('.');
                if (classes) name += `.${classes}`;
            }
            label.textContent = name;
        }
    }, { passive: true });

    // Handle element click to extract and send CSS
    window.addEventListener('click', (e) => {
        if (!active) return;
        
        e.preventDefault();
        e.stopPropagation();

        if (hoveredElement) {
            const cssData = extractCSS(hoveredElement);
            sendToExtension(cssData);
            toggleInspector(false); // Turn off after selection
            window.parent.postMessage({ command: 'inspectDeactivated' }, '*');
        }
    }, true); // Capture phase to prevent application clicks

    // Extract computed CSS style from element
    function extractCSS(el) {
        const computed = window.getComputedStyle(el);
        const propertiesToExtract = [
            // Layout & Position
            'position', 'top', 'right', 'bottom', 'left', 'z-index',
            'display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'flex-grow', 'flex-shrink', 'gap',
            'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
            // Box Model
            'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
            'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
            'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
            'box-sizing',
            // Typography
            'font-family', 'font-size', 'font-weight', 'line-height', 'color', 'text-align', 'text-transform', 'letter-spacing',
            // Background & Border
            'background-color', 'background-image', 'background-size', 'background-position',
            'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius',
            // Effects
            'box-shadow', 'opacity', 'visibility', 'transform', 'transition'
        ];

        let cssString = '';
        const defaultElement = document.createElement(el.tagName);
        document.body.appendChild(defaultElement);
        const defaultStyles = window.getComputedStyle(defaultElement);

        propertiesToExtract.forEach(prop => {
            const val = computed.getPropertyValue(prop);
            const defaultVal = defaultStyles.getPropertyValue(prop);
            
            // Only capture if it differs from browser default value to avoid clutter
            if (val && val !== defaultVal && val !== 'none' && val !== 'normal' && val !== '0px' && val !== 'auto' && val !== 'rgba(0, 0, 0, 0)') {
                cssString += `  ${prop}: ${val};\n`;
            }
        });

        document.body.removeChild(defaultElement);

        let selector = el.tagName.toLowerCase();
        if (el.id) selector += `#${el.id}`;
        else if (el.classList.length > 0) selector += `.${Array.from(el.classList).join('.')}`;

        const formattedCSS = `${selector} {\n${cssString}}`;

        return {
            tagName: el.tagName.toLowerCase(),
            className: el.className,
            id: el.id,
            outerHTML: el.outerHTML,
            css: formattedCSS
        };
    }

    // Send extracted CSS to local extension server
    function sendToExtension(data) {
        fetch('http://localhost:3111/element', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(res => {
            console.log('CSS data successfully sent to VS Code Agent!', res);
        })
        .catch(err => {
            console.error('Failed to send data to extension server:', err);
            alert('Failed to send CSS to VS Code. Is the extension server running on port 3111?');
        });
    }

    // Web inspector waits for parent command to activate
    toggleInspector(false);
})();
