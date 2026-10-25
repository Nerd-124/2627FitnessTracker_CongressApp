import SwiftUI
import WebKit
import UIKit

struct LiveWebView: UIViewRepresentable {
    @ObservedObject var model: LiveAppModel
    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        if let existing = model.webView {
            existing.navigationDelegate = context.coordinator
            existing.uiDelegate = context.coordinator
            context.coordinator.webView = existing
            return existing
        }
        let configuration = WKWebViewConfiguration()
        // Stable cookies and localStorage survive normal app updates/relaunches.
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        if let url = Bundle.main.url(forResource: "NativeBridge", withExtension: "js"),
           let script = try? String(contentsOf: url, encoding: .utf8) {
            configuration.userContentController.addUserScript(WKUserScript(
                source: script.replacingOccurrences(of: "__WEBSITE_ORIGIN__", with: AppConfiguration.origin),
                injectionTime: .atDocumentStart, forMainFrameOnly: true))
        } else { model.notice = "The native GPS script is missing. Check NativeBridge.js target membership in Xcode." }
        configuration.userContentController.add(model.location, name: "nativeLocation")
        configuration.userContentController.add(model.googleAuth, name: "nativeAuth")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.97, green: 0.97, blue: 0.95, alpha: 1)
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.allowsBackForwardNavigationGestures = true
        model.webView = webView
        model.location.webView = webView
        context.coordinator.webView = webView
        model.googleAuth.start(in: webView, model: model)
        return webView
    }
    func updateUIView(_ webView: WKWebView, context: Context) { }
    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        // LiveAppModel owns the web session. A SwiftUI view reconstruction must
        // not stop a run, clear its handlers, or perform another sign-in load.
        // Explicit pause/finish/sign-out still stop native location normally.
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        let model: LiveAppModel
        weak var webView: WKWebView?
        private var downloads: [ObjectIdentifier: WKDownload] = [:]
        private var destinations: [ObjectIdentifier: URL] = [:]
        init(model: LiveAppModel) { self.model = model }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.location.stopAll()
            model.loading = true
            model.loadError = nil
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.loading = false
            model.location.pageDidLoad()
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { show(error) }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { show(error) }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            model.location.stopAll()
            model.loading = false
            model.loadError = "The app's web process stopped. Reload to restore saved records. An unfinished run may need to be resumed."
        }
        private func show(_ error: Error) {
            let code = (error as NSError).code
            guard code != NSURLErrorCancelled, code != 102 else { return } // cancelled / download conversion
            model.loading = false
            model.loadError = error.localizedDescription
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if AppConfiguration.isWebsite(url), url.path == "/logout" { model.googleAuth.signOut(); decisionHandler(.cancel); return }
            if AppConfiguration.isWebsite(url), url.path == "/login", model.googleAuth.handleLoginNavigation() { decisionHandler(.cancel); return }
            if let host = url.host, host == "accounts.google.com" || host.hasSuffix(".accounts.google.com") { model.googleAuth.signIn(); decisionHandler(.cancel); return }
            if navigationAction.shouldPerformDownload { decisionHandler(.download); return }
            if ["https", "about", "blob", "data"].contains(url.scheme ?? "") {
                if navigationAction.targetFrame == nil, !AppConfiguration.isWebsite(url), !AppConfiguration.isAuthentication(url), url.scheme == "https" {
                    UIApplication.shared.open(url); decisionHandler(.cancel); return
                }
                decisionHandler(.allow)
            } else {
                if ["mailto", "tel"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
                decisionHandler(.cancel)
            }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // Keep same-site/auth links in the existing persistent cookie store.
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                if AppConfiguration.isWebsite(url) || AppConfiguration.isAuthentication(url) { webView.load(navigationAction.request) }
                else if url.scheme == "https" { UIApplication.shared.open(url) }
            }
            return nil
        }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: "Longevity Simulator", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            WebViewPresenter.present(alert, from: webView, onUnavailable: completionHandler)
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: "Longevity Simulator", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "Continue", style: .default) { _ in completionHandler(true) })
            WebViewPresenter.present(alert, from: webView, onUnavailable: { completionHandler(false) })
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { begin(download) }
        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { begin(download) }
        private func begin(_ download: WKDownload) {
            downloads[ObjectIdentifier(download)] = download
            download.delegate = self
            model.loading = false
        }
        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            let id = ObjectIdentifier(download)
            let name = String((suggestedFilename as NSString).lastPathComponent.prefix(180))
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("LongevityExports", isDirectory: true).appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let destination = directory.appendingPathComponent(name.isEmpty || name == "." || name == ".." ? "longevity-export" : name)
                destinations[id] = destination
                completionHandler(destination)
            } catch { completionHandler(nil); model.notice = "Could not prepare the export: " + error.localizedDescription }
        }
        func downloadDidFinish(_ download: WKDownload) {
            let id = ObjectIdentifier(download)
            if let url = destinations.removeValue(forKey: id) { model.sharedFile = SharedFile(url: url) }
            downloads.removeValue(forKey: id)
        }
        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            let id = ObjectIdentifier(download)
            if let url = destinations.removeValue(forKey: id) { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
            downloads.removeValue(forKey: id)
            model.notice = "Export could not finish. Try again. " + error.localizedDescription
        }
    }
}

@MainActor
enum WebViewPresenter {
    static func controller(from webView: WKWebView) -> UIViewController? {
        guard var presenter = webView.window?.rootViewController else { return nil }
        while let presented = presenter.presentedViewController { presenter = presented }
        return presenter.isBeingDismissed ? nil : presenter
    }
    static func present(_ controller: UIViewController, from webView: WKWebView, onUnavailable: (() -> Void)? = nil) {
        guard var presenter = webView.window?.rootViewController else { onUnavailable?(); return }
        while let presented = presenter.presentedViewController { presenter = presented }
        guard !presenter.isBeingDismissed else { onUnavailable?(); return }
        presenter.present(controller, animated: true)
    }
}
