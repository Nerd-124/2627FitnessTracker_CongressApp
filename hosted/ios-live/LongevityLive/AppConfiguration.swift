import Foundation

enum AppConfiguration {
    static let websiteURL = URL(string: "https://longevity-simulator-lab.idealapple4.chatgpt.site/app")!
    static var origin: String { "https://" + websiteURL.host! }
    static func isWebsite(_ url: URL?) -> Bool {
        url?.scheme == "https" && url?.host == websiteURL.host && (url?.port == nil || url?.port == 443)
    }
    static func isAuthentication(_ url: URL) -> Bool {
        false 
    }
}
