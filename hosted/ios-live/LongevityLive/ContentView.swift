import SwiftUI
import WebKit
import Combine
import UIKit

struct SharedFile: Identifiable {
    let id = UUID()
    let url: URL
}

@MainActor
final class LiveAppModel: NSObject, ObservableObject {
    @Published var loading = true
    @Published var loadError: String?
    @Published var notice: String?
    @Published var sharedFile: SharedFile?
    // Keep one web view for this app session, including ordinary background/foreground transitions.
    var webView: WKWebView?
    let location = NativeLocationBridge()
    let googleAuth = GoogleAuthentication()

    func reload() {
        guard let webView else { return }
        let alert = UIAlertController(title: "Reload the app?", message: "An active run will be paused. Saved records are kept.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Reload", style: .default) { [weak self] _ in
            self?.location.stopAll()
            self?.loadError = nil
            webView.load(URLRequest(url: AppConfiguration.websiteURL, cachePolicy: .reloadIgnoringLocalCacheData))
        })
        WebViewPresenter.present(alert, from: webView)
    }

    func retry() {
        loadError = nil
        loading = true
        webView?.load(URLRequest(url: AppConfiguration.websiteURL, cachePolicy: .reloadIgnoringLocalCacheData))
    }
}

struct ContentView: View {
    @StateObject private var model = LiveAppModel()
    @State private var menuOpen = false
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color(red: 0.97, green: 0.97, blue: 0.95).ignoresSafeArea()
            LiveWebView(model: model)
            if model.loading && model.loadError == nil {
                ProgressView("Loading Longevity Simulator…")
                    .padding(20).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if let error = model.loadError {
                VStack(spacing: 18) {
                    Image(systemName: "wifi.exclamationmark").font(.largeTitle)
                    Text("Could not load the app").font(.title2.bold())
                    Text(error).multilineTextAlignment(.center)
                    Text("This edition connects to your live website and needs internet.").foregroundStyle(.secondary)
                    Button("Try again") { model.retry() }.buttonStyle(.borderedProminent)
                }.padding(30).frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(uiColor: .systemBackground))
            }
            // Kept at the edge so the website's navigation and design remain intact.
            Button { menuOpen = true } label: {
                Image(systemName: "ellipsis.circle.fill").font(.title2)
                    .symbolRenderingMode(.palette).foregroundStyle(.white, Color(red: 0.2, green: 0.36, blue: 0.27))
                    .padding(10).background(.regularMaterial, in: Circle())
            }.padding(10).accessibilityLabel("iPhone app options")
                .confirmationDialog("iPhone app options", isPresented: $menuOpen, titleVisibility: .visible) {
                    Button("Run recording status") { model.notice = model.location.recordingDiagnostics }
                    Button("Reload latest website") { model.reload() }
                    Button("iPhone location settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                    }
                    Button("Open website in Safari") { UIApplication.shared.open(AppConfiguration.websiteURL) }
                    Button("Cancel", role: .cancel) { }
                }
        }
        .onReceive(NotificationCenter.default.publisher(for: Notification.Name("LongevityOpenRun"))) { _ in
            if AppConfiguration.isWebsite(model.webView?.url) {
                model.webView?.evaluateJavaScript("if(typeof openAppPage==='function'){openAppPage('activity');if(typeof showExerciseTool==='function')showExerciseTool('gps');}", completionHandler: nil)
            }
        }
        .tint(Color(red: 0.2, green: 0.36, blue: 0.27))
        .sheet(item: $model.sharedFile) { file in ShareSheet(url: file.url) }
        .alert("Longevity Simulator", isPresented: Binding(get: { model.notice != nil }, set: { if !$0 { model.notice = nil } })) {
            Button("OK", role: .cancel) { model.notice = nil }
        } message: { Text(model.notice ?? "") }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) { }
}
