// Browser API polyfill for compatibility
if (typeof browser === 'undefined') {
    window.browser = typeof chrome !== 'undefined' ? chrome : {};
}

// Debug mode - set to true to enable detailed logging
let DEBUG_MODE = false;

// Enable debug mode from storage
browser.storage.local.get({ debugMode: false }).then(data => {
    DEBUG_MODE = data.debugMode || false;
});

// Debug logging function
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log('[Adios Debug]', ...args);
    }
}

// Common ad network domains and patterns
const adPatterns = [
    // Google Ads - DoubleClick
    "*://*.doubleclick.net/*",
    "*://*.doubleclick.com/*",
    "*://*.ad.doubleclick.net/*",
    "*://*.m.doubleclick.net/*",
    "*://*.static.doubleclick.net/*",
    "*://*.stats.g.doubleclick.net/*",
    "*://*.mediavisor.doubleclick.net/*",
    "*://*.googleads.g.doubleclick.net/*",
    
    // Google Ad Services
    "*://*.googleadservices.com/*",
    "*://partner.googleadservices.com/*",
    "*://pagead2.googleadservices.com/*",
    "*://*.pagead2.googleadservices.com/*",
    
    // Google Syndication
    "*://*.googlesyndication.com/*",
    "*://pagead2.googlesyndication.com/*",
    "*://*.pagead2.googlesyndication.com/*",
    "*://*.afs.googlesyndication.com/*",
    
    // Google Tag Services
    "*://*.googletagservices.com/*",
    
    // Google Ad Service
    "*://*.adservice.google.com/*",
    "*://*.adservice.google.*/*",
    
    // Google.com ad paths
    "*://*.google.com/pagead/*",
    "*://*.google.com/ads/*",
    "*://*.google.com/adsid/*",
    "*://*.google.com/adsense/*",
    "*://*.google.com/afd/*",
    "*://*.google.com/afs/*",
    
    // Major Ad Networks & Platforms
    "*://*.amazon-adsystem.com/*",
    "*://*.adnxs.com/*",  // AppNexus/Xandr
    "*://*.xandr.com/*",
    "*://*.outbrain.com/*",
    "*://*.taboola.com/*",
    "*://*.adroll.com/*",
    "*://*.mediamath.com/*",
    "*://*.rubiconproject.com/*",
    "*://*.openx.net/*",
    "*://*.openx.com/*",
    "*://*.pubmatic.com/*",
    "*://*.indexexchange.com/*",
    "*://*.indexww.com/*",
    "*://*.criteo.com/*",
    "*://*.criteo.net/*",
    "*://*.media.net/*",
    "*://*.adtechus.com/*",
    "*://*.adtech.de/*",
    "*://*.adtech.com/*",
    "*://*.adtech.fr/*",
    "*://*.adtech.jp/*",
    "*://*.casalemedia.com/*",
    "*://*.33across.com/*",
    "*://*.33across.net/*",
    "*://*.sovrn.com/*",
    "*://*.lijit.com/*",
    "*://*.conversantmedia.com/*",
    "*://*.adform.com/*",
    "*://*.adform.net/*",
    "*://*.adformdsp.net/*",
    "*://*.adcolony.com/*",
    "*://*.adsrvr.org/*",
    "*://*.adsystem.com/*",
    "*://*.brightcom.com/*",
    "*://*.brightcom.net/*",
    "*://*.brightroll.com/*",
    "*://*.adsafeprotected.com/*",
    
    // Video Ad Networks
    "*://*.spotxchange.com/*",
    "*://*.spotx.tv/*",
    "*://*.videologygroup.com/*",
    "*://*.tremorvideo.com/*",
    "*://*.brightcove.com/*",
    "*://*.jwplayer.com/*",
    
    // Native Ad Networks
    "*://*.revcontent.com/*",
    "*://*.content.ad/*",
    "*://*.mgid.com/*",
    "*://*.zemanta.com/*",
    
    // Additional Ad Platforms
    "*://*.adserver.yahoo.com/*",
    "*://*.yieldmanager.com/*",
    "*://*.yieldmo.com/*",
    "*://*.advertising.com/*",
    "*://*.advertising.net/*",
];

// Tracker domains (deduplicated)
const trackerPatterns = [
    // Google Analytics & Tracking
    "*://*.google-analytics.com/*",
    "*://*.analytics.google.com/*",
    "*://*.googletagmanager.com/*",
    "*://*.googleadservices.com/*",
    
    // Facebook Tracking
    "*://*.facebook.com/tr*",
    "*://*.facebook.net/*",
    "*://*.fbcdn.net/*",
    "*://*.atdmt.com/*",
    
    // Other Major Trackers
    "*://*.scorecardresearch.com/*",
    "*://*.quantserve.com/*",
    "*://*.criteo.com/*",
    "*://*.hotjar.com/*",
    "*://*.mouseflow.com/*",
    "*://*.mixpanel.com/*",
    "*://*.segment.com/*",
    "*://*.amplitude.com/*",
    "*://*.fullstory.com/*",
    "*://*.heap.io/*",
    "*://*.newrelic.com/*",
    "*://*.optimizely.com/*",
    "*://*.adobe.com/*",
    "*://*.omniture.com/*",
    "*://*.2o7.net/*",
    "*://*.demdex.net/*",
    "*://*.everesttech.net/*",
    "*://*.krxd.net/*",
    "*://*.nexac.com/*",
    "*://*.bluekai.com/*",
    "*://*.rlcdn.com/*",
    "*://*.agkn.com/*",
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
    const urlString = url.href.toLowerCase();
    
    // Check for Google ad/tracking domains first (most common)
    if (domain.includes('doubleclick') || 
        domain.includes('googleadservices') || 
        domain.includes('googlesyndication') ||
        domain.includes('googletagservices') ||
        domain.includes('adservice.google') ||
        urlString.includes('/pagead/') ||
        urlString.includes('/ads/') ||
        urlString.includes('/adsense/') ||
        urlString.includes('/afd/') ||
        urlString.includes('/afs/')) {
        // Check if it's a tracker first
        if (domain.includes('analytics') || domain.includes('googletagmanager') || domain.includes('google-analytics')) {
            return 'tracker';
        }
        return 'ad';
    }
    
    // Check tracker patterns
    if (trackerPatterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
        return regex.test(url.href);
    })) {
        return 'tracker';
    }
    
    // Check ad patterns
    if (adPatterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
        return regex.test(url.href);
    })) {
        return 'ad';
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

// Helper function to trim large stats/history objects
function trimStatsIfNeeded() {
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
    
    // Trim page load times to last 100 measurements
    browser.storage.local.get({ pageLoadTimes: [] }).then(data => {
        const loadTimes = data.pageLoadTimes || [];
        if (loadTimes.length > 100) {
            browser.storage.local.set({ pageLoadTimes: loadTimes.slice(-100) });
        }
    });
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
    
    // Periodically trim stats to prevent unbounded growth
    if (stats.totalBlocked % 1000 === 0) {
        trimStatsIfNeeded();
    }
}

// Block requests - use a broader pattern to catch all requests, then filter in the handler
// This ensures we catch Google ads that might not match exact patterns
const allPatterns = ["<all_urls>"];

browser.webRequest.onBeforeRequest.addListener(
    async function(details) {
        if (!settings.enabled) {
            debugLog('Blocking disabled, allowing:', details.url);
            return { cancel: false };
        }
        
        try {
            const url = new URL(details.url);
            const domain = url.hostname.toLowerCase();
            const urlString = url.href.toLowerCase();
            
            debugLog('Checking URL:', details.url, 'Domain:', domain);
            
            // Don't block essential page resources - always allow main document, CSS, and fonts
            if (details.type === 'main_frame' || 
                details.type === 'stylesheet' ||
                details.type === 'font') {
                return { cancel: false };
            }
            
            // Get the origin domain to check if this is a first-party resource
            let originDomain = '';
            if (details.originUrl) {
                try {
                    originDomain = new URL(details.originUrl).hostname.toLowerCase();
                } catch (e) {
                    // Invalid origin URL
                }
            } else if (details.documentUrl) {
                try {
                    originDomain = new URL(details.documentUrl).hostname.toLowerCase();
                } catch (e) {
                    // Invalid document URL
                }
            }
            
            // NEVER block first-party resources (same domain as the page)
            // This ensures pages can load their own JavaScript, images, API calls, and other assets
            if (originDomain && domain === originDomain) {
                debugLog('First-party resource, allowing:', details.url);
                return { cancel: false };
            }
            
            // Also allow subdomains of the same site (e.g., api.example.com for example.com)
            if (originDomain && domain) {
                const baseDomain = originDomain.replace(/^www\./, '');
                const requestBaseDomain = domain.replace(/^www\./, '');
                if (domain.endsWith('.' + baseDomain) || baseDomain.endsWith('.' + requestBaseDomain) || 
                    domain === baseDomain || requestBaseDomain === baseDomain) {
                    debugLog('Same-site resource (subdomain), allowing:', details.url);
                    return { cancel: false };
                }
            }
            
            // Don't block JavaScript files unless they're clearly from ad/tracker domains
            // Many sites need third-party JS libraries (jQuery, React, etc.) that aren't ads
            if (details.type === 'script') {
                // Only block scripts if they're from known ad/tracker domains
                const isKnownAdDomain = domain.includes('doubleclick') || 
                                       domain.includes('googleadservices') ||
                                       domain.includes('googlesyndication') ||
                                       domain.includes('adservice') ||
                                       domain.includes('adserver') ||
                                       domain.includes('adsystem') ||
                                       domain.includes('advertising') ||
                                       urlString.includes('/ads/') ||
                                       urlString.includes('/ad/') ||
                                       urlString.includes('googlead') ||
                                       urlString.includes('adsbygoogle');
                
                if (!isKnownAdDomain) {
                    // Allow scripts from CDNs and common libraries (cloudflare, jsdelivr, unpkg, etc.)
                    const isCDN = domain.includes('cdn') || 
                                 domain.includes('cloudflare') ||
                                 domain.includes('jsdelivr') ||
                                 domain.includes('unpkg') ||
                                 domain.includes('cdnjs') ||
                                 domain.includes('ajax.googleapis.com') ||
                                 domain.includes('ajax.aspnetcdn.com');
                    
                    if (isCDN) {
                        debugLog('CDN script, allowing:', details.url);
                        return { cancel: false };
                    }
                }
            }
            
            // Don't block XMLHttpRequest/fetch requests unless they're clearly ads/trackers
            // These are often needed for dynamic content loading
            if (details.type === 'xmlhttprequest' || details.type === 'other') {
                // Only block if it's clearly an ad/tracker endpoint
                const isAdEndpoint = urlString.includes('/ads/') ||
                                   urlString.includes('/ad/') ||
                                   urlString.includes('/tracking/') ||
                                   urlString.includes('/track/') ||
                                   urlString.includes('/analytics') ||
                                   urlString.includes('/pixel') ||
                                   domain.includes('doubleclick') ||
                                   domain.includes('googleadservices') ||
                                   domain.includes('googlesyndication');
                
                if (!isAdEndpoint) {
                    // Allow API calls and other requests needed for content
                    debugLog('API/Content request, allowing:', details.url);
                    return { cancel: false };
                }
            }
            
            // Don't block if URL contains cookie-related paths (unless cookie consent is enabled)
            if (!settings.cookieConsent && (url.pathname.toLowerCase().includes('cookie') || 
                url.pathname.toLowerCase().includes('consent') ||
                url.pathname.toLowerCase().includes('gdpr'))) {
                return { cancel: false };
            }

            // Check exceptions
            // Don't block if site is in exceptions
            if (settings.exceptions && settings.exceptions.length > 0 &&
                (settings.exceptions.includes(domain) || 
                 settings.exceptions.includes(originDomain))) {
                debugLog('URL in exceptions, allowing:', details.url);
                return { cancel: false };
            }

            // Check if this is a Google ad/tracking domain first (most common case)
            // Expanded detection for Google ads - including direct google.com ad serving
            const isGoogleAd = domain.includes('doubleclick') || 
                              domain.includes('googleadservices') || 
                              domain.includes('googlesyndication') ||
                              domain.includes('googletagservices') ||
                              domain.includes('googletagmanager') ||
                              domain.includes('adservice.google') ||
                              domain.includes('google-analytics') ||
                              domain.includes('analytics.google') ||
                              domain.includes('googleads') ||
                              domain.includes('googlead') ||
                              // Check for Google.com ad paths (even on main domain)
                              (domain.includes('google.com') && (
                                  urlString.includes('/pagead/') ||
                                  urlString.includes('/ads/') ||
                                  urlString.includes('/adsense/') ||
                                  urlString.includes('/afd/') ||
                                  urlString.includes('/afs/') ||
                                  urlString.includes('/pagead2') ||
                                  urlString.includes('/adsid/') ||
                                  urlString.includes('/adx/') ||
                                  urlString.includes('/ad/') ||
                                  urlString.includes('googlead') ||
                                  urlString.includes('googlesyndication') ||
                                  urlString.includes('adsbygoogle') ||
                                  urlString.includes('adservice') ||
                                  urlString.includes('adsystem') ||
                                  urlString.includes('adserver') ||
                                  urlString.includes('advertising')
                              )) ||
                              // Check URL patterns regardless of domain
                              urlString.includes('googleads') ||
                              urlString.includes('googlesyndication') ||
                              urlString.includes('doubleclick') ||
                              urlString.includes('googleadservices') ||
                              urlString.includes('pagead2') ||
                              urlString.includes('adsbygoogle') ||
                              urlString.includes('google-analytics') ||
                              urlString.includes('googletagmanager') ||
                              urlString.includes('adservice.google') ||
                              urlString.includes('googlead') ||
                              // Check for Google ad query parameters
                              urlString.includes('google_ad') ||
                              urlString.includes('googlead=') ||
                              urlString.includes('adsbygoogle=');
            
            if (isGoogleAd) {
                debugLog('Google ad detected:', details.url);
            }
            
            // Determine category (needed for stats and rules)
            const category = getBlockCategory(url);
            
            // If it's a Google ad/tracker and blocking is enabled, block it immediately
            if (isGoogleAd) {
                // Determine category for Google ads
                let googleCategory = category;
                if (!googleCategory || googleCategory === 'ad') {
                    // Check if it's actually a tracker
                    if (domain.includes('analytics') || 
                        domain.includes('googletagmanager') || 
                        domain.includes('google-analytics') ||
                        urlString.includes('analytics') ||
                        urlString.includes('gtag') ||
                        urlString.includes('gtm')) {
                        googleCategory = 'tracker';
                    } else {
                        googleCategory = 'ad';
                    }
                }
                
                // Check if blocking is enabled for this category
                if (googleCategory === 'tracker' && !settings.blockTrackers) {
                    return { cancel: false };
                }
                if (googleCategory === 'ad' && !settings.blockAds) {
                    return { cancel: false };
                }
                
                // Update category for stats
                const finalCategory = googleCategory;
                
                // Update statistics immediately
                stats.totalBlocked++;
                const dataSize = estimateRequestSize(details);
                stats.dataSaved += dataSize;
                
                // Update category-specific stats
                switch(finalCategory) {
                    case 'ad':
                        stats.adsBlocked++;
                        break;
                    case 'tracker':
                        stats.trackersBlocked++;
                        break;
                }
                
                // Update domain stats
                stats.domainStats[domain] = (stats.domainStats[domain] || 0) + 1;
                
                // Update site-specific stats
                let tabDomain = '';
                if (details.originUrl) {
                    try {
                        tabDomain = new URL(details.originUrl).hostname;
                    } catch (e) {
                        tabDomain = domain;
                    }
                } else if (details.documentUrl) {
                    try {
                        tabDomain = new URL(details.documentUrl).hostname;
                    } catch (e) {
                        tabDomain = domain;
                    }
                } else {
                    tabDomain = domain;
                }
                
                stats.siteStats[tabDomain] = (stats.siteStats[tabDomain] || 0) + 1;
                
                // Update time-based stats
                updateTimeStats(finalCategory, dataSize);
                
                // Save stats asynchronously (don't await to avoid blocking)
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
                }).catch(err => console.error('Error saving stats:', err));
                
                // Block immediately for Google ads
                debugLog('BLOCKING Google ad:', details.url, 'Category:', googleCategory);
                
                // Log to popup for troubleshooting
                browser.runtime.sendMessage({
                    type: 'requestLog',
                    url: details.url,
                    domain: domain,
                    blocked: true
                }).catch(() => {}); // Ignore errors if popup not open
                
                return { cancel: true };
            } else {
                // For non-Google domains, check if they match our patterns
                const matchesPattern = adPatterns.some(pattern => {
                    try {
                        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
                        return regex.test(details.url);
                    } catch (e) {
                        return false;
                    }
                }) || trackerPatterns.some(pattern => {
                    try {
                        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
                        return regex.test(details.url);
                    } catch (e) {
                        return false;
                    }
                }) || socialPatterns.some(pattern => {
                    try {
                        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
                        return regex.test(details.url);
                    } catch (e) {
                        return false;
                    }
                }) || malwarePatterns.some(pattern => {
                    try {
                        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
                        return regex.test(details.url);
                    } catch (e) {
                        return false;
                    }
                });
                
                if (!matchesPattern) {
                    debugLog('No pattern match, allowing:', details.url);
                    return { cancel: false };
                }
            }
            
            // Check custom rules first (highest priority)
            const customRulesData = await browser.storage.local.get({ customRules: [] });
            const customRules = customRulesData.customRules || [];
            const matchesCustomRule = customRules.some(rule => {
                try {
                    const regex = new RegExp('^' + rule.pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$');
                    return regex.test(details.url);
                } catch (e) {
                    return false;
                }
            });
            
            if (matchesCustomRule) {
                // Custom rule matches, proceed with blocking
            } else {
                // Check site-specific rules (they override global settings)
                const siteRulesData = await browser.storage.local.get({ siteSpecificRules: [] });
                const siteRules = siteRulesData.siteSpecificRules || [];
                const matchingSiteRule = siteRules.find(rule => 
                    domain.includes(rule.domain) || originDomain.includes(rule.domain)
                );
                
                if (matchingSiteRule) {
                    // Apply site-specific rule
                    let shouldBlock = false;
                    switch(category) {
                        case 'ad': shouldBlock = matchingSiteRule.blockAds; break;
                        case 'tracker': shouldBlock = matchingSiteRule.blockTrackers; break;
                        case 'social': shouldBlock = matchingSiteRule.blockSocial; break;
                        case 'malware': shouldBlock = matchingSiteRule.blockMalware; break;
                    }
                    if (!shouldBlock) {
                        return { cancel: false };
                    }
                } else {
                    // Use global settings
                    if (!shouldBlockCategory(category)) {
                        return { cancel: false };
                    }
                }
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
            
            // Update blocking history
            const historyData = await browser.storage.local.get({ blockingHistory: [] });
            let blockingHistory = historyData.blockingHistory || [];
            
            // Add or update history entry for this domain
            const existingEntry = blockingHistory.find(entry => entry.domain === tabDomain);
            if (existingEntry) {
                existingEntry.count++;
                existingEntry.lastBlocked = Date.now();
            } else {
                blockingHistory.push({
                    domain: tabDomain,
                    count: 1,
                    timestamp: Date.now(),
                    lastBlocked: Date.now()
                });
            }
            
            // Keep only last 100 entries (trimming already handled in trimStatsIfNeeded)
            if (blockingHistory.length > 100) {
                blockingHistory = blockingHistory.slice(-100);
            }
            
            // Trim stats periodically
            trimStatsIfNeeded();
            
            // Save stats and history
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
                blockingHistory: blockingHistory,
                [`site:${tabDomain}`]: stats.siteStats[tabDomain]
            });

            // Log to popup for troubleshooting (even if not blocked)
            if (DEBUG_MODE) {
                browser.runtime.sendMessage({
                    type: 'requestLog',
                    url: details.url,
                    domain: domain,
                    blocked: true,
                    category: category
                }).catch(() => {}); // Ignore errors if popup not open
            }
            
            return { cancel: true };
        } catch (error) {
            console.error('Error in onBeforeRequest:', error);
            debugLog('Error processing request:', details.url, error);
            // Log error but don't block - fail open to avoid breaking user experience
            return { cancel: false };
        }
    },
    { urls: allPatterns },
    ["blocking"]
);

// Handle messages from popup and options
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle async responses properly
    (async () => {
        try {
            let response;
            
            switch (request.type) {
                case "getAdSelectors":
                    response = { 
                        selectors: settings.enabled ? adSelectors : [],
                        settings: {
                            enabled: settings.enabled,
                            cookieConsent: settings.cookieConsent,
                            antiFingerprint: settings.antiFingerprint
                        }
                    };
                    break;
                
                case "toggleBlocking":
                    settings.enabled = request.enabled;
                    await browser.storage.local.set({ enabled: settings.enabled });
                    response = { success: true };
                    break;
                
                case "settingsUpdated":
                    settings = { ...settings, ...request.settings };
                    await browser.storage.local.set({ settings: settings });
                    response = { success: true };
                    break;
                
                case "exceptionsUpdated":
                    settings.exceptions = request.exceptions || [];
                    await browser.storage.local.set({ exceptions: settings.exceptions });
                    response = { success: true };
                    break;
                    
                case "getStats":
                    // Trim stats before returning to prevent unbounded growth
                    trimStatsIfNeeded();
                    response = {
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
                    };
                    break;
                
                case "getTopDomain":
                    const topDomain = Object.entries(stats.domainStats || {})
                        .sort((a, b) => b[1] - a[1])[0];
                    response = topDomain ? { domain: topDomain[0], count: topDomain[1] } : null;
                    break;
                
                case "updateCategorySettings":
                    if (request.blockAds !== undefined) settings.blockAds = request.blockAds;
                    if (request.blockTrackers !== undefined) settings.blockTrackers = request.blockTrackers;
                    if (request.blockSocial !== undefined) settings.blockSocial = request.blockSocial;
                    if (request.blockMalware !== undefined) settings.blockMalware = request.blockMalware;
                    if (request.cookieConsent !== undefined) settings.cookieConsent = request.cookieConsent;
                    if (request.antiFingerprint !== undefined) settings.antiFingerprint = request.antiFingerprint;
                    await browser.storage.local.set({ settings: settings });
                    response = { success: true };
                    break;
            
                case "customRulesUpdated":
                    // Custom rules are stored and can be used for additional blocking
                    await browser.storage.local.set({ customRules: request.rules || [] });
                    response = { success: true };
                    break;
                
                case "startMonitor":
                    // Start monitoring network activity
                    response = { success: true };
                    break;
                
                case "stopMonitor":
                    // Stop monitoring network activity
                    response = { success: true };
                    break;
                
                case "filterListsUpdated":
                    settings.filterLists = request.filterLists || settings.filterLists;
                    await browser.storage.local.set({ filterLists: settings.filterLists });
                    response = { success: true };
                    break;
                
                case "pageLoadTime":
                    // Track page load times for performance metrics
                    const loadTimeData = await browser.storage.local.get({ pageLoadTimes: [] });
                    let loadTimes = loadTimeData.pageLoadTimes || [];
                    loadTimes.push({
                        time: request.loadTime,
                        url: request.url,
                        timestamp: Date.now()
                    });
                    // Keep only last 100 measurements (trimming)
                    if (loadTimes.length > 100) {
                        loadTimes = loadTimes.slice(-100);
                    }
                    await browser.storage.local.set({ pageLoadTimes: loadTimes });
                    response = { success: true };
                    break;
                
                case "siteRulesUpdated":
                    // Update site-specific rules
                    await browser.storage.local.set({ siteSpecificRules: request.rules || [] });
                    response = { success: true };
                    break;
                
                case "scheduleUpdated":
                    // Update scheduled blocking configuration
                    await browser.storage.local.set({ scheduleConfig: request.schedule });
                    response = { success: true };
                    break;
                
                case "setDebugMode":
                    DEBUG_MODE = request.enabled || false;
                    await browser.storage.local.set({ debugMode: DEBUG_MODE });
                    console.log('[Adios] Debug mode', DEBUG_MODE ? 'enabled' : 'disabled');
                    response = { success: true };
                    break;
                
                case "resetStats":
                    // Reset all statistics
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
                    stats.blockingHistory = [];
                    await browser.storage.local.set({
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
                    });
                    response = { success: true };
                    break;
                
                default:
                    console.warn('Unknown message type:', request.type);
                    response = { error: 'Unknown message type' };
                    break;
            }
            
            sendResponse(response);
        } catch (error) {
            console.error('Error in message handler:', error);
            sendResponse({ error: error.message });
        }
    })();
    
    // Return true to indicate we will send a response asynchronously
    return true;
});

// Log when the background script loads
console.log('Adios background script loaded');
