<!-- generated-by: Claude | source: July 2026 watch-only release session (build 3) | purpose: step-by-step App Store distribution guide for the watch-only app -->

# Distributing the watch-only app to App Store Connect

How ChineseWatch ships to the App Store / TestFlight **without a
visible iPhone app**, working around the Xcode 26 watch-only
distribution bug. This exact pipeline produced build 3 (VALID in App
Store Connect, 2026-07-20).

## Background: the Xcode 26 bug

Xcode 26 (still broken as of 26.6, Apple bug FB22730778,
[forum thread](https://developer.apple.com/forums/thread/817223))
cannot distribute a *bare* watch-only archive to App Store Connect:

- Organizer and `xcodebuild -exportArchive` only offer
  Release Testing / Enterprise / Debugging — no App Store Connect.
- `altool` fails on watchos IPAs ("Cannot determine the 'platform'").
- `iTMSTransporter` was removed from the Xcode 26 toolchain.
- The new ASC Build Upload API has no watchOS platform
  (`IOS | MAC_OS | TV_OS | VISION_OS` only) and rejects a bare watch
  binary under `IOS`.

**The fix** is how Apple's own "Watch-only App" template has always
shipped: wrap the watch app in an **invisible container** — an iOS
target with product type
`com.apple.product-type.application.watchapp2-container`, **zero
source files**, only a Resources phase (App Store icon) and an Embed
Watch Content phase. The container archive counts as an iOS archive,
so every distribution path works again. Users see nothing on iPhone;
the App Store treats the product as watch-only.

## Project setup (already done — for reference)

| Target | Setting |
|---|---|
| `ChineseWatch` (container) | `productType = com.apple.product-type.application.watchapp2-container`, no sources, `SDKROOT = iphoneos`, bundle `io.github.decobots.chineseapp` |
| `ChineseWatch Watch App` | `INFOPLIST_KEY_WKWatchOnly = YES`, `SKIP_INSTALL = YES`, **no** `WKCompanionAppBundleIdentifier`, bundle `io.github.decobots.chineseapp.watchkitapp` |

The container's bundle id must be a prefix of the watch app's, and
both targets must share `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION`.
App Store Connect app record: **"Chinese App Watch"** (Apple ID
6792881724), registered under the *container's* bundle id, platform iOS.

## One-time machine setup

1. **Team API key** (App Store Connect → Users and Access →
   Integrations → App Store Connect API → **Team Keys** tab, role
   App Manager). Individual keys do **not** work with the upload
   tools — team keys come with an Issuer ID, individual keys don't.
   Install as `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`.
   Current key: `B9P9RH6QF2`, issuer
   `eb682fe9-8bdf-4520-8256-5bac2023f972`, team `9Z26RCYSWA`.
2. **Apple Distribution certificate** in the login keychain. One was
   created 2026-07-20 (expires 2027-07-20). If it's missing on a new
   machine: Xcode → Settings → Accounts → Manage Certificates → “+” →
   Apple Distribution, or let `-allowProvisioningUpdates` cloud
   signing handle it.

## Release steps

From `watchos/`, with `KEY=B9P9RH6QF2` and
`ISSUER=eb682fe9-8bdf-4520-8256-5bac2023f972`:

```bash
# 0. Bump CURRENT_PROJECT_VERSION (both targets) — ASC rejects a
#    CFBundleVersion it has already seen. Build 3 is used.

# 1. Archive the container scheme (iOS destination, NOT watchOS)
xcodebuild archive \
  -project ChineseWatch.xcodeproj -scheme ChineseWatch \
  -destination "generic/platform=iOS" \
  -archivePath /tmp/ChineseWatch.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_$KEY.p8 \
  -authenticationKeyID $KEY -authenticationKeyIssuerID $ISSUER

# 2. Export for the App Store (works because the archive is "iOS")
cat > /tmp/exportOptions.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key><string>app-store-connect</string>
    <key>destination</key><string>export</string>
    <key>teamID</key><string>9Z26RCYSWA</string>
    <key>signingStyle</key><string>automatic</string>
</dict>
</plist>
EOF
xcodebuild -exportArchive \
  -archivePath /tmp/ChineseWatch.xcarchive \
  -exportPath /tmp/ChineseWatchExport \
  -exportOptionsPlist /tmp/exportOptions.plist \
  -allowProvisioningUpdates \
  -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_$KEY.p8 \
  -authenticationKeyID $KEY -authenticationKeyIssuerID $ISSUER

# 3. Upload (the IPA is iOS-platform as far as altool is concerned)
xcrun altool --upload-app -f /tmp/ChineseWatchExport/ChineseWatch.ipa \
  -t ios --apiKey $KEY --apiIssuer $ISSUER
```

Wait a few minutes, then check App Store Connect → TestFlight: the
build appears once `processingState` is VALID. Testers install via
TestFlight on iPhone, which pushes the app to their watch — the
container never shows up as an app.

## Troubleshooting

- **"expected one of {release-testing, enterprise, debugging}"** on
  export → you archived the bare watch scheme. Archive the
  `ChineseWatch` (container) scheme with an **iOS** destination.
- **altool 401** → you're using an Individual API key. Only Team keys
  (with an Issuer ID) work with altool / xcodebuild.
- **"bundle version must be higher"** → bump
  `CURRENT_PROJECT_VERSION` in both targets.
- **Local-only development** doesn't need any of this — the shared
  `ChineseWatch Watch Only` scheme builds/runs the bare watch app.
