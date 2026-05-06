function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);

    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('platform-mac state-on')[0].innerText = "Both Adios extensions are active.";
        document.getElementsByClassName('platform-mac state-off')[0].innerText = "Adios is disabled. Enable both extensions in Safari Settings → Extensions.";
        document.getElementsByClassName('open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);

        if (enabled) {
            document.querySelector('.setup-card-title').innerText = "Extensions are active";
            document.querySelector('.setup-steps').innerHTML =
                '<li>Adios is blocking ads in Safari.</li>' +
                '<li>Adios Content Blocker is also active.</li>' +
                '<li>Manage both any time in Safari Settings → Extensions.</li>';
        }
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
