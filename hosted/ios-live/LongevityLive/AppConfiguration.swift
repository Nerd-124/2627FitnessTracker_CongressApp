import Foundation

// Change this one URL if you move the website. Do not add tokens or credentials.
enum AppConfiguration {
    static let websiteURL = URL(string: "https://longevity-simulator-lab.idealapple4.chatgpt.site/app")!
    static var origin: String { "https://" + websiteURL.host! }
    static func isWebsite(_ url: URL?) -> Bool {
        url?.scheme == "https" && url?.host == websiteURL.host && (url?.port == nil || url?.port == 443)
    }
    static func isAuthentication(_ url: URL) -> Bool {
        false // Google sign-in is presented by the native Google Sign-In SDK.
    }
}
