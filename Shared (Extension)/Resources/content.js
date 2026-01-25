// Browser API polyfill for compatibility
if (typeof browser === 'undefined') {
    window.browser = typeof chrome !== 'undefined' ? chrome : {};
}

// Store observers and timers for cleanup
let mutationObserver = null;
let bodyObserver = null;
let urlCheckInterval = null;
let debounceTimer = null;

// Function to remove ad elements
function removeAds(selectors) {
    if (!selectors || selectors.length === 0) return;
    
    let removedCount = 0;
    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                try {
                    // Check if element contains Google Chrome ad text
                    const text = element.textContent || '';
                    if (text.includes('Switch to Google Chrome') || 
                        text.includes('Browse securely with Chrome') ||
                        (text.includes('Google Chrome') && (text.includes('Switch') || text.includes('Browse securely')))) {
                        element.remove();
                        removedCount++;
                        return;
                    }
                    
                    // Check parent elements for ad indicators
                    let parent = element.parentElement;
                    let depth = 0;
                    while (parent && depth < 3) {
                        const parentText = parent.textContent || '';
                        const parentClass = parent.className || '';
                        const parentId = parent.id || '';
                        
                        if (parentText.includes('Switch to Google Chrome') ||
                            parentText.includes('Browse securely with Chrome') ||
                            parentClass.includes('ad') ||
                            parentId.includes('ad') ||
                            parentClass.includes('banner') ||
                            parentId.includes('banner')) {
                            parent.remove();
                            removedCount++;
                            return;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                    
                    element.remove();
                    removedCount++;
                } catch (e) {
                    // Element may have already been removed
                }
            });
        } catch (e) {
            // Invalid selector, skip
        }
    });
    
    // Also look for Google Chrome ads by text content
    if (removedCount === 0) {
        try {
            const allDivs = document.querySelectorAll('div, a, section, article');
            allDivs.forEach(el => {
                const text = el.textContent || '';
                if ((text.includes('Switch to Google Chrome') || 
                     text.includes('Browse securely with Chrome')) &&
                    (el.querySelector('a[href*="chrome"]') || 
                     el.querySelector('a[href*="google.com/chrome"]') ||
                     el.className.includes('ad') ||
                     el.id.includes('ad'))) {
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
    
    // Common cookie consent selectors
    const cookieSelectors = [
        '#cookie-banner',
        '#cookie-consent',
        '.cookie-consent',
        '.cookie-banner',
        '.cookie-notice',
        '[id*="cookie"]',
        '[class*="cookie-consent"]',
        '[class*="cookie-banner"]',
        '[class*="cookie-notice"]',
        '[id*="consent"]',
        '[class*="consent-banner"]',
        '[data-testid*="cookie"]',
        '[aria-label*="cookie" i]',
        '[aria-label*="consent" i]'
    ];
    
    let foundBanner = false;
    
    cookieSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Check if it's likely a cookie consent banner
                const text = element.textContent.toLowerCase();
                if (text.includes('cookie') || text.includes('consent') || text.includes('accept') || text.includes('gdpr')) {
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
function applyAntiFingerprinting() {
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
browser.runtime.sendMessage({ type: 'getAdSelectors' })
    .then(response => {
        if (response && response.settings) {
            settings = { ...settings, ...response.settings };
        }
        if (settings.enabled) {
            // Remove ads immediately
            removeAds(response?.selectors || []);
            
            // Also remove Google ads specifically (including Chrome promotional ads)
            const googleAdSelectors = [
                'ins.adsbygoogle',
                'div[id*="google_ads"]',
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
            
            // Aggressively remove Chrome ads and Google ads by text pattern
            const removeGoogleAdsByText = () => {
                const allElements = Array.from(document.querySelectorAll('div, a, section, article, aside, span, p'));
                allElements.forEach(el => {
                    const text = (el.textContent || '').trim();
                    const innerHTML = (el.innerHTML || '').toLowerCase();
                    
                    // Check for Google Chrome promotional ads
                    if ((text.includes('Switch to Google Chrome') || 
                         text.includes('Browse securely with Chrome') ||
                         text.includes('Download Chrome') ||
                         text.includes('Get Chrome')) &&
                        text.length < 500) {
                        const hasChromeLink = el.querySelector('a[href*="chrome"]') || 
                                             el.querySelector('a[href*="google.com/chrome"]') ||
                                             el.closest('a[href*="chrome"]');
                        const hasButton = el.querySelector('button, [role="button"], [class*="button"]');
                        
                        if (hasChromeLink || hasButton || el.tagName === 'A') {
                            try {
                                el.style.display = 'none';
                                el.style.visibility = 'hidden';
                                el.style.height = '0';
                                el.style.overflow = 'hidden';
                                el.remove();
                            } catch (e) {
                                // Ignore errors
                            }
                        }
                    }
                    
                    // Check for Google Ads by common text patterns
                    if ((text.includes('AdChoices') || 
                         text.includes('Advertisement') ||
                         innerHTML.includes('adsbygoogle') ||
                         innerHTML.includes('google_ads') ||
                         innerHTML.includes('doubleclick')) &&
                        (el.querySelector('iframe[src*="google"]') ||
                         el.querySelector('iframe[src*="doubleclick"]') ||
                         el.querySelector('ins.adsbygoogle') ||
                         el.className.includes('ad') ||
                         el.id.includes('ad'))) {
                        try {
                            el.style.display = 'none';
                            el.style.visibility = 'hidden';
                            el.style.height = '0';
                            el.style.overflow = 'hidden';
                            el.remove();
                        } catch (e) {
                            // Ignore errors
                        }
                    }
                });
            };
            
            // Run immediately and then again after delays to catch dynamically loaded ads
            removeGoogleAdsByText();
            setTimeout(removeGoogleAdsByText, 500);
            setTimeout(removeGoogleAdsByText, 1500);
            setTimeout(removeGoogleAdsByText, 3000);
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
        browser.runtime.sendMessage({ type: "getAdSelectors" })
            .then(response => {
                if (response && response.settings) {
                    settings = { ...settings, ...response.settings };
                }
                if (settings.enabled) {
                    removeAds(response?.selectors || []);
                    
                    // Also aggressively remove Google ads
                    const googleAdSelectors = [
                        'ins.adsbygoogle',
                        'div[id*="google_ads"]',
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
                    
                    // Also remove by text content - enhanced detection
                    const removeGoogleAdsByText = () => {
                        const allElements = Array.from(document.querySelectorAll('div, a, section, article, aside, span, p'));
                        allElements.forEach(el => {
                            const text = (el.textContent || '').trim();
                            const innerHTML = (el.innerHTML || '').toLowerCase();
                            
                            // Check for Google Chrome promotional ads
                            if ((text.includes('Switch to Google Chrome') || 
                                 text.includes('Browse securely with Chrome') ||
                                 text.includes('Download Chrome') ||
                                 text.includes('Get Chrome')) &&
                                text.length < 500) {
                                const hasChromeLink = el.querySelector('a[href*="chrome"]') || 
                                                     el.querySelector('a[href*="google.com/chrome"]') ||
                                                     el.closest('a[href*="chrome"]');
                                const hasButton = el.querySelector('button, [role="button"], [class*="button"]');
                                
                                if (hasChromeLink || hasButton || el.tagName === 'A') {
                                    try {
                                        el.style.display = 'none';
                                        el.style.visibility = 'hidden';
                                        el.style.height = '0';
                                        el.style.overflow = 'hidden';
                                        el.remove();
                                    } catch (e) {}
                                }
                            }
                            
                            // Check for Google Ads by common text patterns
                            if ((text.includes('AdChoices') || 
                                 text.includes('Advertisement') ||
                                 innerHTML.includes('adsbygoogle') ||
                                 innerHTML.includes('google_ads') ||
                                 innerHTML.includes('doubleclick')) &&
                                (el.querySelector('iframe[src*="google"]') ||
                                 el.querySelector('iframe[src*="doubleclick"]') ||
                                 el.querySelector('ins.adsbygoogle') ||
                                 el.className.includes('ad') ||
                                 el.id.includes('ad'))) {
                                try {
                                    el.style.display = 'none';
                                    el.style.visibility = 'hidden';
                                    el.style.height = '0';
                                    el.style.overflow = 'hidden';
                                    el.remove();
                                } catch (e) {}
                            }
                        });
                    };
                    removeGoogleAdsByText();
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

// Create observer for dynamically loaded content with debouncing
mutationObserver = new MutationObserver((mutations) => {
    // Only process if there are actual DOM changes
    const hasRelevantChanges = mutations.some(mutation => 
        mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0
    );
    
    if (hasRelevantChanges) {
        debouncedAdRemoval();
    }
});

// Start observing DOM changes when body is available
if (document.body) {
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
} else {
    // Wait for body to be available
    bodyObserver = new MutationObserver(() => {
        if (document.body && mutationObserver) {
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            if (bodyObserver) {
                bodyObserver.disconnect();
                bodyObserver = null;
            }
        }
    });
    bodyObserver.observe(document.documentElement, {
        childList: true
    });
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

// Listen for settings updates
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'settingsUpdated') {
        settings = { ...settings, ...request.settings };
        if (settings.cookieConsent) {
            blockCookieConsent();
        }
        if (settings.antiFingerprint) {
            applyAntiFingerprinting();
        }
    }
    return true; // Keep channel open for async response
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
