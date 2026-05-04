import Foundation
import CoreServices
import os.log

extension OSLog {
    static let contentBlocker = OSLog(subsystem: "dev.rossnicholson.Adios", category: "ContentBlocker")
}

class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let rules = BlockingRuleManager.shared.loadRules() else {
            let error = NSError(
                domain: "ContentBlockerErrorDomain",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to load blocking rules"]
            )
            os_log(.error, log: .contentBlocker, "Failed to load blocking rules")
            context.cancelRequest(withError: error)
            return
        }
        
        guard BlockingRuleManager.shared.validateRules(rules) else {
            let error = NSError(
                domain: "ContentBlockerErrorDomain",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Invalid blocking rules format"]
            )
            os_log(.error, log: .contentBlocker, "Invalid blocking rules format")
            context.cancelRequest(withError: error)
            return
        }
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: rules, options: []) else {
            let error = NSError(
                domain: "ContentBlockerErrorDomain",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Failed to serialize blocking rules"]
            )
            os_log(.error, log: .contentBlocker, "Failed to serialize blocking rules")
            context.cancelRequest(withError: error)
            return
        }
        
        let attachment = NSItemProvider(item: jsonData as NSData?, typeIdentifier: kUTTypeJSON as String)
        let item = NSExtensionItem()
        item.attachments = [attachment]
        
        os_log(.info, log: .contentBlocker, "Successfully loaded %d blocking rules", rules.count)
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}
