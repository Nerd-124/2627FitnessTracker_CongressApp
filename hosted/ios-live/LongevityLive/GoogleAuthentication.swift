import Foundation
import UIKit
import WebKit
import FirebaseCore
import FirebaseAuth
import GoogleSignIn

private final class NoAuthenticationRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

// Google OAuth uses Google's SDK/system authentication session, never WKWebView.
@MainActor
final class GoogleAuthentication: NSObject, WKScriptMessageHandler {
    private let cookieName = "__Host-longevity-google"
    private let noRedirects = NoAuthenticationRedirects()
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.timeoutIntervalForRequest = 20
        return URLSession(configuration: config, delegate: noRedirects, delegateQueue: nil)
    }()
    weak var webView: WKWebView?
    weak var model: LiveAppModel?
    private var refreshing = false
    // A foreground refresh must not swallow the post-sign-in navigation.
    private var reloadAfterRefresh = false
    private var refreshTimer: Timer?
    private var observer: NSObjectProtocol?
    private var generation = 0
    private var automaticRestoreAllowed = true
    private var signInPresented = false
    private var sessionExpiresAt = Date.distantPast
    private var nextRefreshAttempt = Date.distantPast

    override init() {
        super.init()
        observer = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, Auth.auth().currentUser != nil else { return }
                self.refreshIfNeeded()
            }
        }
    }
    deinit { if let observer { NotificationCenter.default.removeObserver(observer) }; refreshTimer?.invalidate() }

    func refreshIfNeeded() {
        guard Date() >= nextRefreshAttempt, Date().addingTimeInterval(300) >= sessionExpiresAt else { return }
        refreshSession(reload: false)
    }

    func start(in webView: WKWebView, model: LiveAppModel) {
        self.webView = webView; self.model = model
        if Auth.auth().currentUser != nil { refreshSession(reload: true) }
        else { openLogin() }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == AppConfiguration.websiteURL.host,
              (origin.port == 0 || origin.port == 443), AppConfiguration.isWebsite(message.webView?.url),
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if action == "refresh" { refreshSession(reload: false) }
        else if action == "signIn" { signIn() }
    }

    func signIn() {
        if signInPresented { return }
        guard !refreshing, let webView, let presenter = WebViewPresenter.controller(from: webView),
              let clientID = FirebaseApp.app()?.options.clientID else {
            model?.notice = "Google sign-in is not ready. Check GoogleService-Info.plist target membership."
            return
        }
        let signInGeneration = generation
        signInPresented = true
        automaticRestoreAllowed = true
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { [weak self] result, error in
            Task { @MainActor in
                guard let self, signInGeneration == self.generation else { return }
                self.signInPresented = false
                if let error {
                    if (error as NSError).code != -5 /* Google Sign-In: user cancelled */ { self.model?.notice = error.localizedDescription }
                    return
                }
                guard let googleUser = result?.user, let idToken = googleUser.idToken?.tokenString else {
                    self.model?.notice = "Google did not return a sign-in token. Please try again."
                    return
                }
                let credential = GoogleAuthProvider.credential(withIDToken: idToken, accessToken: googleUser.accessToken.tokenString)
                Auth.auth().signIn(with: credential) { [weak self] _, error in
                    Task { @MainActor in
                        guard let self, signInGeneration == self.generation else { return }
                        if let error { self.model?.notice = error.localizedDescription; return }
                        self.refreshSession(reload: true)
                    }
                }
            }
        }
    }

    // A restored Firebase session refreshes the web cookie without prompting Google again.
    func refreshSession(reload: Bool) {
        if !reload && Date() < nextRefreshAttempt { return }
        guard let user = Auth.auth().currentUser else { return }
        reloadAfterRefresh = reloadAfterRefresh || reload
        guard !refreshing else { return }
        refreshing = true
        let currentGeneration = generation
        user.getIDTokenForcingRefresh(true) { [weak self] token, error in
            Task { @MainActor in
                guard let self, currentGeneration == self.generation else { return }
                guard let token, error == nil else { self.failed(error?.localizedDescription ?? "Google session could not refresh.", reload: reload); return }
                do {
                    var request = URLRequest(url: AppConfiguration.websiteURL.deletingLastPathComponent().appendingPathComponent("api/auth/session"))
                    request.httpMethod = "POST"
                    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    request.httpBody = try JSONSerialization.data(withJSONObject: ["idToken": token])
                    let (data, response) = try await self.session.data(for: request)
                    guard currentGeneration == self.generation, let response = response as? HTTPURLResponse else { return }
                    guard response.statusCode == 200, let fields = response.allHeaderFields as? [String: String],
                          let url = response.url, AppConfiguration.isWebsite(url) else {
                        let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                        throw NSError(domain: "LongevitySignIn", code: response.statusCode, userInfo: [NSLocalizedDescriptionKey: body?["error"] as? String ?? "The website could not accept Google sign-in. Please retry."])
                    }
                    let cookies = HTTPCookie.cookies(withResponseHeaderFields: fields, for: url).filter { $0.name == self.cookieName && $0.domain == AppConfiguration.websiteURL.host && $0.path == "/" && $0.isSecure && $0.isHTTPOnly }
                    guard let cookie = cookies.first, let webView = self.webView else { throw NSError(domain: "LongevitySignIn", code: 0, userInfo: [NSLocalizedDescriptionKey: "The website did not return a secure Google session."]) }
                    await webView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
                    guard currentGeneration == self.generation else {
                        for stored in await webView.configuration.websiteDataStore.httpCookieStore.allCookies() where stored.name == cookie.name && stored.value == cookie.value {
                            await webView.configuration.websiteDataStore.httpCookieStore.deleteCookie(stored)
                        }
                        return
                    }
                    self.nextRefreshAttempt = Date.distantPast
                    self.sessionExpiresAt = cookie.expiresDate ?? Date().addingTimeInterval(3500)
                    self.refreshing = false
                    self.automaticRestoreAllowed = true
                    self.refreshTimer?.invalidate()
                    self.refreshTimer = Timer.scheduledTimer(withTimeInterval: 2700, repeats: true) { [weak self] _ in
                        Task { @MainActor in self?.refreshSession(reload: false) }
                    }
                    let shouldOpenSimulator = self.reloadAfterRefresh
                    self.reloadAfterRefresh = false
                    if shouldOpenSimulator { self.model?.loadError = nil; webView.load(URLRequest(url: AppConfiguration.websiteURL, cachePolicy: .reloadIgnoringLocalCacheData)) }
                    else if AppConfiguration.isWebsite(webView.url) { webView.evaluateJavaScript("window.dispatchEvent(new Event('longevity-session-refreshed'));", completionHandler: nil) }
                } catch { if currentGeneration == self.generation { self.failed(error.localizedDescription, reload: reload) } }
            }
        }
    }

    private func failed(_ message: String, reload: Bool) {
        let shouldOpenLogin = reloadAfterRefresh || reload
        reloadAfterRefresh = false
        refreshing = false
        automaticRestoreAllowed = false
        nextRefreshAttempt = Date().addingTimeInterval(30)
        if shouldOpenLogin { model?.notice = message; openLogin() }
        else if AppConfiguration.isWebsite(webView?.url) {
            webView?.evaluateJavaScript("window.dispatchEvent(new Event('longevity-session-refresh-failed'));", completionHandler: nil)
        }
    }

    func openLogin() {
        let url = AppConfiguration.websiteURL.deletingLastPathComponent().appendingPathComponent("login")
        webView?.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    func handleLoginNavigation() -> Bool {
        if !refreshing, automaticRestoreAllowed, Auth.auth().currentUser != nil { refreshSession(reload: true); return true }
        return false
    }

    func signOut() {
        generation += 1
        signInPresented = false
        reloadAfterRefresh = false
        refreshing = false
        refreshTimer?.invalidate(); refreshTimer = nil
        model?.location.stopAll()
        GIDSignIn.sharedInstance.signOut()
        do { try Auth.auth().signOut() } catch { model?.notice = "Could not finish signing out. Please retry."; return }
        guard let webView else { return }
        Task { @MainActor in
            for cookie in await webView.configuration.websiteDataStore.httpCookieStore.allCookies() where cookie.name == self.cookieName && cookie.domain == AppConfiguration.websiteURL.host {
                await webView.configuration.websiteDataStore.httpCookieStore.deleteCookie(cookie)
            }
            openLogin()
        }
    }
}
