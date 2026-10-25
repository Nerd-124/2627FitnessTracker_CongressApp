import ActivityKit
import WidgetKit
import SwiftUI
import Foundation

private struct RunTimer: View {
    let state: RunActivityAttributes.ContentState
    var body: some View {
        if state.phase == "recording", let start = state.timerStartedAt {
            Text(timerInterval: start...start.addingTimeInterval(86400), countsDown: false).monospacedDigit()
        } else {
            Text(String(format: "%02d:%02d", Int(state.elapsed) / 60, Int(state.elapsed) % 60)).monospacedDigit()
        }
    }
}

struct RunLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RunActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label(context.state.phase == "paused" ? "Run paused" : "Run in progress", systemImage: "figure.run")
                    Spacer()
                    RunTimer(state: context.state).font(.title2.bold())
                }
                HStack {
                    Label(String(format: "%.2f km", context.state.distanceMeters / 1000), systemImage: "location.fill")
                    Spacer()
                    Text(context.state.calories.map { "\(Int($0)) kcal" } ?? "kcal —")
                    Spacer()
                    Text(context.state.ascentMeters.map { "↑ \(Int($0)) m" } ?? "ascent —")
                }.font(.subheadline.monospacedDigit())
                if context.isStale { Text("Open the app to check GPS.").font(.caption) }
            }
            .padding(16)
            .foregroundStyle(Color(red: 0.13, green: 0.24, blue: 0.20))
            .activityBackgroundTint(Color(red: 0.91, green: 0.95, blue: 0.88))
            .activitySystemActionForegroundColor(.primary)
            .widgetURL(URL(string: "longevitylive://run"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Label("Run", systemImage: "figure.run").foregroundStyle(.green) }
                DynamicIslandExpandedRegion(.trailing) { Text(String(format: "%.2f km", context.state.distanceMeters / 1000)).monospacedDigit() }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        RunTimer(state: context.state).font(.title2.bold())
                        Spacer()
                        Text(context.state.phase == "paused" ? "Paused" : context.isStale ? "Check GPS" : "Running")
                        Text(context.state.calories.map { "\(Int($0)) kcal" } ?? "— kcal")
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.run").foregroundStyle(.green)
            } compactTrailing: {
                RunTimer(state: context.state).font(.caption.monospacedDigit()).frame(maxWidth: 58)
            } minimal: {
                Image(systemName: "figure.run").foregroundStyle(.green)
            }
            .widgetURL(URL(string: "longevitylive://run"))
            .keylineTint(.green)
        }
    }
}

@main
struct LongevityRunWidgets: WidgetBundle {
    var body: some Widget { RunLiveActivityWidget() }
}
