import Foundation
import ActivityKit

struct RunActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String
        var elapsed: Double
        var timerStartedAt: Date?
        var distanceMeters: Double
        var calories: Double?
        var ascentMeters: Double?
    }
    var runID: String
    var mode: String
}
