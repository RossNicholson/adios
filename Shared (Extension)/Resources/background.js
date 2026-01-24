// Common ad network domains and patterns
const adPatterns = [
    "*://*.doubleclick.net/*",
    "*://partner.googleadservices.com/*",
    "*://*.googlesyndication.com/*",
    "*://*.googletagservices.com/*",
    "*://*.amazon-adsystem.com/*",
    "*://*.adnxs.com/*",
    "*://*.advertising.com/*",
    "*://*.outbrain.com/*",
    "*://*.taboola.com/*",
    "*://pagead2.googlesyndication.com/*",
    "*://*.adroll.com/*",
    "*://*.mediamath.com/*",
    "*://*.rubiconproject.com/*",
    "*://*.openx.net/*",
    "*://*.pubmatic.com/*",
];

// Tracker domains
const trackerPatterns = [
    "*://*.google-analytics.com/*",
    "*://*.scorecardresearch.com/*",
    "*://*.quantserve.com/*",
    "*://*.criteo.com/*",
    "*://*.adservice.google.com/*",
    "*://*.analytics.google.com/*",
    "*://*.googletagmanager.com/*",
    "*://*.facebook.com/tr*",
    "*://*.facebook.net/*",
    "*://*.hotjar.com/*",
    "*://*.mouseflow.com/*",
];

// Social media tracking
const socialPatterns = [
    "*://*.facebook.com/*",
    "*://*.fbcdn.net/*",
    "*://*.twitter.com/*",
    "*://*.twimg.com/*",
    "*://*.linkedin.com/*",
    "*://*.pinterest.com/*",
    "*://*.instagram.com/*",
];

// Malware/phishing patterns
const malwarePatterns = [
    "*://*.malware.com/*",
    "*://*.phishing.com/*",
];

// Common ad element selectors
const adSelectors = [
    'div[id*="google_ads"]',
    'ins.adsbygoogle',
    'div[class*="sponsored-content"]',
    'div[class*="taboola"]',
    'div[class*="outbrain"]',
    'div[id*="taboola"]',
    'div[id*="outbrain"]',
    'div[data-ad-slot]',
    'div[data-ad-unit]',
    '[class*="-advertisement-"]',
    'iframe[src*="/ads/"]',
    'iframe[src*="doubleclick"]'
];

// Track statistics
let stats = {
    totalBlocked: 0,
    trackersBlocked: 0,
    adsBlocked: 0,
    socialBlocked: 0,
    malwareBlocked: 0,
    dataSaved: 0,
    siteStats: {},
    domainStats: {},
    dailyStats: {},
    weeklyStats: {},
    monthlyStats: {}
};

// Load settings
let settings = {
    enabled: true,
    blockAds: true,
    blockTrackers: true,
    blockSocial: true,
    blockMalware: true,
    cookieConsent: true,
    antiFingerprint: true,
    exceptions: [],
    filterLists: {
        easyList: true,
        privacyList: true
    }
};

// Load saved settings and stats
browser.storage.local.get().then(data => {
    stats = { ...stats, ...data };
    settings = { ...settings, ...data };
});

// Helper function to estimate request size
function estimateRequestSize(details) {
    // Try to get actual content length from response headers if available
    if (details.responseHeaders) {
        const contentLengthHeader = details.responseHeaders.find(
            header => header.name.toLowerCase() === 'content-length'
        );
        if (contentLengthHeader) {
            const size = parseInt(contentLengthHeader.value, 10);
            if (!isNaN(size) && size > 0) {
                return size;
            }
        }
    }
    
    // Fallback: estimate based on URL and headers
    // Average ad request is typically 10-50KB, use conservative estimate
    let size = details.url.length * 10; // Rough estimate
    if (details.requestHeaders) {
        size += JSON.stringify(details.requestHeaders).length;
    }
    // Use minimum estimate to avoid overcounting
    return Math.max(size, 5000); // Minimum 5KB estimate per blocked request
}

// Helper function to determine block category
function getBlockCategory(url) {
    const domain = url.hostname.toLowerCase();
    
    // Check tracker patterns
    if (trackerPatterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
        return regex.test(url.href);
    })) {
        return 'tracker';
    }
    
    // Check social patterns
    if (socialPatterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
        return regex.test(url.href);
    })) {
        return 'social';
    }
    
    // Check malware patterns
    if (malwarePatterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
        return regex.test(url.href);
    })) {
        return 'malware';
    }
    
    // Default to ad
    return 'ad';
}

// Helper function to check if should block based on category
function shouldBlockCategory(category) {
    if (!settings.enabled) return false;
    
    switch(category) {
        case 'ad': return settings.blockAds;
        case 'tracker': return settings.blockTrackers;
        case 'social': return settings.blockSocial;
        case 'malware': return settings.blockMalware;
        default: return false;
    }
}

// Helper function to update time-based stats
function updateTimeStats(category, size) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    
    if (!stats.dailyStats[today]) {
        stats.dailyStats[today] = { blocked: 0, dataSaved: 0 };
    }
    if (!stats.weeklyStats[weekStart]) {
        stats.weeklyStats[weekStart] = { blocked: 0, dataSaved: 0 };
    }
    if (!stats.monthlyStats[monthStart]) {
        stats.monthlyStats[monthStart] = { blocked: 0, dataSaved: 0 };
    }
    
    stats.dailyStats[today].blocked++;
    stats.dailyStats[today].dataSaved += size;
    stats.weeklyStats[weekStart].blocked++;
    stats.weeklyStats[weekStart].dataSaved += size;
    stats.monthlyStats[monthStart].blocked++;
    stats.monthlyStats[monthStart].dataSaved += size;
}

// Block requests
const allPatterns = [...adPatterns, ...trackerPatterns, ...socialPatterns, ...malwarePatterns];

browser.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (!settings.enabled) return { cancel: false };
        
        try {
            const url = new URL(details.url);
            const domain = url.hostname;
            
            // Don't block if URL contains cookie-related paths (unless cookie consent is enabled)
            if (!settings.cookieConsent && (url.pathname.toLowerCase().includes('cookie') || 
                url.pathname.toLowerCase().includes('consent') ||
                url.pathname.toLowerCase().includes('gdpr'))) {
                return { cancel: false };
            }

            // Check exceptions
            const originDomain = details.originUrl ? new URL(details.originUrl).hostname : '';
            
            // Don't block if site is in exceptions
            if (settings.exceptions && settings.exceptions.length > 0 &&
                (settings.exceptions.includes(domain) || 
                 settings.exceptions.includes(originDomain))) {
                return { cancel: false };
            }

            // Determine category and check if should block
            const category = getBlockCategory(url);
            if (!shouldBlockCategory(category)) {
                return { cancel: false };
            }

            // Update statistics
            stats.totalBlocked++;
            const dataSize = estimateRequestSize(details);
            stats.dataSaved += dataSize;
            
            // Update category-specific stats
            switch(category) {
                case 'ad':
                    stats.adsBlocked++;
                    break;
                case 'tracker':
                    stats.trackersBlocked++;
                    break;
                case 'social':
                    stats.socialBlocked++;
                    break;
                case 'malware':
                    stats.malwareBlocked++;
                    break;
            }
            
            // Update domain stats
            stats.domainStats[domain] = (stats.domainStats[domain] || 0) + 1;
            
            // Update site-specific stats
            let tabDomain = '';
            if (details.originUrl) {
                tabDomain = new URL(details.originUrl).hostname;
            } else if (details.documentUrl) {
                tabDomain = new URL(details.documentUrl).hostname;
            } else {
                tabDomain = domain;
            }
            
            stats.siteStats[tabDomain] = (stats.siteStats[tabDomain] || 0) + 1;
            
            // Update time-based stats
            updateTimeStats(category, dataSize);
            
            // Save stats
            browser.storage.local.set({
                totalBlocked: stats.totalBlocked,
                trackersBlocked: stats.trackersBlocked,
                adsBlocked: stats.adsBlocked,
                socialBlocked: stats.socialBlocked,
                malwareBlocked: stats.malwareBlocked,
                dataSaved: stats.dataSaved,
                domainStats: stats.domainStats,
                dailyStats: stats.dailyStats,
                weeklyStats: stats.weeklyStats,
                monthlyStats: stats.monthlyStats,
                [`site:${tabDomain}`]: stats.siteStats[tabDomain]
            });

            return { cancel: true };
        } catch (error) {
            console.error('Error in onBeforeRequest:', error);
            return { cancel: false };
        }
    },
    { urls: allPatterns },
    ["blocking"]
);

// Handle messages from popup and options
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        switch (request.type) {
            case "getAdSelectors":
                return Promise.resolve({ 
                    selectors: settings.enabled ? adSelectors : [],
                    settings: {
                        enabled: settings.enabled,
                        cookieConsent: settings.cookieConsent,
                        antiFingerprint: settings.antiFingerprint
                    }
                });
            
            case "toggleBlocking":
                settings.enabled = request.enabled;
                browser.storage.local.set({ enabled: settings.enabled });
                return Promise.resolve();
            
            case "settingsUpdated":
                settings = { ...settings, ...request.settings };
                browser.storage.local.set({ settings: settings });
                return Promise.resolve();
            
            case "exceptionsUpdated":
                settings.exceptions = request.exceptions || [];
                browser.storage.local.set({ exceptions: settings.exceptions });
                return Promise.resolve();
                
            case "getStats":
                return Promise.resolve({
                    totalBlocked: stats.totalBlocked,
                    trackersBlocked: stats.trackersBlocked,
                    adsBlocked: stats.adsBlocked,
                    socialBlocked: stats.socialBlocked,
                    malwareBlocked: stats.malwareBlocked,
                    dataSaved: stats.dataSaved,
                    siteStats: stats.siteStats,
                    domainStats: stats.domainStats,
                    dailyStats: stats.dailyStats,
                    weeklyStats: stats.weeklyStats,
                    monthlyStats: stats.monthlyStats
                });
            
            case "getTopDomain":
                const topDomain = Object.entries(stats.domainStats)
                    .sort((a, b) => b[1] - a[1])[0];
                return Promise.resolve(topDomain ? { domain: topDomain[0], count: topDomain[1] } : null);
            
            case "updateCategorySettings":
                if (request.blockAds !== undefined) settings.blockAds = request.blockAds;
                if (request.blockTrackers !== undefined) settings.blockTrackers = request.blockTrackers;
                if (request.blockSocial !== undefined) settings.blockSocial = request.blockSocial;
                if (request.blockMalware !== undefined) settings.blockMalware = request.blockMalware;
                if (request.cookieConsent !== undefined) settings.cookieConsent = request.cookieConsent;
                if (request.antiFingerprint !== undefined) settings.antiFingerprint = request.antiFingerprint;
                browser.storage.local.set({ settings: settings });
                return Promise.resolve();
        }
    } catch (error) {
        console.error('Error in message handler:', error);
        return Promise.reject(error);
    }
});

// Log when the background script loads
console.log('Adios background script loaded');
