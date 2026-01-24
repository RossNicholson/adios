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
    
    // Update dashboard
    function updateDashboard() {
        // Top domain
        const topDomain = Object.entries(stats.domainStats)
            .sort((a, b) => b[1] - a[1])[0];
        topDomainElement.textContent = topDomain ? topDomain[0] : '-';
        
        // Category breakdown
        adsCountElement.textContent = stats.adsBlocked.toLocaleString();
        trackersCountElement.textContent = stats.trackersBlocked.toLocaleString();
    }
    
    updateDashboard();
    
    // Get current tab info
    const tabs = await browser.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        currentDomainElement.textContent = domain;
        
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
