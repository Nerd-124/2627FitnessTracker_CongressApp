import CoreLocation
import CoreMotion
import WebKit
import UIKit

// Location runs only for explicit web requests. During an active run, native GPS
// buffers fixes while WebKit is suspended and delivers them on return.
@MainActor
final class NativeLocationBridge: NSObject, @preconcurrency CLLocationManagerDelegate, WKScriptMessageHandler {
    private struct Request {
        let watch: Bool
        let timeout: TimeInterval
        var timer: DispatchWorkItem?
    }
    private let manager = CLLocationManager()
    private let pedometer = CMPedometer()
    private var stepScope: String?
    private var stepGeneration = 0
    private var lastStepPublish = Date.distantPast
    private let liveRun = RunLiveActivityController()
    private var backgroundSession: CLBackgroundActivitySession?
    private var requests: [Int: Request] = [:]
    private var observers: [NSObjectProtocol] = []
    private var bufferedLocations: [[String: Any]] = []
    private var flushingLocations = false
    private var deliveryGeneration = 0
    private var deliverySequence = 0
    weak var webView: WKWebView?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.distanceFilter = kCLDistanceFilterNone
        manager.activityType = .fitness
        manager.pausesLocationUpdatesAutomatically = false
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            if self.requests.values.contains(where: { $0.watch }) {
                self.webView?.evaluateJavaScript("window.__longevityNative?.background();", completionHandler: nil)
                self.liveRun.enteringBackground()
                self.refreshTracking()
            } else { self.stopAll() }
        })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            self?.liveRun.enteringBackground()
            self?.refreshTracking()
        })
        observers.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.publishPermission()
            self.refreshSteps()
            let pending = self.bufferedLocations.isEmpty ? "false" : "true"
            self.webView?.evaluateJavaScript("window.__longevityNative?.foreground(\(pending));", completionHandler: nil)
            self.flushBufferedLocations()
            self.refreshTracking()
        })
    }

    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == AppConfiguration.websiteURL.host,
              (origin.port == 0 || origin.port == 443), AppConfiguration.isWebsite(message.webView?.url),
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if action == "steps" { configureSteps(body); return }
        if action == "runStatus" {
            if body["phase"] as? String == "recording" { liveRun.requestNotificationFallbackIfNeeded() }
            liveRun.receive(body)
            return
        }
        if action == "permission" { publishPermission(); return }
        guard let id = body["id"] as? Int, id > 0 else { return }
        if action == "clear" { remove(id); return }
        guard action == "request", UIApplication.shared.applicationState != .background else { return }
        let timeout = max(0, min((body["timeout"] as? Double ?? 15000) / 1000, 2147483))
        remove(id)
        requests[id] = Request(watch: body["watch"] as? Bool ?? false, timeout: timeout, timer: nil)
        armTimeout(id)
        guard CLLocationManager.locationServicesEnabled() else { fail(id, code: 2, message: "Enable iPhone Location Services in Settings."); return }
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .denied, .restricted: fail(id, code: 1, message: "Allow location for Longevity Simulator in iPhone Settings.")
        case .authorizedAlways, .authorizedWhenInUse: refreshTracking()
        @unknown default: fail(id, code: 2, message: "Location permission is unavailable.")
        }
    }

    private func stepDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func sendSteps(_ message: [String: Any]) {
        guard AppConfiguration.isWebsite(webView?.url), let data = try? JSONSerialization.data(withJSONObject: message),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.__longevityNative?.receiveSteps(\(json));", completionHandler: nil)
    }

    // This binding is native app storage, not account-local browser storage.
    // Clearing a website cache or signing in as somebody else cannot reassign it.
    private var stepBinding: [String: Any]? {
        UserDefaults.standard.dictionary(forKey: "LongevityStepSourceV1")
    }
    private func configureSteps(_ body: [String: Any]) {
        stepGeneration += 1
        pedometer.stopUpdates()
        stepScope = nil
        guard body["enabled"] as? Bool == true else {
            if var binding = stepBinding {
                binding["paused"] = true
                UserDefaults.standard.set(binding, forKey: "LongevityStepSourceV1")
            }
            return
        }
        guard let scope = body["accountKey"] as? String,
              scope.range(of: "^longevity-account-v1:[a-f0-9]{64}$", options: .regularExpression) != nil else { return }
        if let binding = stepBinding {
            guard binding["owner"] as? String == scope else {
                var paused = binding
                paused["paused"] = true
                UserDefaults.standard.set(paused, forKey: "LongevityStepSourceV1")
                sendSteps(["accountKey": scope, "blocked": true, "error": "This iPhone’s step source belongs to another account."]); return
            }
            if binding["paused"] as? Bool == true {
                guard body["enroll"] as? Bool == true else {
                    sendSteps(["accountKey": scope, "blocked": true, "error": "Confirm this is your own iPhone to resume steps."]); return
                }
                var resumed = binding
                resumed["paused"] = false
                resumed["linkedAt"] = Date().timeIntervalSince1970
                resumed["baseline"] = max(0, min(200000, body["baselineSteps"] as? Int ?? 0))
                UserDefaults.standard.set(resumed, forKey: "LongevityStepSourceV1")
            }
        } else {
            guard body["enroll"] as? Bool == true else {
                sendSteps(["accountKey": scope, "blocked": true, "error": "Confirm this is your own iPhone before linking steps."]); return
            }
            let baseline = max(0, min(200000, body["baselineSteps"] as? Int ?? 0))
            UserDefaults.standard.set(["owner": scope, "sourceID": UUID().uuidString,
                "linkedAt": Date().timeIntervalSince1970, "baseline": baseline], forKey: "LongevityStepSourceV1")
        }
        guard let source = stepBinding?["sourceID"] as? String else { return }
        stepScope = scope
        sendSteps(["accountKey": scope, "kind": "linked", "sourceID": source])
        refreshSteps()
    }

    private func refreshSteps() {
        guard let scope = stepScope, let binding = stepBinding,
              binding["owner"] as? String == scope,
              let source = binding["sourceID"] as? String,
              let linkedStamp = binding["linkedAt"] as? Double else { return }
        let linkedAt = Date(timeIntervalSince1970: linkedStamp), baseline = binding["baseline"] as? Int ?? 0
        guard CMPedometer.isStepCountingAvailable() else {
            sendSteps(["accountKey": scope, "error": "Step counting is unavailable on this device."]); return
        }
        pedometer.stopUpdates()
        stepGeneration += 1
        let generation = stepGeneration
        let calendar = Calendar.current, today = calendar.startOfDay(for: Date())
        lastStepPublish = .distantPast
        // iOS retains recent motion history even when our app was closed.
        // Read absolute daily totals; never estimate steps from GPS distance.
        for offset in 0..<7 {
            guard let start = calendar.date(byAdding: .day, value: -offset, to: today),
                  let next = calendar.date(byAdding: .day, value: 1, to: start) else { continue }
            let end = min(next, Date()), from = max(start, linkedAt), day = stepDate(start)
            guard from < end else { continue } // Never read another carrier’s pre-link history.
            let prior = calendar.isDate(start, inSameDayAs: linkedAt) ? baseline : 0
            pedometer.queryPedometerData(from: from, to: end) { [weak self] data, error in
                Task { @MainActor in
                    guard let self, self.stepGeneration == generation, self.stepScope == scope else { return }
                    if let data {
                        self.sendSteps(["accountKey": scope, "sourceID": source, "date": day, "steps": prior + data.numberOfSteps.intValue])
                    } else if error != nil {
                        self.sendSteps(["accountKey": scope, "error": "Could not read steps. Allow Motion & Fitness for Longevity Simulator in iPhone Settings, then tap Refresh steps."])
                    }
                }
            }
        }
        pedometer.startUpdates(from: max(today, linkedAt)) { [weak self] data, error in
            Task { @MainActor in
                guard let self, self.stepGeneration == generation, self.stepScope == scope, let data else { return }
                if !calendar.isDate(today, inSameDayAs: Date()) { self.refreshSteps(); return }
                guard Date().timeIntervalSince(self.lastStepPublish) >= 10 else { return }
                self.lastStepPublish = Date()
                let prior = calendar.isDate(today, inSameDayAs: linkedAt) ? baseline : 0
                self.sendSteps(["accountKey": scope, "sourceID": source, "date": self.stepDate(today), "steps": prior + data.numberOfSteps.intValue])
            }
        }
    }

    private func armTimeout(_ id: Int) {
        guard var request = requests[id] else { return }
        request.timer?.cancel()
        let timer = DispatchWorkItem { [weak self] in self?.fail(id, code: 3, message: "GPS request timed out. Try outdoors with Precise Location enabled.") }
        request.timer = timer
        requests[id] = request
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0.1, request.timeout), execute: timer)
    }

    private func remove(_ id: Int) {
        requests[id]?.timer?.cancel()
        requests.removeValue(forKey: id)
        bufferedLocations.removeAll { $0["id"] as? Int == id }
        refreshTracking()
    }

    func stopAll() {
        liveRun.end()
        for request in requests.values { request.timer?.cancel() }
        requests.removeAll()
        bufferedLocations.removeAll()
        deliveryGeneration += 1
        flushingLocations = false
        manager.stopUpdatingLocation()
        backgroundSession?.invalidate()
        backgroundSession = nil
        UIApplication.shared.isIdleTimerDisabled = false
    }

    private func refreshTracking() {
        let authorized = manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways
        let watching = authorized && requests.values.contains(where: { $0.watch })
        // Start the native background assertion while foregrounded; it must not
        // depend on JavaScript running after iOS suspends the web process.
        if watching && backgroundSession == nil && UIApplication.shared.applicationState == .active {
            backgroundSession = CLBackgroundActivitySession()
        } else if !watching {
            backgroundSession?.invalidate()
            backgroundSession = nil
        }
        if !requests.isEmpty && authorized && (UIApplication.shared.applicationState != .background || requests.values.contains(where: { $0.watch })) { manager.startUpdatingLocation() }
        else { manager.stopUpdatingLocation() }
        UIApplication.shared.isIdleTimerDisabled = authorized && requests.values.contains(where: { $0.watch }) && UIApplication.shared.applicationState == .active
    }

    private func send(_ message: [String: Any]) {
        guard AppConfiguration.isWebsite(webView?.url), let data = try? JSONSerialization.data(withJSONObject: message),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.__longevityNative?.receive(\(json));", completionHandler: nil)
    }

    private func fail(_ id: Int, code: Int, message: String) {
        guard let request = requests[id] else { return }
        if !request.watch || code == 1 { remove(id) } else { armTimeout(id) }
        send(["id": id, "error": ["code": code, "message": message]])
    }

    var recordingDiagnostics: String {
        let permission: String
        switch manager.authorizationStatus {
        case .authorizedAlways: permission = "Always"
        case .authorizedWhenInUse: permission = "While Using"
        case .denied, .restricted: permission = "Denied"
        default: permission = "Not requested"
        }
        return "Recorder build 7\nLocation: \(permission)\nPrecise Location: \(manager.accuracyAuthorization == .fullAccuracy ? "on" : "off")\nBackground session: \(backgroundSession == nil ? "not active" : "active")\nBuffered GPS fixes: \(bufferedLocations.count)\n\(liveRun.diagnostics)"
    }

    func pageDidLoad() { publishPermission(); flushBufferedLocations() }

    private func publishPermission() {
        guard AppConfiguration.isWebsite(webView?.url) else { return }
        let status: String
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: status = "granted"
        case .denied, .restricted: status = "denied"
        default: status = "prompt"
        }
        webView?.evaluateJavaScript("window.__longevityNative?.permission('\(status)');", completionHandler: nil)
    }

    private func flushBufferedLocations() {
        guard !flushingLocations, !bufferedLocations.isEmpty,
              UIApplication.shared.applicationState == .active,
              AppConfiguration.isWebsite(webView?.url), let webView else { return }
        // Keep batches bounded so a long background run does not create one huge JS call.
        let batch = Array(bufferedLocations.prefix(200))
        guard let data = try? JSONSerialization.data(withJSONObject: batch),
              let json = String(data: data, encoding: .utf8) else { return }
        let hasMore = bufferedLocations.count > batch.count ? "true" : "false"
        let deliveredSequences = Set(batch.compactMap { $0["_sequence"] as? Int })
        flushingLocations = true
        let generation = deliveryGeneration
        webView.evaluateJavaScript("window.__longevityNative?.receiveBatch(\(json), \(hasMore));") { [weak self] result, error in
            Task { @MainActor in
                guard let self, self.deliveryGeneration == generation else { return }
                self.flushingLocations = false
                if error == nil, let acknowledged = result as? [Int], !acknowledged.isEmpty {
                    let accepted = deliveredSequences.intersection(acknowledged)
                    self.bufferedLocations.removeAll { packet in
                        guard let sequence = packet["_sequence"] as? Int else { return false }
                        return accepted.contains(sequence)
                    }
                    if !accepted.isEmpty { self.flushBufferedLocations() }
                }
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        publishPermission()
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
            for id in Array(requests.keys) { fail(id, code: 1, message: "Location permission denied. Enable it in iPhone Settings.") }
        }
        refreshTracking()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        liveRun.backgroundFixes(locations)
        for location in locations.sorted(by: { $0.timestamp < $1.timestamp }) {
            guard location.horizontalAccuracy >= 0, location.timestamp.timeIntervalSinceNow <= 5,
                  location.timestamp.timeIntervalSinceNow >= -86400 else { continue }
            let coords: [String: Any] = [
                "latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude,
                "accuracy": location.horizontalAccuracy,
                "altitude": location.verticalAccuracy >= 0 ? location.altitude as Any : NSNull(),
                "altitudeAccuracy": location.verticalAccuracy >= 0 ? location.verticalAccuracy as Any : NSNull(),
                "speed": location.speed >= 0 ? location.speed as Any : NSNull(),
                "heading": location.course >= 0 ? location.course as Any : NSNull()
            ]
            for (id, request) in Array(requests) {
                deliverySequence += 1
                let packet: [String: Any] = ["_sequence": deliverySequence, "id": id, "position": ["coords": coords, "timestamp": location.timestamp.timeIntervalSince1970 * 1000]]
                if !request.watch {
                    remove(id)
                    send(packet)
                } else {
                    armTimeout(id)
                    bufferedLocations.append(packet)
                    if bufferedLocations.count > 10000 { bufferedLocations.removeFirst(bufferedLocations.count - 10000) }
                }
            }
        }
        flushBufferedLocations()
        refreshTracking()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        let denied = (error as? CLError)?.code == .denied
        for id in Array(requests.keys) { fail(id, code: denied ? 1 : 2, message: denied ? "Location permission denied." : "GPS could not obtain a location. Try outdoors.") }
    }
}
