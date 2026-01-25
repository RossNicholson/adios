//
//  AppDelegate.swift
//  macOS (App)
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

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
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

}
