//
//  AppDelegate.swift
//  macOS (App)
//

import Cocoa

extension Notification.Name {
    static let menuBarIconSettingChanged = Notification.Name("dev.rossnicholson.Adios.menuBarIconSettingChanged")
}

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    static let menuBarIconKey = "showMenuBarIcon"

    private var statusItem: NSStatusItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let window = NSApp.windows.first else { return }

        // Liquid Glass window setup
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.styleMask.insert(.fullSizeContentView)
        window.isOpaque = false
        window.backgroundColor = .clear

        // Insert vibrancy view as the window background
        guard let contentView = window.contentView else { return }
        let vibrancy = NSVisualEffectView(frame: contentView.bounds)
        vibrancy.material = .sidebar
        vibrancy.blendingMode = .behindWindow
        vibrancy.state = .active
        vibrancy.autoresizingMask = [.width, .height]
        contentView.addSubview(vibrancy, positioned: .below, relativeTo: contentView.subviews.first)

        NotificationCenter.default.addObserver(self, selector: #selector(menuBarSettingChanged), name: .menuBarIconSettingChanged, object: nil)
        updateMenuBarItem()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return statusItem == nil
    }

    private func updateMenuBarItem() {
        let show = UserDefaults.standard.bool(forKey: AppDelegate.menuBarIconKey)
        if show {
            guard statusItem == nil else { return }
            statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
            let icon = NSImage(systemSymbolName: "shield.fill", accessibilityDescription: "Adios")
            icon?.isTemplate = true
            statusItem?.button?.image = icon

            let menu = NSMenu()
            menu.addItem(NSMenuItem(title: "Open Adios", action: #selector(openMainWindow), keyEquivalent: ""))
            menu.addItem(.separator())
            menu.addItem(NSMenuItem(title: "Quit Adios", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
            statusItem?.menu = menu
        } else {
            if let item = statusItem {
                NSStatusBar.system.removeStatusItem(item)
                statusItem = nil
            }
        }
    }

    @objc private func menuBarSettingChanged() {
        updateMenuBarItem()
    }

    @objc private func openMainWindow() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.windows.first?.makeKeyAndOrderFront(nil)
    }

}
