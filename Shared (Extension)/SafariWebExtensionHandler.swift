//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Ross Nicholson on 20/12/2024.
//

import SafariServices
import os.log

extension OSLog {
    static let safariExtension = OSLog(subsystem: "dev.rossnicholson.Adios", category: "SafariExtension")
}

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        // iOS 26.0+ and macOS 26.0+ use SFExtensionProfileKey
        profile = request?.userInfo?[SFExtensionProfileKey] as? UUID

        let message: Any?
        // iOS 26.0+ and macOS 26.0+ use SFExtensionMessageKey
        message = request?.userInfo?[SFExtensionMessageKey]

        os_log(.info, log: .safariExtension, "Received message from browser.runtime.sendNativeMessage: %{public}@ (profile: %{public}@)", 
               String(describing: message ?? "nil"), profile?.uuidString ?? "none")

        let response = NSExtensionItem()
        response.userInfo = [ SFExtensionMessageKey: [ "echo": message ?? NSNull() ] ]

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
