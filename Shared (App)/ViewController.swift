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

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        // iOS doesn't support checking Safari extension state programmatically
        // Users must enable the extension manually in Settings > Safari > Extensions
        webView.evaluateJavaScript("show('ios')") { result, error in
            if let error = error {
                os_log(.error, log: .viewController, "Error evaluating JavaScript: %{public}@", error.localizedDescription)
            }
        }
#elseif os(macOS)
        webView.evaluateJavaScript("show('mac')") { result, error in
            if let error = error {
                os_log(.error, log: .viewController, "Error evaluating JavaScript: %{public}@", error.localizedDescription)
            }
        }

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "dev.rossnicholson.Adios.Extension") { (state, error) in
            if let error = error {
                os_log(.error, log: .viewController, "Error getting extension state: %{public}@", error.localizedDescription)
                return
            }
            
            guard let state = state else {
                os_log(.error, log: .viewController, "Extension state is nil")
                return
            }

            DispatchQueue.main.async {
                // macOS 26.0+ uses Settings instead of Preferences
                let jsCode = "show('mac', \(state.isEnabled), true)"
                webView.evaluateJavaScript(jsCode) { result, error in
                    if let error = error {
                        os_log(.error, log: .viewController, "Error evaluating JavaScript: %{public}@", error.localizedDescription)
                    }
                }
            }
        }
#endif
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
