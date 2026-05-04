# Adios — Safari Ad Blocker for Mac

<p align="center">
  <img src="Shared (App)/Assets.xcassets/AppIcon.appiconset/rosconic_ios_app_icon_of_a_shield_ef787c77-f027-4eee-af65-c068c82fcac3.png" width="128" height="128" alt="Adios Logo">
</p>

<p align="center">
  <a href="https://github.com/rossnicholson/adios/releases/latest"><img src="https://img.shields.io/github/v/release/rossnicholson/adios" alt="Latest Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/rossnicholson/adios" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-macOS%2026%2B-blue" alt="macOS 26+">
  <img src="https://img.shields.io/badge/Safari-Web%20Extension-orange" alt="Safari Extension">
</p>

An open-source, feature-rich ad blocker for Safari on macOS. Adios blocks ads, trackers, cookie consent banners, and social media widgets — with real-time statistics and powerful customisation.

---

## Installation

### Homebrew (recommended)

```bash
brew tap rossnicholson/tap
brew install --cask adios
```

### Manual

Download the latest `.dmg` from the [Releases page](https://github.com/rossnicholson/adios/releases), open it, and drag **Adios.app** to your Applications folder.

### After installing

1. Open **Adios** from your Applications folder
2. In Safari, go to **Settings → Extensions**
3. Find **Adios** and enable it
4. Grant permissions when prompted

---

## Features

### Core Blocking
- **Ad Blocking** — Blocks display ads, video ads, and sponsored content
- **Tracker Blocking** — Prevents analytics and tracking scripts
- **Social Media** — Blocks social widgets and tracking pixels
- **Malware Protection** — Blocks known malicious domains
- **Cookie Consent Auto-Dismiss** — Automatically handles cookie banners

### Privacy
- **Anti-Fingerprinting** — Spoofs canvas, WebGL, and timing-based fingerprinting
- **Zero Data Collection** — No personal data ever collected or transmitted
- **First-Party Protection** — Never interferes with a page's own resources

### Customisation
- **Smart Presets** — Switch between Strict, Balanced, and Relaxed modes
- **Custom Rules Editor** — Write your own blocking rules with pattern matching
- **Site-Specific Rules** — Different blocking behaviour per website
- **Site Exceptions** — Whitelist trusted sites with one click
- **Rule Templates Library** — Pre-made rules you can apply instantly
- **Scheduled Blocking** — Automatically adjust blocking by time of day

### Analytics
- **Real-Time Statistics** — Ads, trackers, and data saved as you browse
- **Network Monitor** — Watch requests being blocked live
- **Blocking History** — Full timeline of what was blocked and where
- **Privacy Score** — Instant 0–100 privacy score per website
- **Visual Charts** — Blocking trends and category breakdowns
- **Export Stats** — Export your blocking data as JSON

---

## Building from Source

### Requirements
- macOS 15 (Sequoia) or later
- Xcode 16.2 or later
- An Apple Developer account (free tier works for local builds)

### Steps

```bash
git clone https://github.com/rossnicholson/adios.git
cd adios
open Adios.xcodeproj
```

Select the **Adios (macOS)** scheme and press **⌘R** to build and run.

> **Note:** You'll need to update the `DEVELOPMENT_TEAM` in Build Settings to your own Apple Developer team ID before building.

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a Pull Request

Please open an issue first for significant changes so we can discuss the approach.

---

## Release Process

Releases are automated via GitHub Actions. To publish a new version:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The workflow will:
1. Build the app in Release configuration
2. Sign with a Developer ID certificate
3. Create a `.dmg`
4. Notarize with Apple
5. Publish a GitHub Release
6. Update the Homebrew Cask formula automatically

See [`.github/workflows/release.yml`](.github/workflows/release.yml) for details.

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `DEVELOPER_ID_CERTIFICATE_BASE64` | Base64-encoded `.p12` Developer ID certificate |
| `DEVELOPER_ID_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `KEYCHAIN_PASSWORD` | A password for the temporary CI keychain |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_ID_PASSWORD` | An [app-specific password](https://support.apple.com/en-us/102654) for notarization |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer team ID |
| `TAP_GITHUB_TOKEN` | A GitHub token with write access to your `homebrew-tap` repo |

---

## Privacy

Adios reads webpage content solely to identify and block ads. It:
- Never collects personal information
- Never stores your browsing history
- Never transmits any data to any server
- Is fully open source — you can verify this yourself

---

## License

[MIT License](LICENSE) — © 2024 Ross Nicholson

---

## Support

- **Issues:** [GitHub Issues](https://github.com/rossnicholson/adios/issues)
- **Website:** [rossnicholson.dev](https://rossnicholson.dev)
