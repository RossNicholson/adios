// Function to remove ad elements
function removeAds(selectors) {
    if (!selectors || selectors.length === 0) return;
    
    let removedCount = 0;
    selectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                try {
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
let debounceTimer = null;
const DEBOUNCE_DELAY = 250; // 250ms debounce

let settings = {
    enabled: true,
    cookieConsent: true,
    antiFingerprint: true
};

// Load settings
browser.runtime.sendMessage({ type: 'getAdSelectors' })
    .then(response => {
        if (response && response.settings) {
            settings = { ...settings, ...response.settings };
        }
        if (settings.enabled) {
            removeAds(response?.selectors || []);
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
                }
                // Only call cookie consent handler if we haven't already handled it
                // and limit how often we check (every 2 seconds max)
                if (settings.cookieConsent && !cookieConsentHandled) {
                    blockCookieConsent();
                }
            })
            .catch(error => {
                // Background script may not be available
            });
    }, DEBOUNCE_DELAY);
}

// Create observer for dynamically loaded content with debouncing
const observer = new MutationObserver((mutations) => {
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
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
} else {
    // Wait for body to be available
    const bodyObserver = new MutationObserver(() => {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            bodyObserver.disconnect();
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
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        cookieConsentHandled = false;
        cookieConsentAttempts = 0;
    }
};

// Check URL on various events
setInterval(checkUrlChange, 1000);

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
});
