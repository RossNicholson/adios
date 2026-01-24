//
//  Constants.swift
//  Shared (App)
//
//  Created by Ross Nicholson on 20/12/2024.
//

import Foundation

struct AppConstants {
    // Bundle Identifiers
    static let extensionBundleIdentifier = "dev.rossnicholson.Adios.Extension"
    static let contentBlockerIdentifier = "dev.rossnicholson.Adios.ContentBlocker"
    
    // Storage Keys
    struct StorageKeys {
        static let enabled = "enabled"
        static let totalBlocked = "totalBlocked"
        static let dataSaved = "dataSaved"
        static let exceptions = "exceptions"
        static let siteStats = "site:"
    }
    
    // Error Domains
    struct ErrorDomains {
        static let contentBlocker = "ContentBlockerErrorDomain"
    }
    
    // Error Codes
    struct ErrorCodes {
        static let failedToLoadRules = 1
        static let invalidRulesFormat = 2
        static let failedToSerializeRules = 3
    }
    
    // Support URLs
    static let supportURL = "https://rossnicholson.dev"
    static let supportEmail = "support@rossnicholson.dev"
}
