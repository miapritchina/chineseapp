# ChineseWatch — Apple Watch companion

Independent watch-only app (no iOS host app) for reviewing the due
queue from the wrist. Read-only: it shows what's due; grading still
happens in the web app.

## What it does

- **Sign in** with the same email one-time-code flow as the web app
  (Supabase GoTrue, same project + publishable key). The session is
  stored in the watch Keychain and refresh tokens keep it alive.
- **Due queue**: fetches `user_fsrs_state` rows (`item_kind = word`,
  `due_at <= now`, RLS-scoped to the signed-in user), dedupes to one
  entry per word, and hydrates hanzi / pinyin / definitions from the
  `words` table.
- **Crown-paged carousel**: each due word is a full-screen page;
  turning the Digital Crown scrolls to the next word
  (`TabView` + `.verticalPage`). Tapping a word opens a detail sheet —
  pinyin, definitions, due-since, which drills are due, HSK/rank. The
  last page shows the due count, Refresh, and Sign out.

No third-party dependencies — auth and data go through Supabase's
REST endpoints (GoTrue + PostgREST) with plain `URLSession`.

## Building

Requires Xcode 16+ and watchOS 10+ (the vertical-page `TabView`).

1. Open `watchos/ChineseWatch.xcodeproj`.
2. Select your development team under Signing & Capabilities
   (signing style is Automatic; the project ships without a team).
3. Run on a paired Apple Watch or the watch simulator.

The app is marked `WKWatchOnly`, so it installs from the watch App
Store / Xcode directly with no companion iPhone app.

## Files

| File | Role |
|---|---|
| `Supabase.swift` | Config, REST client (OTP auth, refresh, due rows, word hydrate) |
| `SessionStore.swift` | Session lifecycle: Keychain persistence + token refresh |
| `Keychain.swift` | Generic-password storage for the session |
| `QueueModel.swift` | Due-queue loading: dedupe per word, facet labels |
| `LoginView.swift` | Email → code two-step sign-in |
| `QueueView.swift` | Vertical crown-paged carousel + status page |
| `WordDetailView.swift` | Detail sheet (EntitySheet counterpart, read-only) |
