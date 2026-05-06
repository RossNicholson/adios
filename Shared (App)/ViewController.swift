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
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: "dev.rossnicholson.Adios.Extension") { (state, error) in
            DispatchQueue.main.async {
                if let state = state, error == nil {
                    let isEnabled = state.isEnabled ? "true" : "false"
                    webView.evaluateJavaScript("show('mac', \(isEnabled))") { _, _ in }
                } else {
                    webView.evaluateJavaScript("show('mac', undefined)") { _, _ in }
                }
            }
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.request.url?.scheme == "adios" else {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        NSWorkspace.shared.open(URL(fileURLWithPath: "/Applications/Safari.app"))
        SFSafariApplication.showPreferencesForExtension(withIdentifier: "dev.rossnicholson.Adios.Extension") { _ in
            DispatchQueue.main.async {
                NSApp.terminate(nil)
            }
        }
    }

}
