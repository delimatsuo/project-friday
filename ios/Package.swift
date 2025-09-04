// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "ProjectFriday",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "ProjectFriday",
            targets: ["ProjectFriday"]
        ),
    ],
    dependencies: [
        // Firebase SDK
        .package(
            url: "https://github.com/firebase/firebase-ios-sdk.git",
            from: "10.18.0"
        ),
        // Google Sign-In
        .package(
            url: "https://github.com/google/GoogleSignIn-iOS.git",
            from: "7.0.0"
        ),
    ],
    targets: [
        .target(
            name: "ProjectFriday",
            dependencies: [
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestoreSwift", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAnalytics", package: "firebase-ios-sdk"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),
            ]
        ),
        .testTarget(
            name: "ProjectFridayTests",
            dependencies: ["ProjectFriday"]
        ),
    ]
)