import Foundation
#if os(iOS)
import MobileCoreServices
#elseif os(macOS)
import CoreServices
#endif

class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let rules = BlockingRuleManager.shared.loadRules(),
              BlockingRuleManager.shared.validateRules(rules) else {
            let error = NSError(domain: "ContentBlockerErrorDomain", code: 1, userInfo: nil)
            context.cancelRequest(withError: error)
            return
        }
        
        let jsonData = try? JSONSerialization.data(withJSONObject: rules, options: [])
        let attachment = NSItemProvider(item: jsonData as NSData?, typeIdentifier: kUTTypeJSON as String)
        
        let item = NSExtensionItem()
        item.attachments = [attachment]
        
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
} 