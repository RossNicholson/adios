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

class ViewController: NSViewController, WKNavigationDelegate {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

        guard let htmlURL = Bundle.main.url(forResource: "Main", withExtension: "html") else {
            os_log(.error, log: .viewController, "Failed to load Main.html resource")
            return
        }

        guard let resourceURL = Bundle.main.resourceURL else {
            os_log(.error, log: .viewController, "Failed to get resource URL")
            return
        }

        self.webView.setValue(false, forKey: "drawsBackground")
        self.webView.loadFileURL(htmlURL, allowingReadAccessTo: resourceURL)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Delay the state check slightly — on a fresh install Safari needs a moment
        // to register the extension before getStateOfSafariExtension can succeed.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "dev.rossnicholson.Adios.Extension") { (state, error) in
                DispatchQueue.main.async {
                    if let state = state, error == nil {
                        let isEnabled = state.isEnabled ? "true" : "false"
                        webView.evaluateJavaScript("show('mac', \(isEnabled))") { _, _ in }
                    } else {
                        // Extension not registered yet — show setup screen silently.
                        webView.evaluateJavaScript("show('mac', false)") { _, _ in }
                    }
                }
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, preferences: WKWebpagePreferences, decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        guard navigationAction.request.url?.scheme == "adios" else {
            decisionHandler(.allow, preferences)
            return
        }
        decisionHandler(.cancel, preferences)
        NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Safari.app"))
        // Delay quit so Safari has time to come to the foreground.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            NSApp.terminate(nil)
        }
    }

}
