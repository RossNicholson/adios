# Adios

**Adios** is a free, open-source ad and tracker blocker for **Safari on Mac**. Install a small app, turn on the Safari extension, and browse with fewer ads, fewer trackers, and simple controls when a site needs an exception.

<p align="center">
  <img src="Shared (App)/Assets.xcassets/AppIcon.appiconset/rosconic_ios_app_icon_of_a_shield_ef787c77-f027-4eee-af65-c068c82fcac3.png" width="128" height="128" alt="Adios app icon">
</p>

<p align="center">
  <a href="https://github.com/RossNicholson/Adios/releases/latest"><img src="https://img.shields.io/github/v/release/RossNicholson/Adios" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/RossNicholson/Adios" alt="License"></a>
  <img src="https://img.shields.io/badge/macOS-15%2B-blue" alt="macOS 15 or later">
  <img src="https://img.shields.io/badge/Safari-extension-orange" alt="Safari extension">
</p>

---

## What it does

- **Cuts down ads and trackers** on the sites you visit in Safari.
- **Adds a toolbar button** so you can turn blocking on or off, see what’s going on, and adjust settings for the current site.
- **Stays on your Mac** — no sign-up, no account, and no data sent to us.

Adios is **for Mac only** (not iPhone or iPad). You need a recent version of **macOS** and **Safari**.

---

## Install Adios

### Option A — Homebrew (if you use Terminal)

```bash
brew tap rossnicholson/tap
brew install --cask adios
```

### Option B — Download the app

1. Open the **[Releases](https://github.com/RossNicholson/Adios/releases)** page on GitHub.  
2. Download the latest **`.dmg`** file.  
3. Open the DMG and drag **Adios** into your **Applications** folder.

---

## Turn it on in Safari

1. **Open the Adios app once** from your Applications folder (this registers the Safari pieces).  
2. In Safari, go to **Safari → Settings → Extensions** (or **Settings → Safari → Extensions** on newer macOS, depending on your system).  
3. Find **Adios** in the list and **enable** it.  
4. If you see a second item such as **Adios Content Blocker**, turn that **on** as well — it helps Safari apply extra blocking rules.  
5. When Safari asks for permission to run Adios on websites, choose **Always Allow** (or the closest option) for the sites where you want blocking.

If something still looks off after an update, **fully quit Safari** (Safari → Quit Safari, or ⌘Q) and open it again so all parts of Adios reload.

---

## Using Adios day to day

- **Click the Adios icon** in Safari’s toolbar to open the popup: you’ll see switches for ads, trackers, and related options, plus stats and tools if you want to dig deeper.  
- **“Allow ads on this site”** (or the equivalent control) adds an **exception** for the site you’re on — useful if a page looks broken or a video won’t play.  
- **Per-site options** in the popup let you relax only certain kinds of blocking for that site without turning everything off everywhere.

---

## If a website looks wrong

1. Use **Allow ads on this site** for that address, then **reload the page**.  
2. Try turning off **only** trackers or **only** ads for that site in the popup, if those controls are available.  
3. In the Adios popup, open the **Live log** section to see recent blocking activity for help when reporting a problem.  
4. Still stuck? [Open an issue](https://github.com/RossNicholson/Adios/issues) and say which page and what you see (a blank page, a paywall message, a video error, etc.).

**Mail Online (Daily Mail):** Adios uses gentler page cleanup there so the site can load reliably. You might notice **more ads** on that site than elsewhere — that’s expected so the page doesn’t go blank.

---

## Open source

Adios is **open source** under the [MIT License](LICENSE). You’re welcome to inspect the code or suggest improvements on [GitHub](https://github.com/RossNicholson/Adios).
