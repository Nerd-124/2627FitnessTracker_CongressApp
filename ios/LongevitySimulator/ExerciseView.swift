import SwiftUI
import MapKit

struct ExerciseView: View {
    @EnvironmentObject var store: AppStore
    @Environment(\.scenePhase) private var phase
    @StateObject private var tracker = RunTracker()
    @State private var activity = ""
    @State private var minutes = 30.0
    @State private var date = Date()
    @State private var camera: MapCameraPosition = .automatic
    var body: some View {
        NavigationStack {
            Form {
                Section("Run tracker") {
                    Text(Duration.seconds(tracker.seconds).formatted(.time(pattern: .hourMinuteSecond))).font(.largeTitle.monospacedDigit())
                    Text("\(tracker.meters / 1000, specifier: "%.2f") km")
                    Map(position: $camera) {
                        if let fix = tracker.location {
                            Annotation("You", coordinate: fix.coordinate) { Image(systemName: "location.circle.fill").font(.title).foregroundStyle(.green) }
                        }
                        if tracker.points.count > 1 {
                        MapPolyline(coordinates: tracker.points.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }).stroke(.green, lineWidth: 4)
                        }
                    }.frame(height: 240)
                    .onChange(of: tracker.points.count) { _, _ in
                        if let fix = tracker.location {
                            camera = .region(MKCoordinateRegion(center: fix.coordinate, latitudinalMeters: 800, longitudinalMeters: 800))
                        }
                    }
                    Text(tracker.status).font(.caption).foregroundStyle(.secondary)
                    if tracker.recording {
                        HStack {
                            Button(tracker.paused ? "Resume" : "Pause") { tracker.togglePause() }.buttonStyle(.bordered)
                            Button("Finish & save") {
                                tracker.stop()
                                store.data.workouts.append(Workout(activity: "Running", minutes: tracker.seconds / 60, meters: tracker.meters, route: tracker.points))
                                store.save()
                            }.buttonStyle(.borderedProminent)
                        }
                    } else {
                        Button("Start run") { tracker.start() }.buttonStyle(.borderedProminent)
                    }
                    Text("Keep the app open while running. Leaving the app pauses this version automatically. GPS needs testing outdoors on your iPhone; simulator locations are simulated.").font(.caption)
                }
                Section("Log another activity") {
                    TextField("Swimming, basketball, anything…", text: $activity)
                    DatePicker("When", selection: $date, in: ...Date(), displayedComponents: .date)
                    Stepper("\(Int(minutes)) minutes", value: $minutes, in: 1...600, step: 1)
                    Button("Save activity") {
                        store.data.workouts.append(Workout(date: date, activity: activity.trimmingCharacters(in: .whitespacesAndNewlines), minutes: minutes))
                        store.save(); activity = ""
                    }.disabled(activity.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section("History · swipe to delete") {
                    ForEach(store.data.workouts.sorted { $0.date > $1.date }) { workout in
                        VStack(alignment: .leading) {
                            Text(workout.activity).font(.headline)
                            Text("\(workout.date.formatted(date: .abbreviated, time: .omitted)) · \(Int(workout.minutes)) min")
                            if workout.meters > 0 { Text("\(workout.meters / 1000, specifier: "%.2f") km") }
                        }.swipeActions {
                            Button("Delete", role: .destructive) { store.data.workouts.removeAll { $0.id == workout.id }; store.save() }
                        }
                    }
                }
            }.navigationTitle("Exercise")
            .onChange(of: phase) { _, value in
                if value != .active && tracker.recording && !tracker.paused { tracker.togglePause() }
            }
            .onDisappear { if tracker.recording && !tracker.paused { tracker.togglePause() } }
        }
    }
}
