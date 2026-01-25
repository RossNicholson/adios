// Browser API polyfill for compatibility
if (typeof browser === 'undefined') {
    window.browser = typeof chrome !== 'undefined' ? chrome : {};
}

// State update lock to prevent race conditions
let updateLock = false;
const updateQueue = [];

// Helper function to queue state updates
async function queueStateUpdate(updateFn) {
    return new Promise((resolve, reject) => {
        updateQueue.push({ updateFn, resolve, reject });
        processUpdateQueue();
    });
}

// Process update queue one at a time
async function processUpdateQueue() {
    if (updateLock || updateQueue.length === 0) return;
    
    updateLock = true;
    const { updateFn, resolve, reject } = updateQueue.shift();
    
    try {
        await updateFn();
        resolve();
    } catch (error) {
        console.error('State update error:', error);
        reject(error);
    } finally {
        updateLock = false;
        // Process next item in queue
        if (updateQueue.length > 0) {
            setTimeout(processUpdateQueue, 0);
        }
    }
}

// Helper function to safely update DOM elements
function safeUpdateElement(elementId, updateFn) {
    const element = document.getElementById(elementId);
    if (element) {
        try {
            updateFn(element);
        } catch (error) {
            console.error(`Error updating element ${elementId}:`, error);
        }
    }
}

// Helper function to validate domain input
function validateDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    
    // Remove protocol and path
    const cleanDomain = domain.trim()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split('?')[0];
    
    // Basic domain validation
    const domainRegex = /^([a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    return domainRegex.test(cleanDomain) && cleanDomain.length <= 253;
}

// Helper function to validate custom rule pattern
function validateRulePattern(pattern) {
    if (!pattern || typeof pattern !== 'string') return false;
    
    // Basic pattern validation - must contain *:// or be a valid URL pattern
    const trimmed = pattern.trim();
    if (trimmed.length === 0 || trimmed.length > 500) return false;
    
    // Check for valid pattern format
    try {
        // Try to create a regex from the pattern
        const regexStr = '^' + trimmed.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$';
        new RegExp(regexStr);
        return true;
    } catch (e) {
        return false;
    }
}

// Helper function to trim large stats/history objects
function trimStatsIfNeeded(stats) {
    if (!stats) return;
    
    // Trim blocking history to last 100 entries
    if (stats.blockingHistory && stats.blockingHistory.length > 100) {
        stats.blockingHistory = stats.blockingHistory.slice(-100);
    }
    
    // Trim daily stats to last 90 days
    if (stats.dailyStats) {
        const now = new Date();
        const cutoffDate = new Date(now.setDate(now.getDate() - 90));
        const cutoff = cutoffDate.toISOString().split('T')[0];
        
        Object.keys(stats.dailyStats).forEach(date => {
            if (date < cutoff) {
                delete stats.dailyStats[date];
            }
        });
    }
    
    // Trim weekly stats to last 52 weeks
    if (stats.weeklyStats) {
        const keys = Object.keys(stats.weeklyStats).sort();
        if (keys.length > 52) {
            keys.slice(0, keys.length - 52).forEach(key => {
                delete stats.weeklyStats[key];
            });
        }
    }
    
    // Trim monthly stats to last 24 months
    if (stats.monthlyStats) {
        const keys = Object.keys(stats.monthlyStats).sort();
        if (keys.length > 24) {
            keys.slice(0, keys.length - 24).forEach(key => {
                delete stats.monthlyStats[key];
            });
        }
    }
    
    // Trim domain stats to top 1000 domains
    if (stats.domainStats) {
        const entries = Object.entries(stats.domainStats);
        if (entries.length > 1000) {
            entries.sort((a, b) => b[1] - a[1]);
            const top1000 = entries.slice(0, 1000);
            stats.domainStats = Object.fromEntries(top1000);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
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
    
    // Trim stats if needed
    trimStatsIfNeeded(stats);
    
    // Update UI with saved stats (with DOM checks)
    safeUpdateElement('adsBlocked', (el) => {
        el.textContent = stats.adsBlocked.toLocaleString();
    });
    safeUpdateElement('trackersBlocked', (el) => {
        el.textContent = stats.trackersBlocked.toLocaleString();
    });
    safeUpdateElement('dataSaved', (el) => {
        el.textContent = formatBytes(stats.dataSaved);
    });
    
    if (enableToggle) enableToggle.checked = savedData.enabled;
    
    // Update category toggles (with DOM checks)
    if (blockAdsToggle) blockAdsToggle.checked = settings.blockAds !== false;
    if (blockTrackersToggle) blockTrackersToggle.checked = settings.blockTrackers !== false;
    if (blockSocialToggle) blockSocialToggle.checked = settings.blockSocial !== false;
    if (blockMalwareToggle) blockMalwareToggle.checked = settings.blockMalware !== false;
    if (cookieConsentToggle) cookieConsentToggle.checked = settings.cookieConsent !== false;
    if (antiFingerprintToggle) antiFingerprintToggle.checked = settings.antiFingerprint !== false;
    
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
        
        safeUpdateElement('todayBlocked', (el) => {
            el.textContent = statsToUse.blocked.toLocaleString();
        });
        safeUpdateElement('todayDataSaved', (el) => {
            el.textContent = formatBytes(statsToUse.dataSaved);
        });
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
    
    // Get current tab info (with error handling)
    let currentDomain = '-';
    try {
        const tabs = await browser.tabs.query({active: true, currentWindow: true});
        if (tabs && tabs.length > 0) {
            const tab = tabs[0];
            const url = tab.url;
            if (url && url !== 'about:blank' && url !== 'chrome://newtab/' && url !== 'edge://newtab/') {
                try {
                    const urlObj = new URL(url);
                    const domain = urlObj.hostname.replace(/^www\./, '');
                    currentDomain = domain;
                    
                    safeUpdateElement('currentDomain', (el) => {
                        el.textContent = domain;
                    });
                    
                    // Get site-specific stats
                    const siteStats = await browser.storage.local.get({
                        [`site:${domain}`]: 0
                    });
                    const siteCount = siteStats[`site:${domain}`] || 0;
                    
                    safeUpdateElement('siteBlockCount', (el) => {
                        el.textContent = siteCount.toLocaleString();
                    });
                    
                    // Check if site is in exceptions
                    const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
                    const isExcepted = exceptions.includes(domain);
                    
                    // Update exception button (with DOM check)
                    const exceptionBtn = document.getElementById('toggleException');
                    if (exceptionBtn) {
                        exceptionBtn.textContent = isExcepted ? 'Remove from Exceptions' : 'Allow Ads on This Site';
                        exceptionBtn.classList.toggle('excepted', isExcepted);
                    }
                } catch (e) {
                    // Invalid URL
                    console.error('Error parsing URL:', e);
                    currentDomain = '-';
                    safeUpdateElement('currentDomain', (el) => {
                        el.textContent = '-';
                    });
                }
            } else {
                currentDomain = '-';
                safeUpdateElement('currentDomain', (el) => {
                    el.textContent = '-';
                });
            }
        }
    } catch (error) {
        console.error('Error getting tab info:', error);
        currentDomain = '-';
        safeUpdateElement('currentDomain', (el) => {
            el.textContent = '-';
        });
    }
    
    // Update dashboard
    function updateDashboard() {
        try {
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
            const topDomain = Object.entries(stats.domainStats || {})
                .sort((a, b) => b[1] - a[1])[0];
            
            safeUpdateElement('topDomain', (el) => {
                el.textContent = topDomain ? topDomain[0] : '-';
            });
            
            // Category breakdown
            safeUpdateElement('adsCount', (el) => {
                el.textContent = stats.adsBlocked.toLocaleString();
            });
            
            safeUpdateElement('trackersCount', (el) => {
                el.textContent = stats.trackersBlocked.toLocaleString();
            });
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }
    
    updateDashboard();
    
    // Load and display exceptions list
    async function updateExceptionsList() {
        const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
        const exceptionsList = document.getElementById('exceptionsList');
        const emptyMessage = document.getElementById('emptyExceptions');
        const exceptionsCount = document.getElementById('exceptionsCount');
        
        // Update count
        if (exceptionsCount) {
            exceptionsCount.textContent = exceptions.length;
        }
        
        if (exceptionsList) {
            exceptionsList.innerHTML = '';
        }
        
        if (exceptions.length === 0) {
            if (emptyMessage) emptyMessage.style.display = 'block';
            const toggleBtn = document.getElementById('toggleExceptionsList');
            if (toggleBtn) toggleBtn.style.display = 'none';
            return;
        }
        
        if (emptyMessage) emptyMessage.style.display = 'none';
        const toggleBtn = document.getElementById('toggleExceptionsList');
        if (toggleBtn) toggleBtn.style.display = 'block';
        
        if (exceptionsList) {
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
    }
    
    // Handle exceptions list toggle (with DOM check)
    const toggleExceptionsListBtn = document.getElementById('toggleExceptionsList');
        if (toggleExceptionsListBtn) {
            toggleExceptionsListBtn.addEventListener('click', (e) => {
                const list = document.getElementById('exceptionsList');
                if (list) {
                    const isExpanded = list.classList.contains('expanded');
                    list.classList.toggle('expanded');
                    e.target.textContent = isExpanded ? 'Show All' : 'Hide';
                }
            });
    }
    
    // Handle manual exception entry (with DOM checks and validation)
    const addManualExceptionBtn = document.getElementById('addManualException');
        if (addManualExceptionBtn) {
            addManualExceptionBtn.addEventListener('click', () => {
                const manualEntry = document.getElementById('manualEntry');
                if (manualEntry) {
                    manualEntry.style.display = manualEntry.style.display === 'none' ? 'flex' : 'none';
                    if (manualEntry.style.display === 'flex') {
                        const manualDomainInput = document.getElementById('manualDomain');
                        if (manualDomainInput) manualDomainInput.focus();
                    }
                }
            });
    }
    
    // Handle Enter key in manual entry (with DOM check)
    const manualDomainInput = document.getElementById('manualDomain');
        if (manualDomainInput) {
            manualDomainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('saveManualEntry').click();
            }
    });
    
    // Initial load of exceptions list
    await updateExceptionsList();
    
    // Handle main toggle (with DOM check and state synchronization)
    if (enableToggle) {
        enableToggle.addEventListener('change', async (e) => {
            await queueStateUpdate(async () => {
                await browser.storage.local.set({ enabled: e.target.checked });
                await browser.runtime.sendMessage({
                    type: 'toggleBlocking',
                    enabled: e.target.checked
                });
            });
        });
    }
    
    // Handle category toggles (with DOM checks and state synchronization)
    if (blockAdsToggle) {
        blockAdsToggle.addEventListener('change', async (e) => {
            await queueStateUpdate(async () => {
                await browser.runtime.sendMessage({
                    type: 'updateCategorySettings',
                    blockAds: e.target.checked
                });
                settings.blockAds = e.target.checked;
            });
        });
    }
    
    if (blockTrackersToggle) {
        blockTrackersToggle.addEventListener('change', async (e) => {
            await queueStateUpdate(async () => {
                await browser.runtime.sendMessage({
                    type: 'updateCategorySettings',
                    blockTrackers: e.target.checked
                });
                settings.blockTrackers = e.target.checked;
            });
        });
    }
    
    if (blockSocialToggle) {
        blockSocialToggle.addEventListener('change', async (e) => {
            await queueStateUpdate(async () => {
                await browser.runtime.sendMessage({
                    type: 'updateCategorySettings',
                    blockSocial: e.target.checked
                });
                settings.blockSocial = e.target.checked;
            });
        });
    }
    
    if (blockMalwareToggle) {
        blockMalwareToggle.addEventListener('change', async (e) => {
            await queueStateUpdate(async () => {
                await browser.runtime.sendMessage({
                    type: 'updateCategorySettings',
                    blockMalware: e.target.checked
                });
                settings.blockMalware = e.target.checked;
            });
        });
    }
    
    if (cookieConsentToggle) {
        cookieConsentToggle.addEventListener('change', async (e) => {
            await queueStateUpdate(async () => {
                await browser.runtime.sendMessage({
                    type: 'updateCategorySettings',
                    cookieConsent: e.target.checked
                });
                settings.cookieConsent = e.target.checked;
            });
        });
    }
    
    if (antiFingerprintToggle) {
        antiFingerprintToggle.addEventListener('change', async (e) => {
            await queueStateUpdate(async () => {
                await browser.runtime.sendMessage({
                    type: 'updateCategorySettings',
                    antiFingerprint: e.target.checked
                });
                settings.antiFingerprint = e.target.checked;
            });
        });
    }
    
    // Handle export stats (with DOM check)
    const exportStatsBtn = document.getElementById('exportStats');
    if (exportStatsBtn) {
        exportStatsBtn.addEventListener('click', async () => {
            try {
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
            } catch (error) {
                console.error('Error exporting stats:', error);
                alert('Error exporting stats: ' + error.message);
            }
        });
    }
    
    // Handle view full report - show detailed stats in popup (with DOM check)
    const viewFullReportBtn = document.getElementById('viewFullReport');
    if (viewFullReportBtn) {
        viewFullReportBtn.addEventListener('click', () => {
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
                                ${Object.entries(stats.domainStats || {})
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
    }
    
    // Handle support button (with DOM check)
    const supportBtn = document.getElementById('supportBtn');
    if (supportBtn) {
        supportBtn.addEventListener('click', () => {
            try {
                browser.tabs.create({
                    url: 'https://rossnicholson.dev'
                });
            } catch (error) {
                console.error('Error opening support page:', error);
            }
        });
    }
    
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
        
        try {
            if (customRules.length === 0) {
                customRulesList.innerHTML = '<p class="empty-message">No custom rules. Click + to add one.</p>';
                return;
            }
            
            customRulesList.innerHTML = '';
            customRules.forEach((rule, index) => {
                const item = document.createElement('div');
                item.className = 'custom-rule-item';
                
                // Sanitize rule pattern to prevent XSS
                const sanitizedPattern = String(rule.pattern || '').replace(/[<>]/g, '');
                
                item.innerHTML = `
                    <span class="rule-pattern">${sanitizedPattern}</span>
                    <div class="rule-actions">
                        <button class="rule-delete" data-index="${index}">✕</button>
                    </div>
                `;
                
                const deleteBtn = item.querySelector('.rule-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async () => {
                        await queueStateUpdate(async () => {
                            customRules.splice(index, 1);
                            await browser.storage.local.set({ customRules });
                            await browser.runtime.sendMessage({ type: 'customRulesUpdated', rules: customRules });
                            updateCustomRulesList();
                        });
                    });
                }
                
                customRulesList.appendChild(item);
            });
        } catch (error) {
            console.error('Error updating custom rules list:', error);
        }
    }
    
    // Rule Templates
    const ruleTemplates = [
        { name: 'Block All Images', pattern: '*://*/*.jpg', description: 'Blocks all JPEG images' },
        { name: 'Block All Scripts', pattern: '*://*/*.js', description: 'Blocks JavaScript files' },
        { name: 'Block Analytics', pattern: '*://*analytics*', description: 'Blocks analytics domains' },
        { name: 'Block Social Widgets', pattern: '*://*facebook*', description: 'Blocks Facebook widgets' },
        { name: 'Block Video Ads', pattern: '*://*/*ad*.mp4', description: 'Blocks video advertisements' },
        { name: 'Block Tracking Pixels', pattern: '*://*/*pixel*', description: 'Blocks tracking pixels' }
    ];
    
    const showTemplatesBtn = document.getElementById('showTemplates');
    const closeTemplatesBtn = document.getElementById('closeTemplates');
    const templatesGrid = document.getElementById('templatesGrid');
    const ruleTemplatesDiv = document.getElementById('ruleTemplates');
    
    function showTemplates() {
        if (ruleTemplatesDiv && templatesGrid) {
            ruleTemplatesDiv.style.display = 'block';
            templatesGrid.innerHTML = '';
            
            ruleTemplates.forEach(template => {
                const card = document.createElement('div');
                card.className = 'template-card';
                card.innerHTML = `
                    <h4>${template.name}</h4>
                    <p>${template.description}</p>
                `;
                card.addEventListener('click', () => {
                    customRules.push({ pattern: template.pattern, type: 'block', name: template.name });
                    browser.storage.local.set({ customRules });
                    browser.runtime.sendMessage({ type: 'customRulesUpdated', rules: customRules });
                    updateCustomRulesList();
                    ruleTemplatesDiv.style.display = 'none';
                });
                templatesGrid.appendChild(card);
            });
        }
    }
    
    if (showTemplatesBtn) {
        showTemplatesBtn.addEventListener('click', showTemplates);
    }
    if (closeTemplatesBtn) {
        closeTemplatesBtn.addEventListener('click', () => {
            if (ruleTemplatesDiv) ruleTemplatesDiv.style.display = 'none';
        });
    }
    
    if (addCustomRuleBtn) {
        addCustomRuleBtn.addEventListener('click', async () => {
            const pattern = prompt('Enter URL pattern to block (e.g., *://example.com/*):');
            if (pattern && pattern.trim()) {
                const trimmedPattern = pattern.trim();
                
                // Validate pattern
                if (!validateRulePattern(trimmedPattern)) {
                    alert('Invalid pattern format. Please use a valid URL pattern (e.g., *://example.com/*)');
                    return;
                }
                
                await queueStateUpdate(async () => {
                    customRules.push({ pattern: trimmedPattern, type: 'block' });
                    await browser.storage.local.set({ customRules });
                    await browser.runtime.sendMessage({ type: 'customRulesUpdated', rules: customRules });
                    updateCustomRulesList();
                });
            }
        });
    }
    
    await loadCustomRules();
    
    // Site-Specific Rules
    let siteSpecificRules = [];
    const siteRulesList = document.getElementById('siteRulesList');
    const addSiteRuleBtn = document.getElementById('addSiteRule');
    
    async function loadSiteRules() {
        const data = await browser.storage.local.get({ siteSpecificRules: [] });
        siteSpecificRules = data.siteSpecificRules || [];
        updateSiteRulesList();
    }
    
    function updateSiteRulesList() {
        if (!siteRulesList) return;
        
        try {
            if (siteSpecificRules.length === 0) {
                siteRulesList.innerHTML = '<p class="empty-message">No site-specific rules. Create rules that apply only to specific domains.</p>';
                return;
            }
            
            siteRulesList.innerHTML = '';
            siteSpecificRules.forEach((rule, index) => {
                const item = document.createElement('div');
                item.className = 'site-rule-item';
                
                // Sanitize domain to prevent XSS
                const sanitizedDomain = String(rule.domain || '').replace(/[<>]/g, '');
                
                item.innerHTML = `
                    <div class="rule-info">
                        <div class="rule-domain">${sanitizedDomain}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">
                            ${rule.blockAds ? 'Ads' : ''} ${rule.blockTrackers ? 'Trackers' : ''} ${rule.blockSocial ? 'Social' : ''}
                        </div>
                    </div>
                    <div class="rule-actions">
                        <button class="rule-delete" data-index="${index}">✕</button>
                    </div>
                `;
                
                const deleteBtn = item.querySelector('.rule-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', async () => {
                        await queueStateUpdate(async () => {
                            siteSpecificRules.splice(index, 1);
                            await browser.storage.local.set({ siteSpecificRules });
                            await browser.runtime.sendMessage({ type: 'siteRulesUpdated', rules: siteSpecificRules });
                            updateSiteRulesList();
                        });
                    });
                }
                
                siteRulesList.appendChild(item);
            });
        } catch (error) {
            console.error('Error updating site rules list:', error);
        }
    }
    
    if (addSiteRuleBtn) {
        addSiteRuleBtn.addEventListener('click', async () => {
            const domain = currentDomain !== '-' ? currentDomain : prompt('Enter domain (e.g., example.com):');
            if (domain && domain !== '-') {
                // Validate domain
                if (!validateDomain(domain)) {
                    alert('Invalid domain format. Please enter a valid domain (e.g., example.com)');
                    return;
                }
                
                const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
                
                // Check if rule already exists
                if (siteSpecificRules.find(r => r.domain === cleanDomain)) {
                    alert('A rule for this domain already exists.');
                    return;
                }
                
                await queueStateUpdate(async () => {
                    const newRule = {
                        domain: cleanDomain,
                        blockAds: true,
                        blockTrackers: true,
                        blockSocial: false,
                        blockMalware: true
                    };
                    
                    siteSpecificRules.push(newRule);
                    await browser.storage.local.set({ siteSpecificRules });
                    await browser.runtime.sendMessage({ type: 'siteRulesUpdated', rules: siteSpecificRules });
                    updateSiteRulesList();
                });
            }
        });
    }
    
    await loadSiteRules();
    
    // Scheduled Blocking
    let scheduleEnabled = false;
    let scheduleConfig = {
        enabled: false,
        startTime: '09:00',
        endTime: '17:00',
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        mode: 'balanced'
    };
    
    const scheduleEnabledToggle = document.getElementById('scheduleEnabled');
    const scheduleContent = document.getElementById('scheduleContent');
    const scheduleStart = document.getElementById('scheduleStart');
    const scheduleEnd = document.getElementById('scheduleEnd');
    const scheduleMode = document.getElementById('scheduleMode');
    const saveScheduleBtn = document.getElementById('saveSchedule');
    const dayButtons = document.querySelectorAll('.day-btn');
    
    async function loadSchedule() {
        const data = await browser.storage.local.get({ scheduleConfig });
        scheduleConfig = { ...scheduleConfig, ...data.scheduleConfig };
        
        if (scheduleEnabledToggle) {
            scheduleEnabledToggle.checked = scheduleConfig.enabled;
            scheduleEnabled = scheduleConfig.enabled;
        }
        if (scheduleContent) {
            scheduleContent.style.display = scheduleConfig.enabled ? 'block' : 'none';
        }
        if (scheduleStart) scheduleStart.value = scheduleConfig.startTime;
        if (scheduleEnd) scheduleEnd.value = scheduleConfig.endTime;
        if (scheduleMode) scheduleMode.value = scheduleConfig.mode;
        
        // Update day buttons
        dayButtons.forEach(btn => {
            const day = btn.dataset.day;
            if (scheduleConfig.days.includes(day)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    if (scheduleEnabledToggle) {
        scheduleEnabledToggle.addEventListener('change', (e) => {
            scheduleEnabled = e.target.checked;
            scheduleConfig.enabled = scheduleEnabled;
            if (scheduleContent) {
                scheduleContent.style.display = scheduleEnabled ? 'block' : 'none';
            }
            browser.storage.local.set({ scheduleConfig });
            browser.runtime.sendMessage({ type: 'scheduleUpdated', schedule: scheduleConfig });
        });
    }
    
    dayButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const day = btn.dataset.day;
            if (btn.classList.contains('active')) {
                if (!scheduleConfig.days.includes(day)) {
                    scheduleConfig.days.push(day);
                }
            } else {
                scheduleConfig.days = scheduleConfig.days.filter(d => d !== day);
            }
        });
    });
    
    if (saveScheduleBtn) {
        saveScheduleBtn.addEventListener('click', async () => {
            scheduleConfig.startTime = scheduleStart?.value || '09:00';
            scheduleConfig.endTime = scheduleEnd?.value || '17:00';
            scheduleConfig.mode = scheduleMode?.value || 'balanced';
            scheduleConfig.enabled = scheduleEnabled;
            
            await browser.storage.local.set({ scheduleConfig });
            await browser.runtime.sendMessage({ type: 'scheduleUpdated', schedule: scheduleConfig });
            alert('Schedule saved! Blocking will automatically adjust based on your schedule.');
        });
    }
    
    await loadSchedule();
    
    // Check if schedule should be active
    function checkSchedule() {
        if (!scheduleConfig.enabled) return false;
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        
        const [startHour, startMin] = scheduleConfig.startTime.split(':').map(Number);
        const [endHour, endMin] = scheduleConfig.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const currentMinutes = currentHour * 60 + currentMinute;
        
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const currentDay = dayNames[now.getDay()];
        
        const isInTimeRange = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        const isScheduledDay = scheduleConfig.days.includes(currentDay);
        
        return isInTimeRange && isScheduledDay;
    }
    
    // Apply schedule if active
    setInterval(() => {
        if (checkSchedule()) {
            const schedulePreset = presets[scheduleConfig.mode];
            if (schedulePreset) {
                // Apply scheduled preset
                browser.runtime.sendMessage({
                    type: 'updateCategorySettings',
                    ...schedulePreset
                });
            }
        }
    }, 60000); // Check every minute
    
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
            try {
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
            } catch (error) {
                console.error('Error exporting filters:', error);
                alert('Error exporting filters: ' + error.message);
            }
        });
    }
    
    // Performance Metrics
    async function loadPerformanceData() {
        const perfData = await browser.storage.local.get({ pageLoadTimes: [] });
        const loadTimes = perfData.pageLoadTimes || [];
        
        if (loadTimes.length > 0) {
            // Calculate average load time from recent measurements
            const recentTimes = loadTimes.slice(-20).map(t => t.time);
            performanceData.pageLoadTimes = recentTimes;
            performanceData.totalPages = loadTimes.length;
        }
        
        updatePerformanceMetrics();
    }
    
    await loadPerformanceData();
    
    // Charts
    const toggleChartsBtn = document.getElementById('toggleCharts');
    const chartsContainer = document.getElementById('chartsContainer');
    let chartsVisible = false;
    
    if (toggleChartsBtn && chartsContainer) {
        toggleChartsBtn.addEventListener('click', () => {
            chartsVisible = !chartsVisible;
            chartsContainer.style.display = chartsVisible ? 'block' : 'none';
            toggleChartsBtn.textContent = chartsVisible ? 'Hide Charts' : 'Show Charts';
            
            if (chartsVisible) {
                // Draw charts
                setTimeout(() => {
                    // Trend chart (last 7 days)
                    const trendData = Object.values(stats.dailyStats)
                        .slice(-7)
                        .map(day => day.blocked || 0);
                    drawTrendChart('trendChart', trendData);
                    
                    // Category chart
                    drawCategoryChart('categoryChart', {
                        Ads: stats.adsBlocked,
                        Trackers: stats.trackersBlocked,
                        Social: stats.socialBlocked,
                        Malware: stats.malwareBlocked
                    });
                }, 100);
            }
        });
    }
    
    // Onboarding
    const showTutorialBtn = document.getElementById('showTutorial');
    const closeOnboardingBtn = document.getElementById('closeOnboarding');
    const nextSlideBtn = document.getElementById('nextSlide');
    const prevSlideBtn = document.getElementById('prevSlide');
    
    if (showTutorialBtn) {
        showTutorialBtn.addEventListener('click', showOnboarding);
    }
    if (closeOnboardingBtn) {
        closeOnboardingBtn.addEventListener('click', closeOnboarding);
    }
    if (nextSlideBtn) {
        nextSlideBtn.addEventListener('click', nextSlide);
    }
    if (prevSlideBtn) {
        prevSlideBtn.addEventListener('click', prevSlide);
    }
    
    // Check if onboarding should show
    const onboardingData = await browser.storage.local.get({ onboardingCompleted: false });
    if (!onboardingData.onboardingCompleted) {
        // Show onboarding after a short delay
        setTimeout(showOnboarding, 500);
    }
    
    // Help System
    const showHelpBtn = document.getElementById('showHelp');
    const closeHelpBtn = document.getElementById('closeHelp');
    
    if (showHelpBtn) {
        showHelpBtn.addEventListener('click', showHelp);
    }
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', closeHelp);
    }
    
    // Close modals on overlay click
    document.getElementById('onboardingOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'onboardingOverlay') {
            closeOnboarding();
        }
    });
    
    document.getElementById('helpModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'helpModal') {
            closeHelp();
        }
    });
    
    // Reset Stats Button
    const resetStatsBtn = document.getElementById('resetStats');
    if (resetStatsBtn) {
        resetStatsBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
                // Reset all stats to zero
                const resetStats = {
                    totalBlocked: 0,
                    trackersBlocked: 0,
                    adsBlocked: 0,
                    socialBlocked: 0,
                    malwareBlocked: 0,
                    dataSaved: 0,
                    domainStats: {},
                    dailyStats: {},
                    weeklyStats: {},
                    monthlyStats: {},
                    blockingHistory: [],
                    pageLoadTimes: []
                };
                
                // Save to storage
                await browser.storage.local.set(resetStats);
                
                // Notify background script to reset
                await browser.runtime.sendMessage({ type: 'resetStats' });
                
                // Update local stats object
                stats.totalBlocked = 0;
                stats.trackersBlocked = 0;
                stats.adsBlocked = 0;
                stats.socialBlocked = 0;
                stats.malwareBlocked = 0;
                stats.dataSaved = 0;
                stats.domainStats = {};
                stats.dailyStats = {};
                stats.weeklyStats = {};
                stats.monthlyStats = {};
                
                // Update UI
                safeUpdateElement('adsBlocked', (el) => {
                    el.textContent = '0';
                });
                safeUpdateElement('trackersBlocked', (el) => {
                    el.textContent = '0';
                });
                safeUpdateElement('dataSaved', (el) => {
                    el.textContent = '0 KB';
                });
                updateDashboard();
                updateTimeStats(document.querySelector('.time-tab.active')?.dataset.period || 'today');
                updatePerformanceMetrics();
                
                // Reset charts if visible
                if (chartsVisible) {
                    drawTrendChart('trendChart', []);
                    drawCategoryChart('categoryChart', {
                        Ads: 0,
                        Trackers: 0,
                        Social: 0,
                        Malware: 0
                    });
                }
                
                // Reset network monitor
                if (monitorActive) {
                    monitorStats = { blocked: 0, active: 0 };
                    if (monitorBlockedElement) {
                        monitorBlockedElement.textContent = '0';
                    }
                }
            }
        });
    }
    
    // Refresh stats periodically (store interval ID for cleanup)
    const statsRefreshInterval = setInterval(async () => {
        try {
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
                
                // Trim stats periodically
                trimStatsIfNeeded(stats);
                
                safeUpdateElement('adsBlocked', (el) => {
                    el.textContent = stats.adsBlocked.toLocaleString();
                });
                safeUpdateElement('trackersBlocked', (el) => {
                    el.textContent = stats.trackersBlocked.toLocaleString();
                });
                safeUpdateElement('dataSaved', (el) => {
                    el.textContent = formatBytes(stats.dataSaved);
                });
                
                updateDashboard();
                updateTimeStats(document.querySelector('.time-tab.active')?.dataset.period || 'today');
                updatePerformanceMetrics();
                
                // Update charts if visible
                if (chartsVisible) {
                    const trendData = Object.values(stats.dailyStats)
                        .slice(-7)
                        .map(day => day.blocked || 0);
                    drawTrendChart('trendChart', trendData);
                    drawCategoryChart('categoryChart', {
                        Ads: stats.adsBlocked,
                        Trackers: stats.trackersBlocked,
                        Social: stats.socialBlocked,
                        Malware: stats.malwareBlocked
                    });
                }
                
                // Update network monitor if active
                if (monitorActive && monitorBlockedElement) {
                    monitorBlockedElement.textContent = monitorStats.blocked;
                }
            }
        } catch (error) {
            console.error('Error refreshing stats:', error);
        }
    }, 2000);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (statsRefreshInterval) {
            clearInterval(statsRefreshInterval);
        }
    });
    
    // Debug/Troubleshooting Section
    const debugSection = document.getElementById('debugSection');
    const toggleDebugBtn = document.getElementById('toggleDebug');
    const extensionStatus = document.getElementById('extensionStatus');
    const blockingEnabled = document.getElementById('blockingEnabled');
    const recentRequests = document.getElementById('recentRequests');
    const testBlockingBtn = document.getElementById('testBlocking');
    const testResult = document.getElementById('testResult');
    let debugMode = false;
    let requestLog = [];
    const MAX_LOG_ENTRIES = 50;
    
    // Check extension status (defined inside try block)
    async function checkExtensionStatus() {
        try {
            const response = await browser.runtime.sendMessage({ type: 'getStats' });
            if (response) {
                if (extensionStatus) {
                    extensionStatus.textContent = '✓ Active';
                    extensionStatus.style.color = 'var(--primary-color)';
                }
            } else {
                if (extensionStatus) {
                    extensionStatus.textContent = '✗ Not Responding';
                    extensionStatus.style.color = 'red';
                }
            }
        } catch (error) {
            if (extensionStatus) {
                extensionStatus.textContent = '✗ Error: ' + error.message;
                extensionStatus.style.color = 'red';
            }
        }
        
        try {
            // Check blocking enabled state
            const data = await browser.storage.local.get({ enabled: true, settings: {} });
            if (blockingEnabled) {
                const enabled = data.enabled && (data.settings?.blockAds !== false);
                blockingEnabled.textContent = enabled ? '✓ Yes' : '✗ No';
                blockingEnabled.style.color = enabled ? 'var(--primary-color)' : 'red';
            }
        } catch (error) {
            console.error('Error checking blocking status:', error);
        }
    }
    
    // Update recent requests display (defined inside try block)
    function updateRecentRequests() {
        if (!recentRequests) return;
        
        try {
            if (requestLog.length === 0) {
                recentRequests.innerHTML = '<p class="empty-message">No requests logged yet. Visit a page with ads to see activity.</p>';
                return;
            }
            
            recentRequests.innerHTML = '';
            const recent = requestLog.slice(-10).reverse();
            recent.forEach(entry => {
                const item = document.createElement('div');
                item.className = `request-entry ${entry.blocked ? 'blocked' : 'allowed'}`;
                item.innerHTML = `
                    <div class="request-status">${entry.blocked ? '🚫 BLOCKED' : '✓ Allowed'}</div>
                    <div class="request-url" title="${entry.url}">${entry.domain || entry.url.substring(0, 50)}...</div>
                    <div class="request-time">${new Date(entry.timestamp).toLocaleTimeString()}</div>
                `;
                recentRequests.appendChild(item);
            });
        } catch (error) {
            console.error('Error updating recent requests:', error);
        }
    }
    
    // Test blocking (simplified)
    if (testBlockingBtn) {
        testBlockingBtn.addEventListener('click', async () => {
            if (!testResult) return;
            testResult.innerHTML = '<p style="color: var(--text-secondary);">Testing...</p>';
            
            try {
                // Check if extension is working
                const statsResponse = await browser.runtime.sendMessage({ type: 'getStats' });
                const settingsResponse = await browser.storage.local.get({ enabled: true, settings: {} });
                
                let html = '<div class="test-results">';
                
                // Test 1: Extension responding
                if (statsResponse) {
                    html += `<div class="test-item blocked">
                        <span>✓</span>
                        <span>Extension is working</span>
                    </div>`;
                } else {
                    html += `<div class="test-item not-blocked">
                        <span>✗</span>
                        <span>Extension not responding</span>
                    </div>`;
                }
                
                // Test 2: Blocking enabled
                if (settingsResponse.enabled && settingsResponse.settings?.blockAds !== false) {
                    html += `<div class="test-item blocked">
                        <span>✓</span>
                        <span>Ad blocking is enabled</span>
                    </div>`;
                } else {
                    html += `<div class="test-item not-blocked">
                        <span>✗</span>
                        <span>Ad blocking is disabled - turn it on above!</span>
                    </div>`;
                }
                
                // Test 3: Stats showing activity
                if (statsResponse && statsResponse.totalBlocked > 0) {
                    html += `<div class="test-item blocked">
                        <span>✓</span>
                        <span>Has blocked ${statsResponse.totalBlocked} items</span>
                    </div>`;
                } else {
                    html += `<div class="test-item not-blocked">
                        <span>ℹ️</span>
                        <span>No items blocked yet - visit a website with ads</span>
                    </div>`;
                }
                
                html += '</div>';
                testResult.innerHTML = html;
            } catch (error) {
                testResult.innerHTML = `<p style="color: var(--danger-color);">Error: ${error.message}</p>`;
            }
        });
    }
    
    // Listen for request logs from background script
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'requestLog') {
            requestLog.push({
                url: message.url,
                domain: message.domain,
                blocked: message.blocked,
                timestamp: Date.now()
            });
            
            // Keep only recent entries
            if (requestLog.length > MAX_LOG_ENTRIES) {
                requestLog = requestLog.slice(-MAX_LOG_ENTRIES);
            }
            
            updateRecentRequests();
        }
        return true; // Keep channel open for async response
    });
    
    // Show debug section (collapsed by default to save space)
    if (debugSection) {
        debugSection.style.display = 'block';
        // Collapse debug content by default
        const debugContent = document.getElementById('debugContent');
        if (debugContent) {
            debugContent.style.display = 'none';
        }
        // Update button text
        if (toggleDebugBtn) {
            toggleDebugBtn.textContent = 'Show Details';
        }
    }
    
    // Simple toggle - just show/hide the troubleshooting details
    if (toggleDebugBtn) {
        toggleDebugBtn.addEventListener('click', (e) => {
            const debugContent = document.getElementById('debugContent');
            if (debugContent) {
                const isVisible = debugContent.style.display !== 'none';
                debugContent.style.display = isVisible ? 'none' : 'block';
                toggleDebugBtn.textContent = isVisible ? 'Show Details' : 'Hide Details';
            }
        });
    }
    
    // Initial status check
    checkExtensionStatus();
    setInterval(checkExtensionStatus, 5000); // Check every 5 seconds
    updateRecentRequests();
    
    }
    } catch (error) {
        console.error('Error initializing popup:', error);
        // Show error to user
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding: 16px; background: #ff3b30; color: white; border-radius: 8px; margin: 16px 0;';
            errorDiv.innerHTML = '<strong>Error loading extension:</strong><br>' + error.message + '<br><br>Please try reloading the extension.';
            container.insertBefore(errorDiv, container.firstChild);
        }
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Performance Metrics
let performanceData = {
    pageLoadTimes: [],
    baselineLoadTime: 3000, // 3 seconds baseline
    totalPages: 0
};

async function updatePerformanceMetrics() {
    try {
        const loadSpeedElement = document.getElementById('loadSpeed');
        const batterySavedElement = document.getElementById('batterySaved');
        
        if (!loadSpeedElement || !batterySavedElement) return;
        
        // Calculate average page load improvement
        const avgLoadTime = performanceData.pageLoadTimes.length > 0
            ? performanceData.pageLoadTimes.reduce((a, b) => a + b, 0) / performanceData.pageLoadTimes.length
            : performanceData.baselineLoadTime;
        
        const improvement = ((performanceData.baselineLoadTime - avgLoadTime) / performanceData.baselineLoadTime) * 100;
        loadSpeedElement.textContent = improvement > 0 ? `+${Math.round(improvement)}%` : '0%';
        loadSpeedElement.style.color = improvement > 0 ? 'var(--primary-color)' : 'var(--text-secondary)';
        
        // Estimate battery savings (rough calculation)
        const estimatedBatterySaved = Math.min(15, Math.round((stats.totalBlocked / 100) * 0.5));
        batterySavedElement.textContent = `${estimatedBatterySaved}%`;
    } catch (error) {
        console.error('Error updating performance metrics:', error);
    }
}

// Chart Drawing Functions
function drawTrendChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (!data || data.length === 0) {
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data yet', width / 2, height / 2);
        return;
    }
    
    // Draw simple line chart
    ctx.strokeStyle = 'var(--primary-color)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const maxValue = Math.max(...data);
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    data.forEach((value, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = height - padding - (value / maxValue) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = 'var(--primary-color)';
    data.forEach((value, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = height - padding - (value / maxValue) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawCategoryChart(canvasId, categories) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    if (total === 0) {
        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data yet', width / 2, height / 2);
        return;
    }
    
    // Draw pie chart
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;
    
    let currentAngle = -Math.PI / 2;
    const colors = ['#34C759', '#FF9500', '#007AFF', '#FF3B30'];
    let colorIndex = 0;
    
    Object.entries(categories).forEach(([label, value]) => {
        const sliceAngle = (value / total) * Math.PI * 2;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[colorIndex % colors.length];
        ctx.fill();
        
        // Label
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
        ctx.fillStyle = 'white';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label.substring(0, 4), labelX, labelY);
        
        currentAngle += sliceAngle;
        colorIndex++;
    });
}

// Onboarding System
const onboardingSlides = [
    {
        title: 'Welcome to Adios!',
        content: `
            <p>Adios is an advanced ad blocker with powerful features to protect your privacy and improve your browsing experience.</p>
            <p>Let's take a quick tour of the key features.</p>
        `
    },
    {
        title: 'Smart Filter Presets',
        content: `
            <p>Choose from three blocking modes:</p>
            <ul style="text-align: left; margin: 12px 0;">
                <li><strong>Strict:</strong> Maximum privacy, blocks everything</li>
                <li><strong>Balanced:</strong> Blocks ads and trackers (recommended)</li>
                <li><strong>Relaxed:</strong> Minimal blocking, only ads</li>
            </ul>
        `
    },
    {
        title: 'Custom Rules Editor',
        content: `
            <p>Create your own blocking rules for specific domains or patterns.</p>
            <p>Click the "+" button to add custom rules that match your needs.</p>
        `
    },
    {
        title: 'Privacy Dashboard',
        content: `
            <p>Monitor your privacy protection with:</p>
            <ul style="text-align: left; margin: 12px 0;">
                <li>Privacy Score (0-100)</li>
                <li>Top blocked domains</li>
                <li>Category breakdown</li>
            </ul>
        `
    },
    {
        title: 'You\'re All Set!',
        content: `
            <p>Adios is now protecting your privacy. Browse the web faster and safer!</p>
            <p>You can access help anytime by clicking the "Help & Documentation" button.</p>
        `
    }
];

let currentSlide = 0;

function showOnboarding() {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        showSlide(0);
    }
}

function showSlide(index) {
    currentSlide = index;
    const slideContainer = document.getElementById('onboardingSlide');
    const indicator = document.getElementById('slideIndicator');
    const prevBtn = document.getElementById('prevSlide');
    const nextBtn = document.getElementById('nextSlide');
    
    if (!slideContainer) return;
    
    const slide = onboardingSlides[index];
    slideContainer.innerHTML = `
        <h2>${slide.title}</h2>
        ${slide.content}
    `;
    
    if (indicator) {
        indicator.textContent = `${index + 1} / ${onboardingSlides.length}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = index === 0;
    }
    
    if (nextBtn) {
        nextBtn.textContent = index === onboardingSlides.length - 1 ? 'Finish' : 'Next →';
    }
}

function nextSlide() {
    if (currentSlide < onboardingSlides.length - 1) {
        showSlide(currentSlide + 1);
    } else {
        closeOnboarding();
        // Mark onboarding as completed
        browser.storage.local.set({ onboardingCompleted: true });
    }
}

function prevSlide() {
    if (currentSlide > 0) {
        showSlide(currentSlide - 1);
    }
}

function closeOnboarding() {
    const overlay = document.getElementById('onboardingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Help System Content
const helpContent = `
    <div class="help-section-title">Getting Started</div>
    <div class="help-item">
        <h4>How do I enable Adios?</h4>
        <p>1. Open iPhone Settings → Safari → Extensions<br>
        2. Find Adios and toggle it ON<br>
        3. Grant permission when Safari asks</p>
    </div>
    
    <div class="help-section-title">Smart Filter Presets</div>
    <div class="help-item">
        <h4>What's the difference between presets?</h4>
        <p><strong>Strict:</strong> Blocks all ads, trackers, social media, and malware. Maximum privacy.</p>
        <p><strong>Balanced:</strong> Blocks ads and trackers. Recommended for most users.</p>
        <p><strong>Relaxed:</strong> Only blocks ads and malware. Minimal interference.</p>
    </div>
    
    <div class="help-section-title">Custom Rules</div>
    <div class="help-item">
        <h4>How do I create custom rules?</h4>
        <p>Click the "+" button in Custom Rules section. Enter a URL pattern like:<br>
        <code>*://example.com/*</code> to block all requests from example.com</p>
    </div>
    
    <div class="help-section-title">Privacy Score</div>
    <div class="help-item">
        <h4>What does the privacy score mean?</h4>
        <p>The score (0-100) indicates how well Adios is protecting you on the current site. Higher scores mean better protection.</p>
    </div>
    
    <div class="help-section-title">Performance Metrics</div>
    <div class="help-item">
        <h4>How are performance metrics calculated?</h4>
        <p>Page load speed improvement is based on blocked requests reducing page load time. Battery savings are estimated based on reduced network activity.</p>
    </div>
    
    <div class="help-section-title">Troubleshooting</div>
    <div class="help-item">
        <h4>Ads are still showing</h4>
        <p>1. Make sure Adios is enabled in Safari Settings<br>
        2. Check that blocking is enabled in the popup<br>
        3. Verify the site isn't in your exceptions list</p>
    </div>
    <div class="help-item">
        <h4>Website is broken</h4>
        <p>Try adding the site to exceptions or switching to Relaxed mode. Some sites require certain scripts to function properly.</p>
    </div>
`;

function showHelp() {
    const modal = document.getElementById('helpModal');
    const content = document.getElementById('helpContent');
    if (modal && content) {
        content.innerHTML = helpContent;
        modal.style.display = 'flex';
    }
}

function closeHelp() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
