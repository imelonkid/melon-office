// swift-tools-version:5.9
// Melon Office for macOS: a menu bar app that hosts the office (bridge server + JS office logic in
// JavaScriptCore) and shows the existing web UI in native windows. Build the .app with mac/build.sh.
import PackageDescription

let package = Package(
    name: "MelonOffice",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "MelonOffice", path: "Sources/MelonOffice"),
    ]
)
