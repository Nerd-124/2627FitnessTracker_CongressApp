import SwiftUI

struct ContentView: View {
    @StateObject private var store = AppStore()
    @AppStorage("profileComplete") private var complete = false
    @AppStorage("profileSetupVersion") private var profileSetupVersion = 0
    @AppStorage("userName") private var name = ""
    @AppStorage("userGoal") private var goal = ""
    var body: some View {
        Group {
            if complete && profileSetupVersion >= 1 {
                TabView {
                    TodayView().tabItem { Label("Today", systemImage: "sun.max") }
                    ExerciseView().tabItem { Label("Exercise", systemImage: "figure.run") }
                    SleepView().tabItem { Label("Sleep", systemImage: "moon") }
                    SimulationView().tabItem { Label("Explore", systemImage: "leaf") }
                    CoachView().tabItem { Label("Coach", systemImage: "bubble.left.and.bubble.right") }
                }
            } else {
                NavigationStack {
                    ProfileSetupView(isOnboarding: true)
                }
            }
        }
        .environmentObject(store).tint(Color(red: 0.19, green: 0.37, blue: 0.27))
        .alert("Storage", isPresented: Binding(get: { store.storageError != nil }, set: { if !$0 { store.storageError = nil } })) {
            Button("OK") { store.storageError = nil }
        } message: { Text(store.storageError ?? "") }
    }
}

struct TodayView: View {
    @EnvironmentObject var store: AppStore
    @AppStorage("userName") private var name = ""
    @AppStorage("userGoal") private var goal = ""
    @AppStorage("exerciseTargetMinutes") private var exerciseTarget = 150
    @AppStorage("exerciseTargetPeriod") private var exercisePeriod = "Weekly"
    @AppStorage("sleepTargetHours") private var sleepTarget = 8.0
    @State private var editing = false
    @State private var newTask = ""
    @State private var taskDate = Date()
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Welcome, \(name).").font(.title2.bold())
                    Text(goal).foregroundStyle(.secondary)
                    let minutes = store.data.workouts.filter { Calendar.current.isDateInToday($0.date) }.reduce(0) { $0 + $1.minutes }
                    Text("\(minutes, specifier: "%.0f") minutes of activity recorded today")
                }
                Section("Your targets") {
                    Text("Exercise: \(exerciseTarget) min / \(exercisePeriod == "Daily" ? "day" : "week")")
                    Text("Sleep: \(sleepTarget, specifier: "%.1f") hours / night")
                    let interval = exercisePeriod == "Daily"
                        ? Calendar.current.dateInterval(of: .day, for: Date())
                        : Calendar.current.dateInterval(of: .weekOfYear, for: Date())
                    let total = store.data.workouts.filter { interval?.contains($0.date) == true }.reduce(0) { $0 + $1.minutes }
                    if exerciseTarget > 0 {
                        ProgressView(value: min(total, Double(exerciseTarget)), total: Double(exerciseTarget))
                        Text("\(Int(total)) of \(exerciseTarget) minutes recorded this \(exercisePeriod == "Daily" ? "day" : "week")").font(.caption)
                    }
                    Text("Targets are your choices, not exercise or medical recommendations.").font(.caption).foregroundStyle(.secondary)
                }
                Section("Today's plan") {
                    ForEach($store.data.tasks) { $task in
                        if Calendar.current.isDateInToday(task.date) {
                            Toggle(task.title, isOn: $task.done).onChange(of: task.done) { _, _ in store.save() }
                        }
                    }
                    if !store.data.tasks.contains(where: { Calendar.current.isDateInToday($0.date) }) {
                        Text("Ask Coach for ideas, or add your own task below.").foregroundStyle(.secondary)
                    }
                }
                Section("Add your own") {
                    TextField("What would you like to do?", text: $newTask)
                    DatePicker("Date", selection: $taskDate, displayedComponents: .date)
                    Button("Add task") {
                        store.data.tasks.append(PlanTask(date: taskDate, title: newTask.trimmingCharacters(in: .whitespacesAndNewlines)))
                        store.save(); newTask = ""
                    }.disabled(newTask.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                Section("All planned tasks · tap to edit, swipe to delete") {
                    ForEach($store.data.tasks) { $task in
                        VStack(alignment: .leading) {
                            TextField("Task", text: $task.title).onSubmit { store.save() }
                            DatePicker("Date", selection: $task.date, displayedComponents: .date)
                                .onChange(of: task.date) { _, _ in store.save() }
                        }
                    }.onDelete { store.data.tasks.remove(atOffsets: $0); store.save() }
                }
            }.navigationTitle("Today")
                .toolbar { Button("Profile") { editing = true } }
                .onDisappear { store.save() }
                .sheet(isPresented: $editing) {
                    NavigationStack {
                        ProfileSetupView(isOnboarding: false) { editing = false }
                    }
                }
        }
    }
}


// Draft fields keep Cancel from changing the saved profile.
struct ProfileSetupView: View {
    let isOnboarding: Bool
    var onSave: () -> Void = {}
    @Environment(\.dismiss) private var dismiss
    @AppStorage("profileComplete") private var complete = false
    @AppStorage("profileSetupVersion") private var setupVersion = 0
    @AppStorage("userName") private var savedName = ""
    @AppStorage("userGoal") private var savedGoal = ""
    @AppStorage("exerciseTargetMinutes") private var savedMinutes = 150
    @AppStorage("exerciseTargetPeriod") private var savedPeriod = "Weekly"
    @AppStorage("sleepTargetHours") private var savedSleep = 8.0
    @State private var name = ""
    @State private var goal = ""
    @State private var minutes = 150
    @State private var period = "Weekly"
    @State private var sleep = 8.0
    @State private var didLoad = false
    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    var body: some View {
        Form {
            Section {
                Text("Build a routine that fits you.").font(.title2.bold())
                Text("Choose your targets and describe what you want to accomplish. You can change everything later from Profile.")
            }
            Section("Your name") {
                TextField("What should we call you?", text: $name).textContentType(.givenName)
            }
            Section("Exercise target") {
                Picker("Track time", selection: $period) {
                    Text("Daily").tag("Daily")
                    Text("Weekly").tag("Weekly")
                }.pickerStyle(.segmented)
                Stepper("\(minutes) minutes per \(period == "Daily" ? "day" : "week")", value: $minutes, in: 0...(period == "Daily" ? 600 : 4200), step: 5)
                Text("This is your total time target, not a requirement to exercise every day. Zero is allowed for a rest or recovery period.").font(.caption)
            }
            Section("Sleep target") {
                Stepper("\(sleep, specifier: "%.1f") hours per night", value: $sleep, in: 3...14, step: 0.5)
                Text("Choose a target appropriate for you; sleep needs vary by age and circumstances.").font(.caption)
            }
            Section("What would you like to accomplish?") {
                TextField("Feel more motivated, improve stamina, build a routine…", text: $goal, axis: .vertical).lineLimit(3...6)
            }
            Section {
                Button(isOnboarding ? "Save & get started" : "Save changes") {
                    savedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    savedGoal = goal.trimmingCharacters(in: .whitespacesAndNewlines)
                    savedMinutes = minutes; savedPeriod = period; savedSleep = sleep
                    setupVersion = 1; complete = true; onSave()
                }.disabled(!valid)
            }
        }
        .navigationTitle(isOnboarding ? "Your routine" : "Your profile")
        .toolbar {
            if !isOnboarding { Button("Cancel") { dismiss() } }
        }
        .onAppear {
            guard !didLoad else { return }
            name = savedName; goal = savedGoal; minutes = savedMinutes
            period = savedPeriod; sleep = savedSleep
            Task { @MainActor in didLoad = true }
        }
        .onChange(of: period) { _, new in
            guard didLoad else { return }
            // Preserve the approximate weekly amount when changing units.
            if new == "Daily" { minutes = min(600, Int((Double(minutes) / 7 / 5).rounded()) * 5) }
            else { minutes = min(4200, minutes * 7) }
        }
    }
}
