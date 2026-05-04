// Browser API polyfill for compatibility
if (typeof browser === 'undefined') {
    window.browser = typeof chrome !== 'undefined' ? chrome : {};
}

// Mail Online / GAM: native + injected DOM work caused white screens; rely on webRequest only here.
const ADIOS_LIGHT_DOM = (() => {
    try {
        const h = (typeof location !== 'undefined' ? location.hostname : '').toLowerCase();
        return h.includes('dailymail.');
    } catch (_) {
        return false;
    }
})();

// ── Anti-adblock wall circumvention ───────────────────────────────────────
// Runs before anything else so overlays are gone before the user sees them.
if (!ADIOS_LIGHT_DOM) (function circumventAntiAdblock() {
    // 1. Inject a "bait" element with class/ID names that detection scripts probe.
    //    We make it non-zero in size so getComputedStyle checks pass.
    //    Must work at document_start (before body exists) — appends to <html> if needed.
    function injectBait() {
        if (document.getElementById('__adios_bait__')) return;
        const bait = document.createElement('div');
        bait.id = '__adios_bait__';
        // Class names probed by common detection libraries (Admiral, FuckAdBlock, BlockAdBlock, Oriel, etc.)
        bait.className = 'pub_300x250 pub_300x250m pub_728x90 text-ad textAd text_ad ads adsbox ad-placement ad-banner ad-unit advertisement';
        bait.style.cssText = 'width:1px!important;height:1px!important;position:absolute!important;left:-10000px!important;top:-10000px!important;display:block!important;visibility:visible!important;opacity:1!important';
        const parent = document.body || document.documentElement;
        if (parent) parent.appendChild(bait);
    }

    // Inject bait immediately (document_start — body may not exist yet, retry shortly)
    injectBait();
    if (!document.body) {
        const earlyObserver = new MutationObserver(() => { injectBait(); earlyObserver.disconnect(); });
        earlyObserver.observe(document.documentElement, { childList: true });
    }

    // 2. Remove known anti-adblock overlay elements (always remove — no size/position heuristic).
    const WALL_SELECTORS_FORCE = [
        '#mol-ads-lockdown',        '.mol-ads-lockdown',
        '#mol-ads-modal',           '.mol-ads-modal',
        '#admiral-outer-container', '.admiral-widget',
        '.fc-ab-root',              '#fc-ab-root',
        'iframe[src*="fundingchoicesmessages.google.com"]',
        'iframe[src*="webcontentassessor.com"]',
    ];

    // 2b. Broader patterns — only remove when clearly an overlay (avoid nuking in-page copy).
    const WALL_SELECTORS = [
        // Generic patterns
        '[id*="adblock-wall"]',     '[class*="adblock-wall"]',
        '[id*="adblock-notice"]',   '[class*="adblock-notice"]',
        '[id*="adblocker"]',        '[class*="adblocker"]',
        '[id*="anti-adblock"]',     '[class*="anti-adblock"]',
        '[id*="ad-block-message"]', '[class*="ad-block-message"]',
        '[id*="adblock-modal"]',    '[class*="adblock-modal"]',
        '#disable-adblock',         '.disable-adblock',
        '#adblock-overlay',         '.adblock-overlay',
        // Admiral (outer container also in FORCE list)
        '[id*="admiral"]',          '[class*="admiral"]',
        // Daily Mail (also in FORCE list)
        // Other common platforms
        '.freestar-ad-blocker',     '#freestar-ad-blocker',
        '.crx-overlay',             '#crx-overlay',
        '[id*="adrecovery"]',       '[class*="adrecovery"]',
        '[id*="fc-ab"]',            '[class*="fc-ab"]',
        '.sp_message_container',    // SourcePoint consent/adblock walls
        '[class*="adblock-banner"]',
        // Google Funding Choices (also in FORCE list)
        // Oriel / webcontentassessor (Daily Mail)
        '[class*="oriel"]',         '[id*="oriel"]',
        '.wca-overlay',             '#wca-overlay',
        '[class*="mol-pro"]',       // Daily Mail M+ subscription wall
    ];

    function cLog(level, msg) {
        browser.runtime.sendMessage({ type: 'contentLog', level, msg }).catch(() => {});
    }

    function removeWalls() {
        for (const sel of WALL_SELECTORS_FORCE) {
            try {
                document.querySelectorAll(sel).forEach(el => {
                    cLog('ANTI', `Removed wall (force): ${sel} | tag=${el.tagName} id="${el.id}"`);
                    el.remove();
                });
            } catch (_) {}
        }
        for (const sel of WALL_SELECTORS) {
            try {
                document.querySelectorAll(sel).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    const isOverlay = style.position === 'fixed' || style.position === 'absolute';
                    const hasSize   = rect.width > 50 || rect.height > 50;
                    if (isOverlay || hasSize) {
                        cLog('ANTI', `Removed wall: ${sel} | tag=${el.tagName} id="${el.id}" class="${el.className.toString().slice(0, 60)}"`);
                        el.remove();
                    }
                });
            } catch (_) {}
        }

        // Restore body/html scroll that walls lock
        try {
            const html = document.documentElement;
            const body = document.body;
            if (body && body.style.overflow === 'hidden')       { body.style.overflow = '';        cLog('ANTI', 'Restored body overflow'); }
            if (html && html.style.overflow === 'hidden')       { html.style.overflow = '';        cLog('ANTI', 'Restored html overflow'); }
            if (body && body.style.pointerEvents === 'none')    { body.style.pointerEvents = '';   cLog('ANTI', 'Restored body pointerEvents'); }
        } catch (_) {}
    }

    queueMicrotask(() => { injectBait(); removeWalls(); });

    // Run as early as possible, then repeatedly for dynamic walls
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { injectBait(); removeWalls(); });
    } else {
        injectBait(); removeWalls();
    }
    window.addEventListener('load', () => { injectBait(); removeWalls(); });

    // Watch for walls injected dynamically
    const wallObserver = new MutationObserver(() => removeWalls());
    const startWallObserver = () => {
        if (document.body) {
            wallObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
        }
    };
    if (document.body) startWallObserver();
    else document.addEventListener('DOMContentLoaded', startWallObserver);
})();

// Store observers and timers for cleanup
let mutationObserver = null;
let bodyObserver = null;
let urlCheckInterval = null;
let debounceTimer = null;

// Function to remove ad elements - more conservative to avoid removing legitimate content
function removeAds(selectors) {
    if (!selectors || selectors.length === 0) return;
    
    let removedCount = 0;
    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                try {
                    // NEVER remove main content elements
                    const tagName = element.tagName;
                    const elementClass = (element.className || '').toLowerCase();
                    const elementId = (element.id || '').toLowerCase();
                    
                    // Skip if it's a main content element
                    if (tagName === 'MAIN' || 
                        tagName === 'ARTICLE' || 
                        tagName === 'BODY' ||
                        elementClass.includes('main-content') ||
                        elementClass.includes('page-content') ||
                        elementClass.includes('article-content') ||
                        elementId === 'content' ||
                        elementId === 'main' ||
                        elementId === 'articles') {
                        return; // Skip - this is legitimate content
                    }
                    
                    // Check size - don't remove large content areas
                    const rect = element.getBoundingClientRect();
                    const isLargeContent = rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.3;
                    if (isLargeContent && !elementClass.includes('ad') && !elementId.includes('ad')) {
                        return; // Skip large content that's not clearly an ad
                    }
                    
                    // Check if element contains Google Chrome ad text
                    const text = element.textContent || '';
                    if (text.includes('Switch to Google Chrome') || 
                        text.includes('Browse securely with Chrome') ||
                        (text.includes('Google Chrome') && (text.includes('Switch') || text.includes('Browse securely')))) {
                        // Only remove if it's small (likely a banner) or has ad indicators
                        if (!isLargeContent || elementClass.includes('ad') || elementId.includes('ad')) {
                            element.remove();
                            removedCount++;
                        }
                        return;
                    }
                    
                    // Only remove if element has clear ad indicators
                    const hasAdIndicator = elementClass.includes('ad') || 
                                          elementId.includes('ad') ||
                                          elementClass.includes('advertisement') ||
                                          elementId.includes('advertisement') ||
                                          element.querySelector('iframe[src*="doubleclick"]') ||
                                          element.querySelector('iframe[src*="googlesyndication"]') ||
                                          element.querySelector('ins.adsbygoogle');
                    
                    if (!hasAdIndicator) {
                        return; // Skip - no clear ad indicators
                    }
                    
                    // Check parent elements for ad indicators (but be more careful)
                    let parent = element.parentElement;
                    let depth = 0;
                    while (parent && depth < 2) { // Reduced depth check
                        const parentTag = parent.tagName;
                        const parentText = (parent.textContent || '').toLowerCase();
                        const parentClass = (parent.className || '').toLowerCase();
                        const parentId = (parent.id || '').toLowerCase();
                        
                        // Don't remove if parent is main content
                        if (parentTag === 'MAIN' || parentTag === 'ARTICLE' || parentTag === 'BODY') {
                            return; // Stop - don't remove main content
                        }
                        
                        if (parentText.includes('switch to google chrome') ||
                            parentText.includes('browse securely with chrome') ||
                            (parentClass.includes('ad') && !parentClass.includes('content')) ||
                            (parentId.includes('ad') && !parentId.includes('content'))) {
                            // Only remove parent if it's clearly an ad container
                            if (!parentClass.includes('content') && !parentId.includes('content')) {
                                parent.remove();
                                removedCount++;
                            }
                            return;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                    
                    // Only remove if we have clear ad indicators
                    if (hasAdIndicator) {
                        element.remove();
                        removedCount++;
                    }
                } catch (e) {
                    // Element may have already been removed
                }
            });
        } catch (e) {
            // Invalid selector, skip
        }
    });
    
    // Also look for Google Chrome ads by text content (more conservative)
    if (removedCount === 0) {
        try {
            const allDivs = document.querySelectorAll('div, a, section');
            allDivs.forEach(el => {
                // Skip main content elements
                if (el.tagName === 'ARTICLE' || 
                    el.tagName === 'MAIN' ||
                    (el.className || '').toLowerCase().includes('content') ||
                    (el.id || '').toLowerCase().includes('content')) {
                    return;
                }
                
                const text = el.textContent || '';
                const rect = el.getBoundingClientRect();
                const isLarge = rect.width > window.innerWidth * 0.4 || rect.height > window.innerHeight * 0.3;
                
                if (isLarge) {
                    return; // Skip large elements
                }
                
                if ((text.includes('Switch to Google Chrome') || 
                     text.includes('Browse securely with Chrome')) &&
                    (el.querySelector('a[href*="chrome"]') || 
                     el.querySelector('a[href*="google.com/chrome"]') ||
                     (el.className || '').includes('ad') ||
                     (el.id || '').includes('ad'))) {
                    try {
                        el.remove();
                        removedCount++;
                    } catch (e) {
                        // Element may have already been removed
                    }
                }
            });
        } catch (e) {
            // Ignore errors
        }
    }
    
    return removedCount;
}

// Cookie consent blocker - with safeguards to prevent refresh loops
let cookieConsentHandled = false;
let cookieConsentAttempts = 0;
const MAX_COOKIE_CONSENT_ATTEMPTS = 2; // Limit attempts per page

function blockCookieConsent() {
    // Prevent infinite loops - only try a few times per page
    if (cookieConsentHandled || cookieConsentAttempts >= MAX_COOKIE_CONSENT_ATTEMPTS) {
        return;
    }
    
    cookieConsentAttempts++;
    
    // More specific cookie consent selectors - avoid matching page content
    const cookieSelectors = [
        '#cookie-banner',
        '#cookie-consent',
        '#cookie-notice',
        '.cookie-consent',
        '.cookie-banner',
        '.cookie-notice',
        '[id="cookie-banner"]',
        '[id="cookie-consent"]',
        '[id="cookie-notice"]',
        '[class*="cookie-consent"]',
        '[class*="cookie-banner"]',
        '[class*="cookie-notice"]',
        '[data-testid*="cookie-banner"]',
        '[data-testid*="cookie-consent"]',
        '[aria-label*="cookie" i][role="dialog"]',
        '[aria-label*="cookie" i][role="banner"]'
    ];
    
    let foundBanner = false;
    
    cookieSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // More strict checks to ensure it's actually a cookie banner, not page content
                const text = element.textContent.toLowerCase();
                const elementId = (element.id || '').toLowerCase();
                const elementClass = (element.className || '').toLowerCase();
                
                // Skip if this looks like main page content (too large, contains navigation, etc.)
                const rect = element.getBoundingClientRect();
                const isLargeContent = rect.width > window.innerWidth * 0.6 && rect.height > window.innerHeight * 0.3;
                const hasNavigation = (text.includes('home') || text.includes('about') || text.includes('contact')) && 
                                    (text.includes('news') || text.includes('article') || text.includes('guide')) && 
                                    text.length > 300;
                const isMainContent = element.tagName === 'MAIN' || 
                                     element.tagName === 'ARTICLE' ||
                                     element.tagName === 'BODY' ||
                                     (element.tagName === 'DIV' && elementClass.includes('content') && !elementClass.includes('banner') && !elementClass.includes('overlay')) ||
                                     (element.tagName === 'DIV' && elementId.includes('content') && !elementId.includes('banner') && !elementId.includes('overlay')) ||
                                     elementClass.includes('main-content') ||
                                     elementClass.includes('page-content') ||
                                     elementId === 'content' ||
                                     elementId === 'main';
                
                // Also skip if it's a section with lots of links (likely navigation or footer)
                const linkCount = element.querySelectorAll('a').length;
                if (linkCount > 10 && text.length > 500) {
                    return; // Skip - likely navigation or footer
                }
                
                if (isLargeContent || hasNavigation || isMainContent) {
                    return; // Skip - this is likely page content, not a banner
                }
                
                // Must contain cookie/consent keywords AND be a banner/overlay/dialog
                const hasCookieText = (text.includes('cookie') || text.includes('consent') || text.includes('gdpr')) && 
                                     (text.includes('accept') || text.includes('agree') || text.includes('preference') || text.includes('manage'));
                const isBannerLike = elementClass.includes('banner') || 
                                     elementClass.includes('overlay') || 
                                     elementClass.includes('modal') ||
                                     elementClass.includes('dialog') ||
                                     elementClass.includes('popup') ||
                                     elementClass.includes('notice') ||
                                     elementId.includes('banner') ||
                                     elementId.includes('overlay') ||
                                     elementId.includes('modal') ||
                                     elementId.includes('dialog') ||
                                     elementId.includes('popup') ||
                                     element.getAttribute('role') === 'dialog' ||
                                     element.getAttribute('role') === 'banner' ||
                                     // Check if it's positioned as an overlay (fixed or absolute at top/bottom)
                                     (window.getComputedStyle(element).position === 'fixed' || 
                                      (window.getComputedStyle(element).position === 'absolute' && 
                                       (rect.top < 100 || rect.bottom > window.innerHeight - 100)));
                
                // Only hide if it's clearly a cookie banner (small overlay, not main content)
                if (hasCookieText && isBannerLike && text.length < 1500 && !isLargeContent) {
                    // Only hide, don't remove immediately to avoid triggering reloads
                    element.style.display = 'none';
                    element.style.visibility = 'hidden';
                    element.style.opacity = '0';
                    element.style.height = '0';
                    element.style.overflow = 'hidden';
                    foundBanner = true;
                    
                    // Remove after a delay to prevent immediate reload
                    setTimeout(() => {
                        try {
                            element.remove();
                        } catch (e) {
                            // Element may have been removed already
                        }
                    }, 1000);
                }
            });
        } catch (e) {
            // Invalid selector
        }
    });
    
    // Only try clicking buttons if we found a banner and haven't clicked yet
    if (foundBanner && cookieConsentAttempts === 1) {
        // Be very selective about which buttons to click
        const acceptButtons = document.querySelectorAll(
            'button:not([disabled]):not([type="submit"]), [role="button"]:not([type="submit"])'
        );
        
        acceptButtons.forEach(button => {
            // Skip buttons that might cause navigation
            const form = button.closest('form');
            const href = button.getAttribute('href') || button.closest('a')?.getAttribute('href');
            if (form || href) {
                return; // Skip buttons in forms or links
            }
            
            const text = button.textContent.toLowerCase();
            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
            const combinedText = text + ' ' + ariaLabel;
            
            // Only click very specific accept buttons
            if ((combinedText.includes('accept') || combinedText.includes('agree') || combinedText.includes('ok')) && 
                (combinedText.includes('cookie') || combinedText.includes('all')) &&
                !combinedText.includes('reject') && !combinedText.includes('decline')) {
                try {
                    // Use a small delay and mark as handled immediately
                    cookieConsentHandled = true;
                    setTimeout(() => {
                        try {
                            button.click();
                        } catch (e) {
                            // Button may not be clickable
                        }
                    }, 500);
                } catch (e) {
                    // Button may not be clickable
                }
            }
        });
    }
    
    // Mark as handled if we found and processed a banner
    if (foundBanner) {
        cookieConsentHandled = true;
    }
}

// Anti-fingerprinting protection
// Guard to prevent wrapping native methods more than once
let _antiFingerprintingApplied = false;
function applyAntiFingerprinting() {
    if (_antiFingerprintingApplied) return;
    _antiFingerprintingApplied = true;
    // Override common fingerprinting methods
    if (typeof navigator !== 'undefined') {
        // Spoof canvas fingerprinting
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
            const context = this.getContext('2d');
            if (context) {
                const imageData = context.getImageData(0, 0, this.width, this.height);
                // Add slight noise to prevent fingerprinting
                for (let i = 0; i < imageData.data.length; i += 4) {
                    if (Math.random() < 0.01) {
                        imageData.data[i] = Math.min(255, imageData.data[i] + Math.random() * 2 - 1);
                    }
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
        };
        
        // Spoof WebGL fingerprinting
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
                return 'Intel Inc.';
            }
            if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
                return 'Intel Iris OpenGL Engine';
            }
            return getParameter.apply(this, arguments);
        };
        
        // Reduce precision of time-based fingerprinting
        const originalPerformanceNow = performance.now;
        performance.now = function() {
            return Math.round(originalPerformanceNow() / 10) * 10;
        };
    }
}

// Debounce function to limit how often we process mutations
// debounceTimer is already declared at the top of the file
const DEBOUNCE_DELAY = 250; // 250ms debounce

let settings = {
    enabled: true,
    cookieConsent: true,
    antiFingerprint: true
};

// Load settings and remove ads immediately
browser.runtime.sendMessage({ type: 'getAdSelectors', domain: window.location.hostname })
    .then(response => {
        if (response && response.settings) {
            settings = { ...settings, ...response.settings };
        }
        // If this page is explicitly excepted, do nothing at all
        if (response && response.isExcepted) return;
        if (ADIOS_LIGHT_DOM) {
            if (settings.antiFingerprint) applyAntiFingerprinting();
            return;
        }
        if (settings.enabled) {
            // Remove ads immediately
            removeAds(response?.selectors || []);
            
            // Also remove Google ads specifically (including Chrome promotional ads)
            const googleAdSelectors = [
                'ins.adsbygoogle',
                'div[id*="google-ad"]',
                'div[class*="adsbygoogle"]',
                'div[id^="google_ads_iframe"]',
                'iframe[src*="googlesyndication"]',
                'iframe[src*="doubleclick"]',
                'iframe[src*="googleadservices"]',
                'iframe[src*="pagead2"]',
                'iframe[src*="google.com/pagead"]',
                'iframe[src*="google.com/ads"]',
                'div[data-google-query-id]',
                'div[data-google-ad]',
                'div[class*="google-auto-placed"]',
                'div[id*="google_ads_frame"]',
                'div[class*="google-ads"]',
                'div[id*="googleads"]',
                // Chrome promotional ad selectors
                'a[href*="chrome.google.com"]',
                'a[href*="google.com/chrome"]',
                '[class*="chrome"][class*="ad"]',
                '[id*="chrome"][id*="ad"]',
                // Additional Google ad containers
                'div[class*="ad-container"][id*="google"]',
                'div[class*="ad-wrapper"][id*="google"]',
                'section[id*="google"][class*="ad"]',
                'article[id*="google"][class*="ad"]'
            ];
            removeAds(googleAdSelectors);
            // Intentionally no "remove by innerHTML contains doubleclick + class has ad" pass:
            // on GAM publishers (e.g. Daily Mail) many layout wrappers match *ad* and embed ad iframes,
            // so removing those ancestors deletes most of the page (white screen). Network blocking +
            // explicit selectors above are the safe approach (same class of issue as over-broad cosmetic filters).
        }
        if (settings.cookieConsent) {
            blockCookieConsent();
        }
        if (settings.antiFingerprint) {
            applyAntiFingerprinting();
        }
    })
    .catch(error => {
        // Background script may not be available yet
        console.error('Error loading settings:', error);
    });

function debouncedAdRemoval() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    
    debounceTimer = setTimeout(() => {
        browser.runtime.sendMessage({ type: "getAdSelectors", domain: window.location.hostname })
            .then(response => {
                if (response && response.settings) {
                    settings = { ...settings, ...response.settings };
                }
                if (response && response.isExcepted) return;
                if (ADIOS_LIGHT_DOM) return;
                if (settings.enabled) {
                    removeAds(response?.selectors || []);
                    
                    // Also aggressively remove Google ads
                    const googleAdSelectors = [
                        'ins.adsbygoogle',
                        'div[id*="google-ad"]',
                        'div[class*="adsbygoogle"]',
                        'div[id^="google_ads_iframe"]',
                        'iframe[src*="googlesyndication"]',
                        'iframe[src*="doubleclick"]',
                        'iframe[src*="googleadservices"]',
                        'iframe[src*="pagead2"]',
                        'iframe[src*="google.com/pagead"]',
                        'iframe[src*="google.com/ads"]',
                        'div[data-google-query-id]',
                        'div[data-google-ad]',
                        'div[class*="google-auto-placed"]',
                        'div[id*="google_ads_frame"]',
                        'div[class*="google-ads"]',
                        'div[id*="googleads"]',
                        'div[class*="ad-container"][id*="google"]',
                        'div[class*="ad-wrapper"][id*="google"]',
                        'section[id*="google"][class*="ad"]',
                        'article[id*="google"][class*="ad"]',
                        // Chrome promotional ads
                        'a[href*="chrome.google.com"]',
                        'a[href*="google.com/chrome"]',
                        '[class*="chrome"][class*="ad"]',
                        '[id*="chrome"][id*="ad"]'
                    ];
                    removeAds(googleAdSelectors);
                }
                // Only call cookie consent handler if we haven't already handled it
                // and limit how often we check (every 2 seconds max)
                if (settings.cookieConsent && !cookieConsentHandled) {
                    blockCookieConsent();
                }
            })
            .catch(error => {
                // Background script may not be available
                console.error('Error in debouncedAdRemoval:', error);
            });
    }, DEBOUNCE_DELAY);
}

// Create observer for dynamically loaded content with debouncing (skip on light-DOM hosts)
if (!ADIOS_LIGHT_DOM) {
    mutationObserver = new MutationObserver((mutations) => {
        const hasRelevantChanges = mutations.some(mutation =>
            mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0
        );
        if (hasRelevantChanges) debouncedAdRemoval();
    });
    if (document.body) {
        mutationObserver.observe(document.body, { childList: true, subtree: true });
    } else {
        bodyObserver = new MutationObserver(() => {
            if (document.body && mutationObserver) {
                mutationObserver.observe(document.body, { childList: true, subtree: true });
                if (bodyObserver) {
                    bodyObserver.disconnect();
                    bodyObserver = null;
                }
            }
        });
        bodyObserver.observe(document.documentElement, { childList: true });
    }
}

// Reset cookie consent handling on navigation
let currentUrl = window.location.href;

// Monitor for URL changes (SPA navigation)
const checkUrlChange = () => {
    try {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            cookieConsentHandled = false;
            cookieConsentAttempts = 0;
        }
    } catch (error) {
        console.error('Error checking URL change:', error);
    }
};

// Check URL on various events (store interval for cleanup)
urlCheckInterval = setInterval(checkUrlChange, 1000);

// Also reset on popstate (back/forward navigation)
window.addEventListener('popstate', () => {
    currentUrl = window.location.href;
    cookieConsentHandled = false;
    cookieConsentAttempts = 0;
});

// Reset on hashchange
window.addEventListener('hashchange', () => {
    currentUrl = window.location.href;
    cookieConsentHandled = false;
    cookieConsentAttempts = 0;
});

// Performance tracking
let pageLoadStartTime = performance.now();

window.addEventListener('load', () => {
    const loadTime = performance.now() - pageLoadStartTime;
    browser.runtime.sendMessage({
        type: 'pageLoadTime',
        loadTime: loadTime,
        url: window.location.href
    }).catch(() => {
        // Background script may not be ready
    });
    
    // Reset cookie consent handling on full page load
    cookieConsentHandled = false;
    cookieConsentAttempts = 0;
});

// ── Cosmetic rules (user-created element hides) ─────────────────────────
let cosmeticStyleEl = null;

function applyCosmeticRules(rules) {
    if (!rules || rules.length === 0) return;
    if (!cosmeticStyleEl) {
        cosmeticStyleEl = document.createElement('style');
        cosmeticStyleEl.id = '__adios_cosmetic__';
        document.head.appendChild(cosmeticStyleEl);
    }
    cosmeticStyleEl.textContent = rules.map(r => `${r}{display:none!important}`).join('\n');
}

if (!ADIOS_LIGHT_DOM) {
    browser.runtime.sendMessage({ type: 'getCosmeticRules', domain: window.location.hostname })
        .then(resp => { if (resp?.rules?.length) applyCosmeticRules(resp.rules); })
        .catch(() => {});
}

// ── Element picker ──────────────────────────────────────────────────────
let pickerMode = false;
let pickerHovered = null;
let pickerBanner = null;

function generateSelector(el) {
    if (el.id && /^[a-zA-Z]/.test(el.id) && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
        return '#' + CSS.escape(el.id);
    }
    if (el.classList.length > 0) {
        const stable = Array.from(el.classList)
            .filter(c => !/^(active|hover|focus|selected|open|show|hide|visible|hidden|fade|animate|transition|is-|has-)/.test(c))
            .slice(0, 3);
        if (stable.length > 0) {
            const sel = el.tagName.toLowerCase() + '.' + stable.map(c => CSS.escape(c)).join('.');
            if (document.querySelectorAll(sel).length === 1) return sel;
        }
    }
    // Path-based fallback (up to 3 ancestors)
    let path = [], cur = el;
    for (let i = 0; i < 3 && cur && cur !== document.body; i++) {
        const parent = cur.parentElement;
        if (!parent) break;
        const idx = Array.from(parent.children).indexOf(cur) + 1;
        path.unshift(`${cur.tagName.toLowerCase()}:nth-child(${idx})`);
        cur = parent;
    }
    return path.join(' > ');
}

function activatePickerMode() {
    pickerMode = true;
    document.body.style.cursor = 'crosshair';

    // Show floating instruction banner
    pickerBanner = document.createElement('div');
    pickerBanner.id = '__adios_picker_banner__';
    pickerBanner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(30,30,30,0.92);color:#fff;padding:8px 18px;border-radius:20px;font:500 13px/1 -apple-system,sans-serif;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.4)';
    pickerBanner.textContent = '🎯 Click an element to hide it — press Esc to cancel';
    document.body.appendChild(pickerBanner);

    document.addEventListener('mouseover', pickerMouseOver, true);
    document.addEventListener('mouseout',  pickerMouseOut,  true);
    document.addEventListener('click',     pickerClick,     true);
    document.addEventListener('keydown',   pickerKeyDown,   true);
}

function deactivatePickerMode() {
    pickerMode = false;
    document.body.style.cursor = '';
    if (pickerHovered) { pickerHovered.style.outline = ''; pickerHovered = null; }
    if (pickerBanner) { pickerBanner.remove(); pickerBanner = null; }
    document.removeEventListener('mouseover', pickerMouseOver, true);
    document.removeEventListener('mouseout',  pickerMouseOut,  true);
    document.removeEventListener('click',     pickerClick,     true);
    document.removeEventListener('keydown',   pickerKeyDown,   true);
}

function pickerMouseOver(e) {
    if (pickerHovered) pickerHovered.style.outline = '';
    pickerHovered = e.target;
    if (pickerHovered && pickerHovered !== pickerBanner) {
        pickerHovered.style.outline = '2px solid #FF3B30';
    }
}
function pickerMouseOut(e) {
    if (e.target === pickerHovered) { e.target.style.outline = ''; pickerHovered = null; }
}
function pickerKeyDown(e) {
    if (e.key === 'Escape') { deactivatePickerMode(); }
}
function pickerClick(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.target;
    if (!el || el === pickerBanner) return;
    const selector = generateSelector(el);
    el.style.display = 'none'; // hide immediately
    deactivatePickerMode();
    browser.runtime.sendMessage({
        type: 'addCosmeticRule',
        domain: window.location.hostname,
        selector
    }).catch(() => {});
}

// Listen for settings updates + picker commands
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'settingsUpdated') {
        settings = { ...settings, ...request.settings };
        if (!ADIOS_LIGHT_DOM && settings.cookieConsent) blockCookieConsent();
        if (settings.antiFingerprint) applyAntiFingerprinting();
    }
    if (request.type === 'activatePicker')   activatePickerMode();
    if (request.type === 'deactivatePicker') deactivatePickerMode();
    if (request.type === 'applyNewCosmeticRule') {
        const existing = cosmeticStyleEl ? cosmeticStyleEl.textContent : '';
        if (cosmeticStyleEl) {
            cosmeticStyleEl.textContent = existing + `\n${request.selector}{display:none!important}`;
        }
    }
    return true;
});

// Cleanup function
function cleanup() {
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
    if (bodyObserver) {
        bodyObserver.disconnect();
        bodyObserver = null;
    }
    if (urlCheckInterval) {
        clearInterval(urlCheckInterval);
        urlCheckInterval = null;
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
