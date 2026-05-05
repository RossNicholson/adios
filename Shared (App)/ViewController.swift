//
//  ViewController.swift
//  Shared (App)
//
//  Created by Ross Nicholson on 20/12/2024.
//

import Cocoa
import WebKit
import SafariServices
import os.log

extension OSLog {
    static let viewController = OSLog(subsystem: "dev.rossnicholson.Adios", category: "ViewController")
}

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.configuration.userContentController.add(self, name: "controller")

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
        
        // Transparent background so the NSVisualEffectView vibrancy shows through
        self.webView.setValue(false, forKey: "drawsBackground")

        self.webView.loadFileURL(htmlURL, allowingReadAccessTo: resourceURL)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
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
    }
    
    private func showErrorToUser(_ message: String) {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Error"
            alert.informativeText = message
            alert.alertStyle = .warning
            alert.addButton(withTitle: "OK")
            alert.runModal()
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let messageBody = message.body as? String, messageBody == "open-preferences" else {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: "dev.rossnicholson.Adios.Extension") { error in
            DispatchQueue.main.async {
                if error != nil {
                    NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Safari.app"))
                }
                NSApp.terminate(nil)
            }
        }
    }

}
