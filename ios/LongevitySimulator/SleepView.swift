import SwiftUI
import Charts

struct SleepView: View {
    @EnvironmentObject var store: AppStore
    @State private var bedtime = Date().addingTimeInterval(-8 * 3600)
    @State private var wake = Date()
    var body: some View {
        NavigationStack {
            Form {
                Section("Record a night") {
                    DatePicker("Bedtime", selection: $bedtime, in: ...Date())
                    DatePicker("Wake-up", selection: $wake, in: ...Date())
                    let hours = wake.timeIntervalSince(bedtime) / 3600
                    Text("\(hours, specifier: "%.1f") hours")
                    Button("Save night") {
                        // One entry per wake-up day. Editing that day's entry replaces it.
                        store.data.nights.removeAll { Calendar.current.isDate($0.wake, inSameDayAs: wake) }
                        store.data.nights.append(SleepNight(bedtime: bedtime, wake: wake)); store.save()
                    }.disabled(hours <= 0 || hours > 24)
                    Text("Use actual dates for overnight sleep. A saved night replaces any entry with the same wake-up date.").font(.caption)
                }
                Section("Recent sleep") {
                    Chart(store.data.nights.sorted { $0.wake < $1.wake }.suffix(30)) { night in
                        BarMark(x: .value("Wake-up date", night.wake, unit: .day), y: .value("Hours", night.hours)).foregroundStyle(.green)
                    }.frame(height: 180)
                    ForEach(store.data.nights.sorted { $0.wake > $1.wake }) { night in
                        Button {
                            bedtime = night.bedtime; wake = night.wake
                        } label: {
                            HStack {
                                Text(night.wake.formatted(date: .abbreviated, time: .omitted))
                                Spacer(); Text("\(night.hours, specifier: "%.1f") h")
                            }
                        }.swipeActions {
                            Button("Delete", role: .destructive) { store.data.nights.removeAll { $0.id == night.id }; store.save() }
                        }
                    }
                }
                Section {
                    Text("Sleep is entered manually. This app does not measure brainwaves or infer sleep stages. EEG import from the web edition has not been ported yet.").font(.caption).foregroundStyle(.secondary)
                }
            }.navigationTitle("Sleep")
        }
    }
}
