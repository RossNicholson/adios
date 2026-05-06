// Browser API polyfill for compatibility
if (typeof browser === 'undefined') {
    globalThis.browser = typeof chrome !== 'undefined' ? chrome : {};
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

                    // Load per-site overrides, block rate, and cosmetic rules
                    // (these functions are defined below; they run after DOMContentLoaded finishes)
                    setTimeout(() => {
                        loadSiteOverrides(domain).catch(() => {});
                        checkBlockRate(domain).catch(() => {});
                    }, 100);
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
    
    // Handle "Allow Ads on This Site" button
    const toggleExceptionBtn = document.getElementById('toggleException');
    if (toggleExceptionBtn) {
        toggleExceptionBtn.addEventListener('click', async () => {
            if (!currentDomain || currentDomain === '-') return;
            try {
                const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
                const isExcepted = exceptions.includes(currentDomain);
                let updated;
                if (isExcepted) {
                    updated = exceptions.filter(d => d !== currentDomain);
                } else {
                    updated = [...exceptions, currentDomain];
                }
                await browser.storage.local.set({ exceptions: updated });
                // Notify background script
                try {
                    await browser.runtime.sendMessage({ type: 'exceptionsUpdated', exceptions: updated });
                } catch (e) { /* background may not be listening */ }
                // Update button UI
                const nowExcepted = updated.includes(currentDomain);
                toggleExceptionBtn.textContent = nowExcepted ? 'Remove from Exceptions' : 'Allow Ads on This Site';
                toggleExceptionBtn.classList.toggle('excepted', nowExcepted);
                // Refresh the exceptions list
                await updateExceptionsList();
            } catch (e) {
                console.error('Error toggling exception:', e);
            }
        });
    }

    // ── Per-site category overrides ──────────────────────────────────────────
    let currentSiteOverrides = null; // null = no override (follow global)

    async function loadSiteOverrides(domain) {
        if (!domain || domain === '-') return;
        try {
            const resp = await browser.runtime.sendMessage({ type: 'getSiteSettings', domain });
            currentSiteOverrides = resp?.settings || null;
            renderSiteOverrides(domain);
            await loadCosmeticRules(domain);
        } catch (e) { console.error('Error loading site overrides:', e); }
    }

    function renderSiteOverrides(domain) {
        const ovr = currentSiteOverrides || {};
        const hasOverride = currentSiteOverrides !== null;

        const setOvr = (id, key, globalVal) => {
            const el = document.getElementById(id);
            const hint = document.getElementById(id + 'Hint');
            if (!el) return;
            el.checked = ovr[key] !== undefined ? ovr[key] : globalVal;
            if (hint) hint.textContent = ovr[key] !== undefined ? '(custom)' : '';
        };
        setOvr('siteBlockAds',      'blockAds',      settings.blockAds);
        setOvr('siteBlockTrackers', 'blockTrackers', settings.blockTrackers);
        setOvr('siteBlockSocial',   'blockSocial',   settings.blockSocial);
        setOvr('siteCookieConsent', 'cookieConsent', settings.cookieConsent);

        const resetBtn = document.getElementById('resetSiteOverrides');
        if (resetBtn) resetBtn.style.display = hasOverride ? 'inline-block' : 'none';
    }

    async function saveSiteOverride(key, value) {
        if (!currentDomain || currentDomain === '-') return;
        const current = currentSiteOverrides || {};
        current[key] = value;
        currentSiteOverrides = current;
        await browser.runtime.sendMessage({ type: 'setSiteSettings', domain: currentDomain, settings: current });
        renderSiteOverrides(currentDomain);
    }

    ['siteBlockAds', 'siteBlockTrackers', 'siteBlockSocial', 'siteCookieConsent'].forEach(id => {
        const keyMap = { siteBlockAds: 'blockAds', siteBlockTrackers: 'blockTrackers', siteBlockSocial: 'blockSocial', siteCookieConsent: 'cookieConsent' };
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => saveSiteOverride(keyMap[id], el.checked));
    });

    const resetSiteBtn = document.getElementById('resetSiteOverrides');
    if (resetSiteBtn) {
        resetSiteBtn.addEventListener('click', async () => {
            if (!currentDomain || currentDomain === '-') return;
            currentSiteOverrides = null;
            await browser.runtime.sendMessage({ type: 'setSiteSettings', domain: currentDomain, settings: null });
            renderSiteOverrides(currentDomain);
        });
    }

    // ── Broken page indicator ─────────────────────────────────────────────
    async function checkBlockRate(domain) {
        if (!domain || domain === '-') return;
        try {
            const resp = await browser.runtime.sendMessage({ type: 'getPageBlockRate', domain });
            const warning = document.getElementById('brokenPageWarning');
            const text = document.getElementById('brokenPageText');
            if (!warning || !resp) return;
            // Show warning if > 25% of requests blocked AND > 8 blocked total
            const show = resp.rate > 0.25 && resp.blocked > 8;
            warning.style.display = show ? 'flex' : 'none';
            if (show && text) {
                text.textContent = `${Math.round(resp.rate * 100)}% of requests blocked (${resp.blocked}/${resp.total}) — content may be missing.`;
            }
        } catch (e) { /* background unavailable */ }
    }

    const brokenPageFixBtn = document.getElementById('brokenPageFix');
    if (brokenPageFixBtn) {
        brokenPageFixBtn.addEventListener('click', () => {
            // Scroll to site overrides and highlight them
            const ovr = document.getElementById('siteOverrides');
            if (ovr) ovr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // ── Element picker ────────────────────────────────────────────────────
    let pickerActive = false;

    async function activatePicker() {
        if (!currentDomain || currentDomain === '-') return;
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) return;
            await browser.tabs.sendMessage(tabs[0].id, { type: 'activatePicker' });
            pickerActive = true;
            const btn = document.getElementById('pickElement');
            if (btn) { btn.textContent = '✕ Cancel Pick'; btn.classList.add('active'); }
        } catch (e) { console.error('Could not activate picker:', e); }
    }

    async function deactivatePicker() {
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) await browser.tabs.sendMessage(tabs[0].id, { type: 'deactivatePicker' }).catch(() => {});
        } catch (_) {}
        pickerActive = false;
        const btn = document.getElementById('pickElement');
        if (btn) { btn.textContent = '🎯 Pick Element'; btn.classList.remove('active'); }
    }

    const pickBtn = document.getElementById('pickElement');
    if (pickBtn) {
        pickBtn.addEventListener('click', () => {
            if (pickerActive) { deactivatePicker(); } else { activatePicker(); }
        });
    }

    // ── Cosmetic rules management ─────────────────────────────────────────
    async function loadCosmeticRules(domain) {
        if (!domain || domain === '-') return;
        try {
            const resp = await browser.runtime.sendMessage({ type: 'getCosmeticRules', domain });
            const rules = resp?.rules || [];
            const section = document.getElementById('cosmeticRulesSection');
            const list = document.getElementById('cosmeticRulesList');
            const count = document.getElementById('cosmeticRulesCount');
            if (!section || !list || !count) return;
            count.textContent = rules.length;
            section.style.display = rules.length > 0 ? 'block' : 'none';
            list.innerHTML = '';
            rules.forEach(selector => {
                const li = document.createElement('li');
                li.innerHTML = `<span title="${selector}">${selector}</span>`;
                const del = document.createElement('button');
                del.textContent = '×';
                del.title = 'Remove rule';
                del.addEventListener('click', async () => {
                    await browser.runtime.sendMessage({ type: 'removeCosmeticRule', domain, selector });
                    await loadCosmeticRules(domain);
                });
                li.appendChild(del);
                list.appendChild(li);
            });
        } catch (e) { console.error('Error loading cosmetic rules:', e); }
    }

    const clearCosmeticBtn = document.getElementById('clearCosmeticRules');
    if (clearCosmeticBtn) {
        clearCosmeticBtn.addEventListener('click', async () => {
            if (!currentDomain) return;
            const resp = await browser.runtime.sendMessage({ type: 'getCosmeticRules', domain: currentDomain });
            for (const selector of (resp?.rules || [])) {
                await browser.runtime.sendMessage({ type: 'removeCosmeticRule', domain: currentDomain, selector });
            }
            await loadCosmeticRules(currentDomain);
        });
    }

    // ── EasyList status & update ──────────────────────────────────────────
    async function updateEasyListStatus() {
        const { easyListCount = 0, easyListLastFetched = 0 } = await browser.storage.local.get({
            easyListCount: 0, easyListLastFetched: 0
        });
        const statusEl = document.getElementById('easyListStatus');
        const badge = document.getElementById('easyListBadge');
        if (statusEl) {
            if (easyListLastFetched === 0) {
                statusEl.textContent = 'Not yet loaded';
            } else {
                const ageH = Math.round((Date.now() - easyListLastFetched) / 3_600_000);
                statusEl.textContent = `${easyListCount.toLocaleString()} domains · updated ${ageH < 1 ? 'just now' : ageH + 'h ago'}`;
            }
        }
        if (badge && easyListCount > 0) badge.textContent = easyListCount.toLocaleString();
    }

    updateEasyListStatus();

    const refreshEasyListBtn = document.getElementById('refreshEasyList');
    if (refreshEasyListBtn) {
        refreshEasyListBtn.addEventListener('click', async () => {
            refreshEasyListBtn.textContent = '↻ Updating...';
            refreshEasyListBtn.disabled = true;
            try {
                const resp = await browser.runtime.sendMessage({ type: 'refreshEasyList' });
                refreshEasyListBtn.textContent = `✓ ${(resp?.count || 0).toLocaleString()} domains`;
                await updateEasyListStatus();
                setTimeout(() => { refreshEasyListBtn.textContent = '↻ Update Now'; refreshEasyListBtn.disabled = false; }, 3000);
            } catch (e) {
                refreshEasyListBtn.textContent = '↻ Update Now';
                refreshEasyListBtn.disabled = false;
            }
        });
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
    
    // Handle "Add" button for manual exceptions
    const saveManualEntryBtn = document.getElementById('saveManualEntry');
    if (saveManualEntryBtn) {
        saveManualEntryBtn.addEventListener('click', async () => {
            const input = document.getElementById('manualDomain');
            if (!input) return;
            const domain = input.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
            if (!domain) return;
            try {
                const { exceptions = [] } = await browser.storage.local.get({ exceptions: [] });
                if (!exceptions.includes(domain)) {
                    const updated = [...exceptions, domain];
                    await browser.storage.local.set({ exceptions: updated });
                    try { await browser.runtime.sendMessage({ type: 'exceptionsUpdated', exceptions: updated }); } catch (_) {}
                    await updateExceptionsList();
                }
                input.value = '';
                const manualEntry = document.getElementById('manualEntry');
                if (manualEntry) manualEntry.style.display = 'none';
            } catch (e) {
                console.error('Error adding manual exception:', e);
            }
        });
    }

    // Handle Enter key in manual entry
    const manualDomainInput = document.getElementById('manualDomain');
    if (manualDomainInput) {
        manualDomainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const btn = document.getElementById('saveManualEntry');
                if (btn) btn.click();
            }
        });
    }

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
    
    // Handle support button (with DOM check)
    const supportBtn = document.getElementById('supportBtn');
    if (supportBtn) {
        supportBtn.addEventListener('click', () => {
            try {
                browser.tabs.create({
                    url: 'https://rossnicholson.dev/support'
                });
            } catch (error) {
                console.error('Error opening support page:', error);
            }
        });
    }
    
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
                    monthlyStats: {}
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
                updateTimeStats(document.querySelector('.time-tab.active')?.dataset.period || 'today');

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
                
                updateTimeStats(document.querySelector('.time-tab.active')?.dataset.period || 'today');

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
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i === 0) return bytes + ' B';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}


