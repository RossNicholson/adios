//
//  ViewController.swift
//  Shared (App)
//
//  Created by Ross Nicholson on 20/12/2024.
//

import WebKit
import os.log

#if os(iOS)
import UIKit
import SafariServices
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
import SafariServices
typealias PlatformViewController = NSViewController
#endif

extension OSLog {
    static let viewController = OSLog(subsystem: "dev.rossnicholson.Adios", category: "ViewController")
}

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = false
#endif

        self.webView.configuration.userContentController.add(self, name: "controller")

        // Safely load HTML resource
        guard let htmlURL = Bundle.main.url(forResource: "Main", withExtension: "html") else {
            os_log(.error, log: .viewController, "Failed to load Main.html resource")
            showErrorToUser("Unable to load app interface. Please reinstall the app.")
            return
        }
        
        guard let resourceURL = Bundle.main.resourceURL else {
            os_log(.error, log: .viewController, "Failed to get resource URL")
            showErrorToUser("Unable to access app resources. Please reinstall the app.")
            return
        }
        
        self.webView.loadFileURL(htmlURL, allowingReadAccessTo: resourceURL)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        // iOS doesn't support checking Safari extension state programmatically
        // Users must enable the extension manually in Settings > Safari > Extensions
        let jsCode = "show('ios')"
        webView.evaluateJavaScript(jsCode) { result, error in
            if let error = error {
                os_log(.error, log: .viewController, "Error evaluating JavaScript: %{public}@", error.localizedDescription)
                self.showErrorToUser("Failed to initialize interface. Please restart the app.")
            }
        }
#elseif os(macOS)
        let jsCode = "show('mac')"
        webView.evaluateJavaScript(jsCode) { result, error in
            if let error = error {
                os_log(.error, log: .viewController, "Error evaluating JavaScript: %{public}@", error.localizedDescription)
                self.showErrorToUser("Failed to initialize interface. Please restart the app.")
            }
        }

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "dev.rossnicholson.Adios.Extension") { (state, error) in
            if let error = error {
                os_log(.error, log: .viewController, "Error getting extension state: %{public}@", error.localizedDescription)
                DispatchQueue.main.async {
                    self.showErrorToUser("Unable to check extension status. Please check Safari Settings manually.")
                }
                return
            }
            
            guard let state = state else {
                os_log(.error, log: .viewController, "Extension state is nil")
                DispatchQueue.main.async {
                    self.showErrorToUser("Unable to determine extension status. Please check Safari Settings manually.")
                }
                return
            }

            DispatchQueue.main.async {
                // macOS 26.0+ uses Settings instead of Preferences
                // Sanitize boolean value to prevent JS injection
                let isEnabled = state.isEnabled ? "true" : "false"
                let jsCode = "show('mac', \(isEnabled), true)"
                webView.evaluateJavaScript(jsCode) { result, error in
                    if let error = error {
                        os_log(.error, log: .viewController, "Error evaluating JavaScript: %{public}@", error.localizedDescription)
                        self.showErrorToUser("Failed to update extension status display.")
                    }
                }
            }
        }
#endif
    }
    
    // Helper function to show errors to users
    private func showErrorToUser(_ message: String) {
        DispatchQueue.main.async {
#if os(iOS)
            let alert = UIAlertController(title: "Error", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(alert, animated: true)
#elseif os(macOS)
            let alert = NSAlert()
            alert.messageText = "Error"
            alert.informativeText = message
            alert.alertStyle = .warning
            alert.addButton(withTitle: "OK")
            alert.runModal()
#endif
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
#if os(macOS)
        guard let messageBody = message.body as? String, messageBody == "open-preferences" else {
            return
        }

        // macOS 26.0+ uses Settings instead of Preferences
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "dev.rossnicholson.Adios.Extension") { error in
            if let error = error {
                os_log(.error, log: .viewController, "Error showing extension preferences: %{public}@", error.localizedDescription)
                return
            }

            DispatchQueue.main.async {
                NSApp.terminate(self)
            }
        }
#endif
    }

}
