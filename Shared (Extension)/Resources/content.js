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

// Cookie consent blocker
function blockCookieConsent() {
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
    
    cookieSelectors.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Check if it's likely a cookie consent banner
                const text = element.textContent.toLowerCase();
                if (text.includes('cookie') || text.includes('consent') || text.includes('accept') || text.includes('gdpr')) {
                    element.style.display = 'none';
                    element.remove();
                }
            });
        } catch (e) {
            // Invalid selector
        }
    });
    
    // Try to click "Accept" or "Agree" buttons automatically
    const acceptButtons = document.querySelectorAll(
        'button:not([disabled]), a, [role="button"]'
    );
    acceptButtons.forEach(button => {
        const text = button.textContent.toLowerCase();
        if ((text.includes('accept') || text.includes('agree') || text.includes('ok')) && 
            (text.includes('cookie') || text.includes('all'))) {
            try {
                button.click();
            } catch (e) {
                // Button may not be clickable
            }
        }
    });
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
                if (settings.cookieConsent) {
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
