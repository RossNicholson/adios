function show(platform, enabled) {
    document.body.classList.add(`platform-${platform}`);

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);

        if (enabled) {
            document.querySelector('.setup-card').innerHTML =
                '<p class="setup-card-title">You\'re all set</p>' +
                '<p class="setup-active-text">Adios is active and blocking ads in Safari. ' +
                'You can manage it any time in Safari → Settings → Extensions.</p>';
        }
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function showMenuBar(enabled) {
    const toggle = document.getElementById('menu-bar-toggle');
    if (toggle) toggle.checked = enabled;
}

function navigateAdios(path) {
    const a = document.createElement('a');
    a.href = 'adios://' + path;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

const menuBarToggle = document.getElementById('menu-bar-toggle');
if (menuBarToggle) {
    menuBarToggle.addEventListener('change', function () {
        navigateAdios('set-menu-bar?enabled=' + (this.checked ? '1' : '0'));
    });
}
