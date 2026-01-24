document.addEventListener('DOMContentLoaded', async () => {
    // Get elements
    const enableToggle = document.getElementById('enableToggle');
    const adsBlockedElement = document.getElementById('adsBlocked');
    const dataSavedElement = document.getElementById('dataSaved');
    const trackersBlockedElement = document.getElementById('trackersBlocked');
    const currentDomainElement = document.getElementById('currentDomain');
    const siteBlockCountElement = document.getElementById('siteBlockCount');
    
    // Category toggles
    const blockAdsToggle = document.getElementById('blockAds');
    const blockTrackersToggle = document.getElementById('blockTrackers');
    const blockSocialToggle = document.getElementById('blockSocial');
    const blockMalwareToggle = document.getElementById('blockMalware');
    const cookieConsentToggle = document.getElementById('cookieConsent');
    const antiFingerprintToggle = document.getElementById('antiFingerprint');
    
    // Time stats
    const todayBlockedElement = document.getElementById('todayBlocked');
    const todayDataSavedElement = document.getElementById('todayDataSaved');
    const timeTabs = document.querySelectorAll('.time-tab');
    
    // Dashboard elements
    const topDomainElement = document.getElementById('topDomain');
    const adsCountElement = document.getElementById('adsCount');
    const trackersCountElement = document.getElementById('trackersCount');
    
    // Load saved settings and stats
    const savedData = await browser.storage.local.get({
        totalBlocked: 0,
        trackersBlocked: 0,
        adsBlocked: 0,
        socialBlocked: 0,
        malwareBlocked: 0,
        dataSaved: 0,
        enabled: true,
        settings: {
            blockAds: true,
            blockTrackers: true,
            blockSocial: true,
            blockMalware: true,
            cookieConsent: true,
            antiFingerprint: true
        },
        dailyStats: {},
        weeklyStats: {},
        monthlyStats: {},
        domainStats: {}
    });
    
    const stats = {
        totalBlocked: savedData.totalBlocked || 0,
        trackersBlocked: savedData.trackersBlocked || 0,
        adsBlocked: savedData.adsBlocked || 0,
        socialBlocked: savedData.socialBlocked || 0,
        malwareBlocked: savedData.malwareBlocked || 0,
        dataSaved: savedData.dataSaved || 0,
        dailyStats: savedData.dailyStats || {},
        weeklyStats: savedData.weeklyStats || {},
        monthlyStats: savedData.monthlyStats || {},
        domainStats: savedData.domainStats || {}
    };
    
    const settings = savedData.settings || {
        blockAds: true,
        blockTrackers: true,
        blockSocial: true,
        blockMalware: true,
        cookieConsent: true,
        antiFingerprint: true
    };
    
    // Update UI with saved stats
    adsBlockedElement.textContent = stats.adsBlocked.toLocaleString();
    trackersBlockedElement.textContent = stats.trackersBlocked.toLocaleString();
    dataSavedElement.textContent = formatBytes(stats.dataSaved);
    enableToggle.checked = savedData.enabled;
    
    // Update category toggles
    blockAdsToggle.checked = settings.blockAds !== false;
    blockTrackersToggle.checked = settings.blockTrackers !== false;
    blockSocialToggle.checked = settings.blockSocial !== false;
    blockMalwareToggle.checked = settings.blockMalware !== false;
    cookieConsentToggle.checked = settings.cookieConsent !== false;
    antiFingerprintToggle.checked = settings.antiFingerprint !== false;
    
    // Update time-based stats
    function updateTimeStats(period = 'today') {
        const now = new Date();
        let statsToUse = {};
        
        if (period === 'today') {
            const today = now.toISOString().split('T')[0];
            statsToUse = stats.dailyStats[today] || { blocked: 0, dataSaved: 0 };
        } else if (period === 'week') {
            const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
            statsToUse = stats.weeklyStats[weekStart] || { blocked: 0, dataSaved: 0 };
        } else if (period === 'month') {
            const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            statsToUse = stats.monthlyStats[monthStart] || { blocked: 0, dataSaved: 0 };
        }
        
        todayBlockedElement.textContent = statsToUse.blocked.toLocaleString();
        todayDataSavedElement.textContent = formatBytes(statsToUse.dataSaved);
    }
    
    updateTimeStats('today');
    
    // Handle time tab clicks
    timeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            timeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateTimeStats(tab.dataset.period);
        });
    });
    
    // Calculate privacy score (0-100) - higher is better
    function calculatePrivacyScore(currentDomain) {
        if (!currentDomain) return 85; // Default score
        
        const siteBlocks = stats.siteStats[currentDomain] || 0;
        const trackerBlocks = stats.trackersBlocked || 0;
        const totalBlocks = stats.totalBlocked || 1;
        
        // Score based on blocking effectiveness
        // More blocks = better protection = higher score
        let score = 50; // Base score
        
        // Bonus for active blocking
        if (totalBlocks > 0) {
            score += Math.min(30, Math.log10(totalBlocks + 1) * 10);
        }
        
        // Bonus for tracker blocking
        const trackerRatio = trackerBlocks / totalBlocks;
        if (trackerRatio > 0.3) {
            score += 20; // Good tracker blocking
        }
        
        // Site-specific bonus
        if (siteBlocks > 0) {
            score += Math.min(20, siteBlocks);
        }
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    
    // Get current tab info
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    let currentDomain = '-';
    if (tabs[0]) {
        const url = new URL(tabs[0].url);
        currentDomain = url.hostname;
        currentDomainElement.textContent = currentDomain;
    }
    
    // Update dashboard
    function updateDashboard() {
        // Privacy score
        const privacyScore = calculatePrivacyScore(currentDomain);
        const privacyScoreElement = document.getElementById('privacyScore');
        if (privacyScoreElement) {
            privacyScoreElement.textContent = privacyScore;
            privacyScoreElement.className = 'dashboard-value privacy-score';
            if (privacyScore < 50) {
                privacyScoreElement.classList.add('low');
            } else if (privacyScore < 80) {
                privacyScoreElement.classList.add('medium');
            } else {
                privacyScoreElement.classList.add('high');
            }
        }
        
        // Top domain
        const topDomain = Object.entries(stats.domainStats)
            .sort((a, b) => b[1] - a[1])[0];
        if (topDomainElement) {
            topDomainElement.textContent = topDomain ? topDomain[0] : '-';
        }
        
        // Category breakdown
        if (adsCountElement) adsCountElement.textContent = stats.adsBlocked.toLocaleString();
        if (trackersCountElement) trackersCountElement.textContent = stats.trackersBlocked.toLocaleString();
    }
    
    updateDashboard();
    
    if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        
        // Check if site is in exceptions
        const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
        const isExcepted = exceptions.includes(domain);
        
        // Update exception button
        const exceptionBtn = document.getElementById('toggleException');
        exceptionBtn.textContent = isExcepted ? 'Remove from Exceptions' : 'Allow Ads on This Site';
        exceptionBtn.classList.toggle('excepted', isExcepted);
        
        // Load and display exceptions list
        async function updateExceptionsList() {
            const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
            const exceptionsList = document.getElementById('exceptionsList');
            const emptyMessage = document.getElementById('emptyExceptions');
            const exceptionsCount = document.getElementById('exceptionsCount');
            
            // Update count
            exceptionsCount.textContent = exceptions.length;
            
            exceptionsList.innerHTML = '';
            
            if (exceptions.length === 0) {
                emptyMessage.style.display = 'block';
                document.getElementById('toggleExceptionsList').style.display = 'none';
                return;
            }
            
            emptyMessage.style.display = 'none';
            document.getElementById('toggleExceptionsList').style.display = 'block';
            
            exceptions.forEach(domain => {
                const item = document.createElement('li');
                item.className = 'exception-item';
                
                const domainText = document.createElement('span');
                domainText.textContent = domain;
                
                const removeButton = document.createElement('button');
                removeButton.textContent = '✕';
                removeButton.className = 'remove-exception';
                removeButton.title = 'Remove from exceptions';
                removeButton.addEventListener('click', async () => {
                    const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
                    const newExceptions = exceptions.filter(d => d !== domain);
                    await browser.storage.local.set({ exceptions: newExceptions });
                    browser.runtime.sendMessage({ 
                        type: 'exceptionsUpdated', 
                        exceptions: newExceptions 
                    });
                    updateExceptionsList();
                });
                
                item.appendChild(domainText);
                item.appendChild(removeButton);
                exceptionsList.appendChild(item);
            });
        }
        
        // Handle exceptions list toggle
        document.getElementById('toggleExceptionsList').addEventListener('click', (e) => {
            const list = document.getElementById('exceptionsList');
            const isExpanded = list.classList.contains('expanded');
            list.classList.toggle('expanded');
            e.target.textContent = isExpanded ? 'Show All' : 'Hide';
        });
        
        // Handle manual exception entry
        document.getElementById('addManualException').addEventListener('click', () => {
            const manualEntry = document.getElementById('manualEntry');
            manualEntry.style.display = manualEntry.style.display === 'none' ? 'flex' : 'none';
            if (manualEntry.style.display === 'flex') {
                document.getElementById('manualDomain').focus();
            }
        });
        
        document.getElementById('saveManualEntry').addEventListener('click', async () => {
            const input = document.getElementById('manualDomain');
            let domain = input.value.trim().toLowerCase();
            
            // Basic domain validation
            if (!domain) return;
            
            // Remove http(s):// and www. if present
            domain = domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
            
            // Remove anything after the first slash
            domain = domain.split('/')[0];
            
            const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
            
            if (!exceptions.includes(domain)) {
                const newExceptions = [...exceptions, domain];
                await browser.storage.local.set({ exceptions: newExceptions });
                browser.runtime.sendMessage({ 
                    type: 'exceptionsUpdated', 
                    exceptions: newExceptions 
                });
                await updateExceptionsList();
            }
            
            input.value = '';
            document.getElementById('manualEntry').style.display = 'none';
        });
        
        // Handle Enter key in manual entry
        document.getElementById('manualDomain').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('saveManualEntry').click();
            }
        });
        
        // Initial load of exceptions list
        await updateExceptionsList();
        
        // Handle exception toggle
        exceptionBtn.addEventListener('click', async () => {
            const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
            let newExceptions;
            
            if (isExcepted) {
                newExceptions = exceptions.filter(d => d !== domain);
                exceptionBtn.textContent = 'Allow Ads on This Site';
                exceptionBtn.classList.remove('excepted');
            } else {
                newExceptions = [...exceptions, domain];
                exceptionBtn.textContent = 'Remove from Exceptions';
                exceptionBtn.classList.add('excepted');
            }
            
            await browser.storage.local.set({ exceptions: newExceptions });
            browser.runtime.sendMessage({ 
                type: 'exceptionsUpdated', 
                exceptions: newExceptions 
            });
            
            // Update the exceptions list
            await updateExceptionsList();
        });
        
        // Get site-specific stats
        const siteStats = await browser.storage.local.get({
            [`site:${domain}`]: 0
        });
        siteBlockCountElement.textContent = 
            `${siteStats[`site:${domain}`]} ads blocked`;
    }
    
    // Handle main toggle
    enableToggle.addEventListener('change', async (e) => {
        await browser.storage.local.set({ enabled: e.target.checked });
        browser.runtime.sendMessage({
            type: 'toggleBlocking',
            enabled: e.target.checked
        });
    });
    
    // Handle category toggles
    blockAdsToggle.addEventListener('change', async (e) => {
        await browser.runtime.sendMessage({
            type: 'updateCategorySettings',
            blockAds: e.target.checked
        });
        settings.blockAds = e.target.checked;
    });
    
    blockTrackersToggle.addEventListener('change', async (e) => {
        await browser.runtime.sendMessage({
            type: 'updateCategorySettings',
            blockTrackers: e.target.checked
        });
        settings.blockTrackers = e.target.checked;
    });
    
    blockSocialToggle.addEventListener('change', async (e) => {
        await browser.runtime.sendMessage({
            type: 'updateCategorySettings',
            blockSocial: e.target.checked
        });
        settings.blockSocial = e.target.checked;
    });
    
    blockMalwareToggle.addEventListener('change', async (e) => {
        await browser.runtime.sendMessage({
            type: 'updateCategorySettings',
            blockMalware: e.target.checked
        });
        settings.blockMalware = e.target.checked;
    });
    
    cookieConsentToggle.addEventListener('change', async (e) => {
        await browser.runtime.sendMessage({
            type: 'updateCategorySettings',
            cookieConsent: e.target.checked
        });
        settings.cookieConsent = e.target.checked;
    });
    
    antiFingerprintToggle.addEventListener('change', async (e) => {
        await browser.runtime.sendMessage({
            type: 'updateCategorySettings',
            antiFingerprint: e.target.checked
        });
        settings.antiFingerprint = e.target.checked;
    });
    
    // Handle export stats
    document.getElementById('exportStats').addEventListener('click', async () => {
        const exportData = {
            stats: stats,
            settings: settings,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `adios-stats-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Handle view full report - show detailed stats in popup
    document.getElementById('viewFullReport').addEventListener('click', () => {
        // Create a detailed report view
        const reportWindow = window.open('', '_blank', 'width=600,height=800');
        if (reportWindow) {
            reportWindow.document.write(`
                <html>
                    <head>
                        <title>Adios Privacy Report</title>
                        <style>
                            body { font-family: -apple-system, sans-serif; padding: 20px; }
                            h1 { color: #34C759; }
                            .stat { margin: 10px 0; padding: 10px; background: #f5f5f7; border-radius: 8px; }
                            .category { margin: 5px 0; }
                        </style>
                    </head>
                    <body>
                        <h1>Adios Privacy Report</h1>
                        <div class="stat">
                            <h2>Total Statistics</h2>
                            <p>Ads Blocked: ${stats.adsBlocked.toLocaleString()}</p>
                            <p>Trackers Blocked: ${stats.trackersBlocked.toLocaleString()}</p>
                            <p>Social Media Blocked: ${stats.socialBlocked.toLocaleString()}</p>
                            <p>Malware Blocked: ${stats.malwareBlocked.toLocaleString()}</p>
                            <p>Total Blocked: ${stats.totalBlocked.toLocaleString()}</p>
                            <p>Data Saved: ${formatBytes(stats.dataSaved)}</p>
                        </div>
                        <div class="stat">
                            <h2>Top Blocked Domains</h2>
                            ${Object.entries(stats.domainStats)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 10)
                                .map(([domain, count]) => `<div class="category">${domain}: ${count.toLocaleString()}</div>`)
                                .join('')}
                        </div>
                        <p><small>Generated: ${new Date().toLocaleString()}</small></p>
                    </body>
                </html>
            `);
            reportWindow.document.close();
        }
    });
    
    // Handle support button
    document.getElementById('supportBtn').addEventListener('click', () => {
        browser.tabs.create({
            url: 'https://rossnicholson.dev'
        });
    });
    
    // Smart Filter Presets
    const presetButtons = {
        strict: document.getElementById('presetStrict'),
        balanced: document.getElementById('presetBalanced'),
        relaxed: document.getElementById('presetRelaxed')
    };
    const presetDescription = document.getElementById('presetDescription');
    
    const presets = {
        strict: {
            blockAds: true,
            blockTrackers: true,
            blockSocial: true,
            blockMalware: true,
            cookieConsent: true,
            antiFingerprint: true,
            description: 'Strict mode blocks all ads, trackers, social media, and malware. Maximum privacy protection.'
        },
        balanced: {
            blockAds: true,
            blockTrackers: true,
            blockSocial: false,
            blockMalware: true,
            cookieConsent: true,
            antiFingerprint: true,
            description: 'Balanced mode blocks ads and trackers while allowing essential content.'
        },
        relaxed: {
            blockAds: true,
            blockTrackers: false,
            blockSocial: false,
            blockMalware: true,
            cookieConsent: false,
            antiFingerprint: false,
            description: 'Relaxed mode blocks only ads and malware. Minimal interference with websites.'
        }
    };
    
    Object.entries(presetButtons).forEach(([presetName, button]) => {
        if (button) {
            button.addEventListener('click', async () => {
                // Update active state
                Object.values(presetButtons).forEach(btn => {
                    if (btn) btn.classList.remove('active');
                });
                button.classList.add('active');
                
                // Apply preset
                const preset = presets[presetName];
                if (preset) {
                    blockAdsToggle.checked = preset.blockAds;
                    blockTrackersToggle.checked = preset.blockTrackers;
                    blockSocialToggle.checked = preset.blockSocial;
                    blockMalwareToggle.checked = preset.blockMalware;
                    cookieConsentToggle.checked = preset.cookieConsent;
                    antiFingerprintToggle.checked = preset.antiFingerprint;
                    
                    if (presetDescription) {
                        presetDescription.textContent = preset.description;
                    }
                    
                    // Update settings
                    await browser.runtime.sendMessage({
                        type: 'updateCategorySettings',
                        ...preset
                    });
                    
                    settings = { ...settings, ...preset };
                }
            });
        }
    });
    
    // Custom Rules Management
    let customRules = [];
    const customRulesList = document.getElementById('customRulesList');
    const addCustomRuleBtn = document.getElementById('addCustomRule');
    
    async function loadCustomRules() {
        const data = await browser.storage.local.get({ customRules: [] });
        customRules = data.customRules || [];
        updateCustomRulesList();
    }
    
    function updateCustomRulesList() {
        if (!customRulesList) return;
        
        if (customRules.length === 0) {
            customRulesList.innerHTML = '<p class="empty-message">No custom rules. Click + to add one.</p>';
            return;
        }
        
        customRulesList.innerHTML = '';
        customRules.forEach((rule, index) => {
            const item = document.createElement('div');
            item.className = 'custom-rule-item';
            item.innerHTML = `
                <span class="rule-pattern">${rule.pattern}</span>
                <div class="rule-actions">
                    <button class="rule-delete" data-index="${index}">✕</button>
                </div>
            `;
            
            const deleteBtn = item.querySelector('.rule-delete');
            deleteBtn.addEventListener('click', async () => {
                customRules.splice(index, 1);
                await browser.storage.local.set({ customRules });
                await browser.runtime.sendMessage({ type: 'customRulesUpdated', rules: customRules });
                updateCustomRulesList();
            });
            
            customRulesList.appendChild(item);
        });
    }
    
    if (addCustomRuleBtn) {
        addCustomRuleBtn.addEventListener('click', () => {
            const pattern = prompt('Enter URL pattern to block (e.g., *://example.com/*):');
            if (pattern && pattern.trim()) {
                customRules.push({ pattern: pattern.trim(), type: 'block' });
                browser.storage.local.set({ customRules });
                browser.runtime.sendMessage({ type: 'customRulesUpdated', rules: customRules });
                updateCustomRulesList();
            }
        });
    }
    
    await loadCustomRules();
    
    // Network Monitor
    let monitorActive = false;
    let monitorStats = { blocked: 0, active: 0 };
    const toggleMonitorBtn = document.getElementById('toggleMonitor');
    const monitorContent = document.getElementById('monitorContent');
    const monitorBlockedElement = document.getElementById('monitorBlocked');
    const monitorActiveElement = document.getElementById('monitorActive');
    const recentBlocksElement = document.getElementById('recentBlocks');
    let recentBlocks = [];
    
    if (toggleMonitorBtn) {
        toggleMonitorBtn.addEventListener('click', () => {
            monitorActive = !monitorActive;
            toggleMonitorBtn.textContent = monitorActive ? 'Stop' : 'Start';
            toggleMonitorBtn.classList.toggle('active', monitorActive);
            
            if (monitorContent) {
                monitorContent.style.display = monitorActive ? 'block' : 'none';
            }
            
            if (monitorActive) {
                monitorStats = { blocked: 0, active: 0 };
                recentBlocks = [];
                browser.runtime.sendMessage({ type: 'startMonitor' });
            } else {
                browser.runtime.sendMessage({ type: 'stopMonitor' });
            }
        });
    }
    
    // Blocking History
    let blockingHistory = [];
    const historySummary = document.getElementById('historySummary');
    const viewHistoryBtn = document.getElementById('viewHistory');
    
    async function loadBlockingHistory() {
        const data = await browser.storage.local.get({ blockingHistory: [] });
        blockingHistory = data.blockingHistory || [];
        updateHistorySummary();
    }
    
    function updateHistorySummary() {
        if (!historySummary) return;
        
        if (blockingHistory.length === 0) {
            historySummary.innerHTML = '<p class="empty-message">No history yet</p>';
            return;
        }
        
        const recent = blockingHistory.slice(-5).reverse();
        historySummary.innerHTML = recent.map(item => `
            <div class="history-item">
                <div>${item.domain}</div>
                <div class="history-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
            </div>
        `).join('');
    }
    
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', () => {
            const historyWindow = window.open('', '_blank', 'width=600,height=800');
            if (historyWindow) {
                historyWindow.document.write(`
                    <html>
                        <head>
                            <title>Adios Blocking History</title>
                            <style>
                                body { font-family: -apple-system, sans-serif; padding: 20px; }
                                h1 { color: #34C759; }
                                .history-item { padding: 10px; border-bottom: 1px solid #e0e0e0; }
                                .history-time { color: #666; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <h1>Blocking History</h1>
                            ${blockingHistory.reverse().map(item => `
                                <div class="history-item">
                                    <div><strong>${item.domain}</strong></div>
                                    <div>Blocked: ${item.count} items</div>
                                    <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
                                </div>
                            `).join('')}
                        </body>
                    </html>
                `);
                historyWindow.document.close();
            }
        });
    }
    
    await loadBlockingHistory();
    
    // Filter Lists Management
    const filterEasyList = document.getElementById('filterEasyList');
    const filterPrivacyList = document.getElementById('filterPrivacyList');
    const filterMalwareList = document.getElementById('filterMalwareList');
    const importFiltersBtn = document.getElementById('importFilters');
    const exportFiltersBtn = document.getElementById('exportFilters');
    
    // Load filter list settings
    const filterData = await browser.storage.local.get({ 
        filterLists: { easyList: true, privacyList: true, malwareList: true }
    });
    const filterLists = filterData.filterLists || { easyList: true, privacyList: true, malwareList: true };
    
    if (filterEasyList) filterEasyList.checked = filterLists.easyList !== false;
    if (filterPrivacyList) filterPrivacyList.checked = filterLists.privacyList !== false;
    if (filterMalwareList) filterMalwareList.checked = filterLists.malwareList !== false;
    
    // Handle filter list toggles
    [filterEasyList, filterPrivacyList, filterMalwareList].forEach((toggle, index) => {
        if (toggle) {
            toggle.addEventListener('change', async () => {
                const keys = ['easyList', 'privacyList', 'malwareList'];
                filterLists[keys[index]] = toggle.checked;
                await browser.storage.local.set({ filterLists });
                await browser.runtime.sendMessage({ type: 'filterListsUpdated', filterLists });
            });
        }
    });
    
    // Import/Export filter lists
    if (importFiltersBtn) {
        importFiltersBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.txt';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    try {
                        const imported = JSON.parse(text);
                        if (imported.filterLists) {
                            await browser.storage.local.set({ filterLists: imported.filterLists });
                            if (filterEasyList) filterEasyList.checked = imported.filterLists.easyList;
                            if (filterPrivacyList) filterPrivacyList.checked = imported.filterLists.privacyList;
                            if (filterMalwareList) filterMalwareList.checked = imported.filterLists.malwareList;
                            alert('Filter lists imported successfully!');
                        }
                    } catch (err) {
                        alert('Error importing filter lists. Please check the file format.');
                    }
                }
            };
            input.click();
        });
    }
    
    if (exportFiltersBtn) {
        exportFiltersBtn.addEventListener('click', () => {
            const exportData = {
                filterLists: filterLists,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `adios-filters-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
    
    // Refresh stats periodically
    setInterval(async () => {
        const response = await browser.runtime.sendMessage({ type: 'getStats' });
        if (response) {
            stats.totalBlocked = response.totalBlocked || 0;
            stats.trackersBlocked = response.trackersBlocked || 0;
            stats.adsBlocked = response.adsBlocked || 0;
            stats.socialBlocked = response.socialBlocked || 0;
            stats.malwareBlocked = response.malwareBlocked || 0;
            stats.dataSaved = response.dataSaved || 0;
            stats.domainStats = response.domainStats || {};
            stats.dailyStats = response.dailyStats || {};
            stats.weeklyStats = response.weeklyStats || {};
            stats.monthlyStats = response.monthlyStats || {};
            
            adsBlockedElement.textContent = stats.adsBlocked.toLocaleString();
            trackersBlockedElement.textContent = stats.trackersBlocked.toLocaleString();
            dataSavedElement.textContent = formatBytes(stats.dataSaved);
            updateDashboard();
            updateTimeStats(document.querySelector('.time-tab.active')?.dataset.period || 'today');
            
            // Update network monitor if active
            if (monitorActive && monitorBlockedElement) {
                monitorBlockedElement.textContent = monitorStats.blocked;
            }
        }
    }, 2000);
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
