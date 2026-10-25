import Foundation
import ActivityKit
import CoreLocation
import UIKit
import UserNotifications

// Web snapshots are authoritative in the foreground. Native location updates
// keep approximate live stats current while WebKit is asleep; finished routes
// are still filtered and saved by the web recorder after buffered fixes arrive.
@MainActor
final class RunLiveActivityController {
    private var activity: Activity<RunActivityAttributes>?
    private var runID = ""
    private var phase = "idle"
    private var mode = "run"
    private var elapsed = 0.0
    private var receivedAt = Date()
    private var distance = 0.0
    private var ascent: Double?
    private var calories: Double?
    private var weight = 0.0
    private var lastLocation: CLLocation?
    private var lastPublished = Date.distantPast
    private var lastPhase = ""
    private var lastNotification = Date.distantPast
    private var fallbackRequested = false
    private var activityStatus = "Not started"
    private let widgetInstalled: Bool = {
        guard let plugins = Bundle.main.builtInPlugInsURL,
              let files = try? FileManager.default.contentsOfDirectory(at: plugins, includingPropertiesForKeys: nil) else { return false }
        return files.contains { $0.lastPathComponent == "RunActivityWidget.appex" }
    }()
    var diagnostics: String {
        "Run widget: \(widgetInstalled ? "installed" : "missing — install the full updated Xcode project")\nLive Activities: \(ActivityAuthorizationInfo().areActivitiesEnabled ? "allowed" : "disabled in Settings")\nRun status: \(activityStatus)"
    }
    func enteringBackground() { publish(force: true) }

    private func number(_ value: Any?, max: Double) -> Double? {
        guard let value = value as? Double, value.isFinite, value >= 0, value <= max else { return nil }
        return value
    }
    func receive(_ body: [String: Any]) {
        guard let nextPhase = body["phase"] as? String, ["idle", "acquiring", "recording", "paused", "finished"].contains(nextPhase) else { return }
        if nextPhase == "idle" || nextPhase == "finished" { end(); return }
        guard let id = body["runID"] as? String, !id.isEmpty, id.count <= 100,
              let seconds = number(body["elapsed"], max: 86400),
              let meters = number(body["distanceMeters"], max: 1000000) else { return }
        if id != runID { end(); runID = id; lastLocation = nil }
        phase = nextPhase
        mode = body["mode"] as? String == "walk" ? "walk" : "run"
        elapsed = seconds
        distance = meters
        ascent = number(body["ascentMeters"], max: 100000)
        calories = number(body["calories"], max: 100000)
        weight = number(body["weight"], max: 300) ?? 0
        receivedAt = Date()
        if let point = body["lastPoint"] as? [String: Any], let lat = point["lat"] as? Double, let lon = point["lon"] as? Double,
           abs(lat) <= 90, abs(lon) <= 180, let stamp = point["timestamp"] as? Double {
            lastLocation = CLLocation(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lon), altitude: point["ele"] as? Double ?? 0,
                horizontalAccuracy: point["accuracy"] as? Double ?? 25, verticalAccuracy: point["ele"] is Double ? 5 : -1,
                timestamp: Date(timeIntervalSince1970: stamp / 1000))
        }
        publish(force: lastPhase != phase)
    }
    private var currentElapsed: Double { elapsed + (phase == "recording" ? max(0, Date().timeIntervalSince(receivedAt)) : 0) }
    func backgroundFixes(_ locations: [CLLocation]) {
        guard phase == "recording", UIApplication.shared.applicationState != .active else { return }
        for fix in locations.sorted(by: { $0.timestamp < $1.timestamp }) {
            guard fix.horizontalAccuracy >= 0, fix.horizontalAccuracy <= 25, abs(fix.timestamp.timeIntervalSinceNow) <= 30 else { continue }
            if let previous = lastLocation {
                let seconds = fix.timestamp.timeIntervalSince(previous.timestamp)
                guard seconds > 0 else { continue }
                let meters = fix.distance(from: previous)
                if seconds <= 10, meters / seconds <= (mode == "walk" ? 6 : 12) {
                    guard meters >= max(4, min(25, (fix.horizontalAccuracy + previous.horizontalAccuracy) / 2)) else { continue }
                    distance += meters
                    if previous.verticalAccuracy >= 0, fix.verticalAccuracy >= 0, fix.verticalAccuracy <= 30 {
                        let gain = fix.altitude - previous.altitude
                        if gain >= 3, meters > 0, gain / meters <= 0.3 { ascent = (ascent ?? 0) + gain }
                    }
                }
            }
            lastLocation = fix
        }
        if weight >= 30 {
            calories = ((mode == "walk" ? 0.1 : 0.2) * distance + 3.5 * currentElapsed / 60 + (mode == "walk" ? 1.8 : 0.9) * (ascent ?? 0)) * weight / 1000 * 5
        }
        publish(force: false)
    }
    private func publish(force: Bool) {
        guard phase == "recording" || phase == "paused" else { return }
        guard force || Date().timeIntervalSince(lastPublished) >= 8 else { return }
        lastPublished = Date()
        lastPhase = phase
        let seconds = currentElapsed
        let state = RunActivityAttributes.ContentState(phase: phase, elapsed: seconds,
            timerStartedAt: phase == "recording" ? Date().addingTimeInterval(-seconds) : nil,
            distanceMeters: distance, calories: calories, ascentMeters: ascent)
        guard widgetInstalled, ActivityAuthorizationInfo().areActivitiesEnabled else {
            activityStatus = widgetInstalled ? "Live Activities disabled; using notification" : "Widget missing; using notification"
            requestNotificationFallbackIfNeeded()
            fallbackNotification(state); return
        }
        if let current = activity, current.activityState == .ended || current.activityState == .dismissed { activity = nil }
        if activity == nil { activity = Activity<RunActivityAttributes>.activities.first(where: { $0.attributes.runID == runID }) }
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(120))
        if let activity { Task { await activity.update(content) } }
        else if phase == "recording", UIApplication.shared.applicationState == .active {
            do {
                activity = try Activity.request(attributes: RunActivityAttributes(runID: runID, mode: mode), content: content, pushType: nil)
                activityStatus = "Live Activity running"
            } catch {
                activityStatus = "Live Activity unavailable: \(error.localizedDescription)"
                requestNotificationFallbackIfNeeded()
                fallbackNotification(state)
            }
        }
        if activity == nil { fallbackNotification(state) }
    }
    private func fallbackNotification(_ state: RunActivityAttributes.ContentState) {
        guard UIApplication.shared.applicationState != .active, Date().timeIntervalSince(lastNotification) >= 60 else { return }
        lastNotification = Date()
        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        content.title = state.phase == "paused" ? "Run paused" : "Run in progress"
        content.body = String(format: "%02d:%02d · %.2f km", Int(state.elapsed) / 60, Int(state.elapsed) % 60, state.distanceMeters / 1000)
        content.threadIdentifier = "longevity-active-run"
        center.getNotificationSettings { settings in
            if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                center.add(UNNotificationRequest(identifier: "longevity-active-run", content: content, trigger: nil))
            }
        }
    }
    func requestNotificationFallbackIfNeeded() {
        if !fallbackRequested, UIApplication.shared.applicationState == .active {
            fallbackRequested = true
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert]) { _, _ in }
        }
    }
    func end() {
        let existing = Activity<RunActivityAttributes>.activities
        for item in existing { Task { await item.end(nil, dismissalPolicy: .immediate) } }
        activity = nil
        activityStatus = "Not started"
        lastPublished = .distantPast
        lastNotification = .distantPast
        phase = "idle"
        lastPhase = ""
        runID = ""
        lastLocation = nil
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ["longevity-active-run"])
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["longevity-active-run"])
    }
}
