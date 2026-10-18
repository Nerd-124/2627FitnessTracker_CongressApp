import SwiftUI

struct ChatMessage: Identifiable {
    let id = UUID()
    let text: String
    let user: Bool
}
struct CoachView: View {
    @EnvironmentObject var store: AppStore
    @AppStorage("userGoal") private var goal = ""
    @State private var input = ""
    @State private var messages = [ChatMessage(text: "What would you like to accomplish? Tell me your goal, then choose a time budget below. I can offer three editable weekly plans.", user: false)]
    @State private var budget = 15
    @State private var options: [[String]] = []
    @State private var adopted: Set<Int> = []
    private let names = ["Start small", "Build a routine", "Add variety"]
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Free built-in planner · rules, not an AI model").font(.caption)
                    Text("No API key or subscription. Suggestions are general templates; the planner understands a few activity keywords. Your messages stay in this app session.").font(.caption).foregroundStyle(.secondary)
                }
                Section("Chat") {
                    ForEach(messages) { message in
                        VStack(alignment: .leading) {
                            Text(message.user ? "You" : "Coach").font(.caption.bold())
                            Text(message.text)
                        }
                    }
                    TextField("I want to feel more motivated…", text: $input, axis: .vertical)
                    Stepper("Up to \(budget) minutes per day", value: $budget, in: 5...60, step: 5)
                    Button("Send & suggest plans") { respond() }.disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                ForEach(options.indices, id: \.self) { index in
                    Section(names[index]) {
                        ForEach(Array(options[index].enumerated()), id: \.offset) { day, text in
                            Text("Day \(day + 1): \(text)")
                        }
                        Button(adopted.contains(index) ? "Added to Today" : "Choose this week") {
                            store.adopt(options[index]); adopted.insert(index)
                            messages.append(ChatMessage(text: "Added your week starting today. Edit tasks or dates on Today whenever you want.", user: false))
                        }.disabled(!adopted.isEmpty)
                    }
                }
                if !options.isEmpty {
                    Text("Changing your time budget? Send another message to generate new options. Choosing another week adds tasks; it does not replace tasks already saved.").font(.caption)
                }
            }.navigationTitle("Coach")
        }
    }
    private func respond() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        messages.append(ChatMessage(text: text, user: true)); input = ""
        let lower = text.lowercased()
        if ["pain", "injur", "dizz", "faint", "chest"].contains(where: { lower.contains($0) }) {
            options = []
            messages.append(ChatMessage(text: "I cannot tailor workouts for symptoms or injuries. Stop activity if you feel unwell and ask a qualified clinician for advice before planning exercise.", user: false)); return
        }
        let activity: String
        if lower.contains("swim") { activity = "Easy swimming" }
        else if lower.contains("basketball") { activity = "Relaxed basketball practice" }
        else if lower.contains("strength") { activity = "Comfortable bodyweight strength practice" }
        else if lower.contains("cycl") || lower.contains("bike") { activity = "Easy cycling" }
        else { activity = "Comfortable walking" }
        let short = max(5, budget / 2)
        options = [
            ["\(activity), \(short) min", "Recovery day", "\(activity), \(short) min", "Recovery day", "\(activity), \(short) min", "Gentle mobility, 5 min", "Reflect on what felt manageable"],
            ["\(activity), \(budget) min", "Gentle mobility, \(short) min", "\(activity), \(budget) min", "Recovery day", "\(activity), \(budget) min", "Gentle mobility, \(short) min", "Reflect and adjust next week"],
            ["\(activity), \(short) min", "Easy dancing, \(short) min", "Recovery day", "Gentle mobility, \(short) min", "\(activity), \(short) min", "An enjoyable activity, \(short) min", "Reflect and rest"]
        ]
        adopted = []
        messages.append(ChatMessage(text: "Here are three general options using \(activity.lowercased()) with a maximum of \(budget) minutes on activity days. They are not a personalized medical prescription. Choose one to save it, then edit the tasks on Today.", user: false))
    }
}
