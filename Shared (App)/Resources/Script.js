function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);

    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName(‘platform-mac state-on’)[0].innerText = "Adios is enabled. You can manage it in Safari Settings → Extensions.";
        document.getElementsByClassName(‘platform-mac state-off’)[0].innerText = "Adios is disabled. Enable both Adios and Adios Content Blocker in Safari Settings → Extensions.";
        document.getElementsByClassName(‘platform-mac state-unknown’)[0].innerText = "Enable both Adios and Adios Content Blocker in Safari Settings → Extensions.";
        document.getElementsByClassName('platform-mac open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
