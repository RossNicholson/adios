// Function to remove ad elements
function removeAds(selectors) {
    if (!selectors || selectors.length === 0) return;
    
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.remove();
        });
    });
}

// Initial ad removal
browser.runtime.sendMessage({ type: "getAdSelectors" })
    .then(response => {
        removeAds(response.selectors);
    });

// Create observer for dynamically loaded content
const observer = new MutationObserver(() => {
    browser.runtime.sendMessage({ type: "getAdSelectors" })
        .then(response => {
            removeAds(response.selectors);
        });
});

// Start observing DOM changes
observer.observe(document.body, {
    childList: true,
    subtree: true
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Received request: ", request);
});
