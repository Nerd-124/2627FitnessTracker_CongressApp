import SwiftUI

struct ContentView: View {
    @StateObject private var store = AppStore()
    @AppStorage("profileComplete") private var complete = false
    @AppStorage("userName") private var name = ""
    @AppStorage("userGoal") private var goal = ""
    var body: some View {
        Group {
            if complete {
                TabView {
                    TodayView().tabItem { Label("Today", systemImage: "sun.max") }
                    ExerciseView().tabItem { Label("Exercise", systemImage: "figure.run") }
                    SleepView().tabItem { Label("Sleep", systemImage: "moon") }
                    SimulationView().tabItem { Label("Explore", systemImage: "leaf") }
                    CoachView().tabItem { Label("Coach", systemImage: "bubble.left.and.bubble.right") }
                }
            } else {
                NavigationStack {
                    Form {
                        Section { Text("Your healthier future starts here.").font(.title2.bold()) }
                        Section("What should we call you?") { TextField("Your name", text: $name) }
                        Section("Your goal") { TextField("Feel fitter, build a routine…", text: $goal, axis: .vertical) }
                        Button("Get started") {
                            name = name.trimmingCharacters(in: .whitespacesAndNewlines)
                            goal = goal.trimmingCharacters(in: .whitespacesAndNewlines)
                            complete = true
                        }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }.navigationTitle("Longevity Simulator")
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
                        Form {
                            TextField("Name", text: $name)
                            TextField("Goal", text: $goal, axis: .vertical)
                        }.navigationTitle("Your profile").toolbar { Button("Done") { editing = false } }
                    }
                }
        }
    }
}
