import Combine
import SwiftUI

struct Workout: Identifiable, Codable {
    var id = UUID()
    var date = Date()
    var activity: String
    var minutes: Double
    var meters: Double = 0
    var route: [RoutePoint] = []
}
struct RoutePoint: Codable {
    var latitude: Double
    var longitude: Double
}
struct SleepNight: Identifiable, Codable {
    var id = UUID()
    var bedtime: Date
    var wake: Date
    var hours: Double { wake.timeIntervalSince(bedtime) / 3600 }
}
struct PlanTask: Identifiable, Codable {
    var id = UUID()
    var date: Date
    var title: String
    var done = false
}
struct SavedData: Codable {
    var workouts: [Workout] = []
    var nights: [SleepNight] = []
    var tasks: [PlanTask] = []
}

@MainActor final class AppStore: ObservableObject {
    @Published var data = SavedData()
    @Published var storageError: String?
    private var loaded = false
    private let file: URL
    init() {
        file = URL.documentsDirectory.appending(path: "longevity-data.json")
        do {
            if FileManager.default.fileExists(atPath: file.path) {
                data = try JSONDecoder().decode(SavedData.self, from: Data(contentsOf: file))
            }
            loaded = true
        } catch {
            storageError = "Could not read saved data. It has been kept intact. \(error.localizedDescription)"
        }
    }
    func save() {
        guard loaded else { return }
        do { try JSONEncoder().encode(data).write(to: file, options: .atomic) }
        catch { storageError = "Could not save: \(error.localizedDescription)" }
    }
    func adopt(_ titles: [String]) {
        let today = Calendar.current.startOfDay(for: Date())
        data.tasks += titles.enumerated().map { index, title in
            PlanTask(date: Calendar.current.date(byAdding: .day, value: index, to: today)!, title: title)
        }
        save()
    }
}
