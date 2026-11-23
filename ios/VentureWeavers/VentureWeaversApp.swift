import SwiftUI

/// VentureWeavers for iPhone: the member app (app.ventureweavers.com) full screen, nothing added.
@main
struct VentureWeaversApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}

let appURL = URL(string: "https://app.ventureweavers.com/")!
let ink = Color(red: 7 / 255, green: 17 / 255, blue: 18 / 255)

struct ContentView: View {
    @StateObject private var state = WebState()

    var body: some View {
        ZStack {
            ink.ignoresSafeArea()
            WebView(url: appURL, state: state)
                .ignoresSafeArea()
            if state.failed {
                VStack(spacing: 14) {
                    Text("Can't reach VentureWeavers")
                        .font(.headline)
                    Text("Check your connection and try again.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Button("Try again") { state.reload() }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 41 / 255, green: 190 / 255, blue: 156 / 255))
                }
                .padding(28)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(ink)
            }
        }
    }
}
