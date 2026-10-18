import Combine
import Foundation
import CoreLocation

@MainActor final class RunTracker: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var recording = false
    @Published var paused = false
    @Published var seconds: TimeInterval = 0
    @Published var meters = 0.0
    @Published var points: [RoutePoint] = []
    @Published var status = "Start outdoors for accurate GPS. Time starts immediately; distance waits for a precise fix."
    @Published var location: CLLocation?
    private let manager = CLLocationManager()
    private var timer: Timer?
    private var anchor: TimeInterval = 0
    private var accrued: TimeInterval = 0
    private var previous: CLLocation?
    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.activityType = .fitness
        manager.distanceFilter = kCLDistanceFilterNone
    }
    func start() {
        guard !recording else { return }
        guard CLLocationManager.locationServicesEnabled() else { status = "Enable Location Services in iPhone Settings."; return }
        guard manager.authorizationStatus != .denied && manager.authorizationStatus != .restricted else {
            status = "Allow location in Settings → Privacy & Security → Location Services for this app."; return
        }
        recording = true; paused = false; seconds = 0; meters = 0; points = []
        previous = nil; accrued = 0; anchor = ProcessInfo.processInfo.systemUptime
        status = "Timer running. Waiting for accurate GPS…"
        if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
        manager.startUpdatingLocation()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }
    private func tick() {
        if recording && !paused { seconds = accrued + ProcessInfo.processInfo.systemUptime - anchor }
    }
    func togglePause() {
        guard recording else { return }
        if paused {
            anchor = ProcessInfo.processInfo.systemUptime; paused = false
            previous = nil; status = "Resumed. Waiting for a fresh GPS fix…"; manager.startUpdatingLocation()
        } else {
            tick(); accrued = seconds; paused = true; previous = nil
            manager.stopUpdatingLocation(); status = "Paused"
        }
    }
    func stop() {
        tick(); recording = false; manager.stopUpdatingLocation(); timer?.invalidate(); timer = nil
        previous = nil; status = "Session finished"
    }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            if recording && !paused { manager.startUpdatingLocation() }
        } else if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
            if recording { stop() }
            status = "Location permission denied. Enable it in iPhone Settings."
        }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard recording && !paused else { return }
        for fix in locations {
            guard abs(fix.timestamp.timeIntervalSinceNow) < 10, fix.horizontalAccuracy >= 0 else { continue }
            location = fix
            guard fix.horizontalAccuracy <= 25 else {
                status = "GPS accuracy ±\(Int(fix.horizontalAccuracy)) m. Waiting for 25 m or better; timer continues."
                continue
            }
            if let old = previous {
                let dt = fix.timestamp.timeIntervalSince(old.timestamp)
                guard dt > 0 else { continue }
                if dt > 20 { previous = nil }
                else {
                    let distance = fix.distance(from: old)
                    guard distance / dt <= 10 else { status = "Ignored an implausible GPS jump."; continue }
                    guard distance >= max(5, (old.horizontalAccuracy + fix.horizontalAccuracy) * 0.5) else { continue }
                    meters += distance
                }
            }
            previous = fix
            points.append(RoutePoint(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude))
            status = "GPS connected · accuracy ±\(Int(fix.horizontalAccuracy)) m"
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        status = "GPS unavailable: \(error.localizedDescription). Timer continues; try an open outdoor area."
    }
}
