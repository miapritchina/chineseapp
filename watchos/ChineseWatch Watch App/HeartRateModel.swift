import Foundation
import HealthKit

// MARK: - Experimental — not part of the learning flow.
//
// Polls HealthKit for the most recent heart-rate sample every 10 seconds
// while the app is in the foreground. This is a toy: it reads whatever the
// watch has already recorded, it does not start a workout session. On the
// Simulator there is no sensor data, so the reading stays "--"; real values
// appear only on a physical Apple Watch.
@MainActor
final class HeartRateModel: ObservableObject {
    @Published private(set) var bpm: Int?

    private let store = HKHealthStore()
    private let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
    private let bpmUnit = HKUnit.count().unitDivided(by: .minute())
    private var timer: Timer?

    func start() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        store.requestAuthorization(toShare: [], read: [hrType]) { [weak self] granted, _ in
            guard granted else { return }
            Task { @MainActor in self?.beginPolling() }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    private func beginPolling() {
        guard timer == nil else { return }
        sampleLatest()
        let timer = Timer(timeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.sampleLatest() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    private func sampleLatest() {
        let newest = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: hrType,
            predicate: nil,
            limit: 1,
            sortDescriptors: [newest]
        ) { [weak self] _, samples, _ in
            guard let self else { return }
            let value = (samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: self.bpmUnit)
            Task { @MainActor in
                if let value { self.bpm = Int(value.rounded()) }
            }
        }
        store.execute(query)
    }
}
