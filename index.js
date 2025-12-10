console.log("Gemini Theme Extension: Loading...");

jQuery(async () => {
    // Wait for SillyTavern context
    while (typeof SillyTavern === 'undefined' || !SillyTavern.getContext) {
        await new Promise(r => setTimeout(r, 100));
    }
    
    const { eventSource, event_types } = SillyTavern.getContext();
    console.log("Gemini Theme: SillyTavern context loaded");
    
    // =========================================================
    // LOAD SAVED SETTINGS
    // =========================================================
    const savedAccent = localStorage.getItem('gemini-accent');
    if (savedAccent) {
        document.documentElement.style.setProperty('--gemini-accent', savedAccent);
    }
    
    // Default to enabled (true) if nothing is saved, load saved state
    const savedEnabled = localStorage.getItem('gemini-enabled');
    // If null (never saved), default to true. If 'false', disable.
    if (savedEnabled === 'false') {
        document.body.classList.remove('gemini-ui');
    } else {
        document.body.classList.add('gemini-ui');
    }

    // =========================================================
    // HAMBURGER MENU LOGIC (PROXY PATTERN)
    // =========================================================
    function setupHamburgerMenu() {
        // 1. Create Sidebar Container
        let sidebar = document.getElementById('gemini-sidebar');
        if (!sidebar) {
            sidebar = document.createElement('div');
            sidebar.id = 'gemini-sidebar';
            document.body.appendChild(sidebar);
        }

        // 2. Create Trigger Button
        if (!document.getElementById('gemini-menu-trigger')) {
            const trigger = document.createElement('div');
            trigger.id = 'gemini-menu-trigger';
            trigger.innerHTML = '☰';
            trigger.onclick = () => {
                sidebar.classList.toggle('visible');
            };
            document.body.appendChild(trigger);
        }

        // 3. Proxy Logic
        const processedIcons = new Set();
        
        function createProxyFor(originalIcon) {
            if (processedIcons.has(originalIcon)) return;
            processedIcons.add(originalIcon);

            // CLONE VISUALS
            const proxy = document.createElement('div');
            proxy.className = 'gemini-proxy-icon';
            
            function syncState() {
                proxy.innerHTML = originalIcon.innerHTML;
                const classList = Array.from(originalIcon.classList)
                    .filter(c => c !== 'drawer-icon' && c !== 'interactable'); 
                proxy.classList.remove(...proxy.classList);
                proxy.classList.add('gemini-proxy-icon', ...classList);
                proxy.title = originalIcon.title || '';
            }
            
            syncState();

            const proxyObserver = new MutationObserver(() => {
                syncState();
            });
            proxyObserver.observe(originalIcon, { 
                attributes: true, 
                childList: true, 
                subtree: true, 
                attributeFilter: ['class', 'style', 'title'] 
            });
            
            proxy.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                originalIcon.click();
            };
            
            sidebar.appendChild(proxy);
        }

        function scanAndProxy() {
            let candidates = Array.from(document.querySelectorAll('.drawer-icon'));
            const knownIds = [
                'leftNavDrawerIcon', 'API-status-top', 'API-status-top-disconnected', 
                'WIDrawerIcon', 'rightNavDrawerIcon', 'extensions_menu', 'image_generation'
            ];
            
            knownIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) candidates.push(el);
            });
            
            const uniqueIcons = new Set(candidates);
            
            uniqueIcons.forEach(icon => {
                if (sidebar.contains(icon) || icon.classList.contains('gemini-proxy-icon')) return;
                if (['send_but', 'options_button', 'extensionsMenuButton', 'gemini-menu-trigger'].includes(icon.id)) return;
                
                // If the original has display: none (like disconnected plug if connected one exists), 
                // we might want to respect that logic or let the observer handle it. 
                // For safety in this "robust" phase, let's proxy it. 
                // The global CSS hides ALL .drawer-icon anyway when gemini-ui is active.
                createProxyFor(icon);
            });
        }

        setTimeout(scanAndProxy, 1000); 
        setTimeout(scanAndProxy, 3000); 

        const mainObserver = new MutationObserver((mutations) => {
            let shouldScan = false;
            for (const m of mutations) {
                if (m.addedNodes.length > 0) shouldScan = true;
            }
            if (shouldScan) scanAndProxy();
        });
        mainObserver.observe(document.body, { childList: true, subtree: true });
        
        // =========================================================
        // GEMINI THEME SETTINGS (NATIVE STYLE)
        // =========================================================
        const settingsObserver = new MutationObserver(() => {
            const extArea = document.getElementById('extensions_settings');
            
            if (extArea && !document.getElementById('gemini-theme-settings')) {
                const settingsBlock = document.createElement('div');
                settingsBlock.id = 'gemini-theme-settings';
                settingsBlock.className = 'inline-drawer'; // Native ST drawer class
                
                // Load current values
                const currentAccent = localStorage.getItem('gemini-accent') || '#4285F4';
                const isEnabled = localStorage.getItem('gemini-enabled') !== 'false';
                
                settingsBlock.innerHTML = `
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>✨ Gemini Theme</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down-arrow"></div>
                    </div>
                    <div class="inline-drawer-content" style="display: block; padding: 10px;">
                         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; margin-top:5px;">
                            <span data-i18n="Enable Theme">Enable Theme</span>
                            <label class="checkbox_label">
                                <input type="checkbox" id="gemini-toggle" ${isEnabled ? 'checked' : ''} />
                            </label>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span data-i18n="Accent Color">Accent Color</span>
                            <div style="display:flex; align-items:center;">
                                <input type="color" id="gemini-color-picker" value="${currentAccent}" style="height:30px; width:60px; border:none; background:transparent; cursor:pointer;">
                            </div>
                        </div>
                    </div>
                `;
                
                // Insert at TOP
                extArea.insertBefore(settingsBlock, extArea.firstChild);
                
                // 1. Toggle Drawer Logic
                const header = settingsBlock.querySelector('.inline-drawer-header');
                const content = settingsBlock.querySelector('.inline-drawer-content');
                const icon = settingsBlock.querySelector('.inline-drawer-icon');
                
                header.onclick = () => {
                    const isClosed = content.style.display === 'none';
                    content.style.display = isClosed ? 'block' : 'none';
                    icon.style.transform = isClosed ? 'rotate(0deg)' : 'rotate(-90deg)';
                };

                // 2. Settings Functionality
                const toggle = settingsBlock.querySelector('#gemini-toggle');
                const picker = settingsBlock.querySelector('#gemini-color-picker');
                
                toggle.onchange = (e) => {
                    const enabled = e.target.checked;
                    if (enabled) document.body.classList.add('gemini-ui');
                    else document.body.classList.remove('gemini-ui');
                    localStorage.setItem('gemini-enabled', enabled);
                };
                
                picker.oninput = (e) => {
                    const color = e.target.value;
                    document.documentElement.style.setProperty('--gemini-accent', color);
                    localStorage.setItem('gemini-accent', color);
                };
            }
        });
        settingsObserver.observe(document.body, { childList: true, subtree: true });
    }

    setupHamburgerMenu();

    // =========================================================
    // WELCOME STATE (Existing)
    // =========================================================
    function updateGeminiState() {
        // ... (Existing logic same) ...
        const chat = document.getElementById('chat');
        if (!chat) return;
        const messages = Array.from(chat.querySelectorAll('.mes')).filter(m => m.style.display !== 'none');
        if (messages.length === 0) {
            document.body.classList.add('gemini-welcome-state');
        } else {
            document.body.classList.remove('gemini-welcome-state');
        }
    }
    setTimeout(updateGeminiState, 500);
    const { eventSource: contextEventSource, event_types: contextEventTypes } = SillyTavern.getContext();
    const events = [
        contextEventTypes.CHAT_CHANGED,
        contextEventTypes.MESSAGE_RECEIVED,
        contextEventTypes.MESSAGE_SENT,
        contextEventTypes.CHARACTER_MESSAGE_RENDERED,
        contextEventTypes.USER_MESSAGE_RENDERED,
        contextEventTypes.CHAT_DELETED
    ];
    events.forEach(eventType => {
        if (eventType) contextEventSource.on(eventType, updateGeminiState);
    });
    const observer = new MutationObserver(() => updateGeminiState());
    const chatElement = document.getElementById('chat');
    if (chatElement) observer.observe(chatElement, { childList: true, subtree: true });
});
