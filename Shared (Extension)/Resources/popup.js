document.addEventListener('DOMContentLoaded', async () => {
    // Get elements
    const enableToggle = document.getElementById('enableToggle');
    const adsBlockedElement = document.getElementById('adsBlocked');
    const dataSavedElement = document.getElementById('dataSaved');
    const currentDomainElement = document.getElementById('currentDomain');
    const siteBlockCountElement = document.getElementById('siteBlockCount');
    
    // Load saved stats
    const stats = await browser.storage.local.get({
        totalBlocked: 0,
        dataSaved: 0,
        enabled: true
    });
    
    // Update UI with saved stats
    adsBlockedElement.textContent = stats.totalBlocked.toLocaleString();
    dataSavedElement.textContent = formatBytes(stats.dataSaved);
    enableToggle.checked = stats.enabled;
    
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
    
    // Handle toggle
    enableToggle.addEventListener('change', async (e) => {
        await browser.storage.local.set({ enabled: e.target.checked });
        browser.runtime.sendMessage({
            type: 'toggleBlocking',
            enabled: e.target.checked
        });
    });
    
    // Handle buttons
    document.getElementById('supportBtn').addEventListener('click', () => {
        browser.tabs.create({
            url: 'https://rossnicholson.dev'
        });
    });
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log("Hello World!", browser);
