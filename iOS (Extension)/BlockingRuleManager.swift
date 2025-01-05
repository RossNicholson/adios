import Foundation

class BlockingRuleManager {
    static let shared = BlockingRuleManager()
    
    private let rulesURL: URL
    
    private init() {
        guard let rulesURL = Bundle.main.url(forResource: "blocking-rules", withExtension: "json") else {
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
            print("Error loading rules: \(error)")
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
} 