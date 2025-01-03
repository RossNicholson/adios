// Common ad network domains and patterns
const adPatterns = [
    "*://*.doubleclick.net/*",
    "*://*.google-analytics.com/*",
    "*://*.facebook.com/*",
    "*://partner.googleadservices.com/*",
    "*://*.googlesyndication.com/*",
    "*://*.google-analytics.com/*",
    "*://*.googletagservices.com/*",
    "*://*.amazon-adsystem.com/*",
    "*://*.adnxs.com/*",
    "*://*.advertising.com/*",
    "*://*.outbrain.com/*",
    "*://*.taboola.com/*",
    "*://pagead2.googlesyndication.com/*",
    "*://*.scorecardresearch.com/*",
    "*://*.quantserve.com/*",
    "*://*.criteo.com/*",
    "*://*.adroll.com/*",
    "*://*.mediamath.com/*",
    "*://*.rubiconproject.com/*",
    "*://*.openx.net/*",
    "*://*.pubmatic.com/*",
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
    dataSaved: 0,
    siteStats: {}
};

// Load settings
let settings = {
    enabled: true,
    blockTracking: false,
    whitelist: [],
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
    // Basic size estimation based on URL length and headers
    let size = details.url.length;
    if (details.requestHeaders) {
        size += JSON.stringify(details.requestHeaders).length;
    }
    return size;
}

// Block ad network requests
browser.webRequest.onBeforeRequest.addListener(
    function(details) {
        if (!settings.enabled) return { cancel: false };
        
        try {
            const url = new URL(details.url);
            const domain = url.hostname;
            
            // Don't block if URL contains cookie-related paths
            if (url.pathname.toLowerCase().includes('cookie') || 
                url.pathname.toLowerCase().includes('consent') ||
                url.pathname.toLowerCase().includes('gdpr')) {
                return { cancel: false };
            }

            // Check exceptions
            const originDomain = details.originUrl ? new URL(details.originUrl).hostname : '';
            
            // Don't block if site is in exceptions
            if (settings.exceptions && 
                (settings.exceptions.includes(domain) || 
                 settings.exceptions.includes(originDomain))) {
                return { cancel: false };
            }

            // Check whitelist
            const whitelistDomain = new URL(details.url).hostname;
            if (settings.whitelist.includes(whitelistDomain)) {
                return { cancel: false };
            }

            // Update statistics
            stats.totalBlocked++;
            stats.dataSaved += estimateRequestSize(details);
            
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
            
            // Save stats
            browser.storage.local.set({
                totalBlocked: stats.totalBlocked,
                dataSaved: stats.dataSaved,
                [`site:${tabDomain}`]: stats.siteStats[tabDomain]
            });

            console.log(`Blocked ad: ${details.url} on ${tabDomain}`);
            return { cancel: true };
        } catch (error) {
            console.error('Error in onBeforeRequest:', error);
            return { cancel: false };
        }
    },
    { urls: adPatterns },
    ["blocking"]
);

// Handle messages from popup and options
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        switch (request.type) {
            case "getAdSelectors":
                return Promise.resolve({ 
                    selectors: settings.enabled ? adSelectors : [] 
                });
            
            case "toggleBlocking":
                settings.enabled = request.enabled;
                browser.storage.local.set({ enabled: settings.enabled });
                return Promise.resolve();
            
            case "settingsUpdated":
                settings = { ...settings, ...request.settings };
                return Promise.resolve();
                
            case "getStats":
                return Promise.resolve({
                    totalBlocked: stats.totalBlocked,
                    dataSaved: stats.dataSaved,
                    siteStats: stats.siteStats
                });
        }
    } catch (error) {
        console.error('Error in message handler:', error);
        return Promise.reject(error);
    }
});

// Log when the background script loads
console.log('Adios background script loaded');
