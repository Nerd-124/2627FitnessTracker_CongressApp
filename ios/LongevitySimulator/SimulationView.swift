import SwiftUI
import Charts

struct SimulationView: View {
    @AppStorage("scenarioExercise") private var exercise = 150.0
    @AppStorage("scenarioSleep") private var sleep = 8.0
    @AppStorage("scenarioPlants") private var plants = 5.0
    private var score: Double {
        0.40 * min(exercise / 150, 1) * 100 + 0.35 * max(0, 100 - abs(sleep - 8) * 22) + 0.25 * min(plants / 5, 1) * 100
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Explore a habit scenario") {
                    Text("Change these habits to explore the same illustrative model as the web app. These are scenario settings, separate from your activity and sleep records.")
                    Text("Movement: \(Int(exercise)) min/week")
                    Slider(value: $exercise, in: 0...600, step: 10)
                    Text("Sleep: \(sleep, specifier: "%.1f") hours/night")
                    Slider(value: $sleep, in: 3...12, step: 0.5)
                    Text("Plant food servings: \(Int(plants))/day")
                    Slider(value: $plants, in: 0...10, step: 1)
                }
                Section("Illustrative habit score") {
                    Text("\(Int(score.rounded())) / 100").font(.largeTitle.bold())
                    Chart(Array(stride(from: 0, through: 30, by: 5)), id: \.self) { year in
                        LineMark(x: .value("Illustrative year", year), y: .value("Illustrative score", 65 + (score - 65) * (1 - exp(-Double(year) / 10))))
                    }.chartYScale(domain: 0...100).frame(height: 200)
                    Text("This is an educational illustration, not a lifespan forecast, biological age, or disease prediction. The score weights and curve are invented for demonstration. Adult reference values are used; individual needs vary.").font(.caption)
                }
            }.navigationTitle("Longevity Simulator")
        }
    }
}
