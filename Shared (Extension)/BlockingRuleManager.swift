import Foundation
import SafariServices
import os.log

extension OSLog {
    static let blockingRules = OSLog(subsystem: "dev.rossnicholson.Adios", category: "BlockingRules")
}

class BlockingRuleManager {
    static let shared = BlockingRuleManager()
    
    private let rulesURL: URL
    
    // Bundle identifier for content blocker extension
    static let contentBlockerIdentifier = "dev.rossnicholson.Adios.ContentBlocker"
    
    private init() {
        guard let rulesURL = Bundle.main.url(forResource: "blocking-rules", withExtension: "json", subdirectory: "blocking") else {
            fatalError("Could not find blocking rules file")
        }
        self.rulesURL = rulesURL
    }
    
    func loadRules() -> [[String: Any]]? {
        do {
            let data = try Data(contentsOf: rulesURL)
            let rules = try JSONSerialization.jsonObject(with: data) as? [[String: Any]]
            return rules
        } catch {
            os_log(.error, log: .blockingRules, "Error loading blocking rules: %{public}@", error.localizedDescription)
            return nil
        }
    }
    
    func validateRules(_ rules: [[String: Any]]) -> Bool {
        // Basic validation
        guard rules.count <= 50000 else { return false }
        
        for rule in rules {
            guard let trigger = rule["trigger"] as? [String: Any],
                  let action = rule["action"] as? [String: Any],
                  let _ = trigger["url-filter"] as? String,
                  let actionType = action["type"] as? String else {
                return false
            }
            
            // Validate action type
            let validActionTypes = ["block", "css-display-none", "make-https"]
            guard validActionTypes.contains(actionType) else {
                return false
            }
        }
        
        return true
    }
    
    func reloadContentBlocker(completion: ((Error?) -> Void)? = nil) {
        SFContentBlockerManager.reloadContentBlocker(withIdentifier: Self.contentBlockerIdentifier) { error in
            if let error = error {
                os_log(.error, log: .blockingRules, "Error reloading content blocker: %{public}@", error.localizedDescription)
            } else {
                os_log(.info, log: .blockingRules, "Content blocker reloaded successfully")
            }
            completion?(error)
        }
    }
} 