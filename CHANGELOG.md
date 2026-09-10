# Changelog

## 1.0.3
- Copy/polish pass on user-facing text (no functional change):
  - README intro no longer calls the extension "a community contribution" or uses "wonderful"; it now simply states it is a fork of Paul Vieira's roam-show-favicon, with credit to him.
  - Replaced the `z-lib.fm` example (a piracy site) in the Custom icons docs and the settings placeholder with mainstream sites (github.com / wikipedia.org).

## 1.0.2
- **Fixed the settings panel never appearing when loaded via Roam Depot** (real bug, reported by community member **panterarocks49**).
  - Root cause: Roam Depot passes the extension API **wrapped** as `{ extensionAPI }` into `onload`, not the API object directly. The previous guard `input && input.settings ? input` failed because the wrapper has no `.settings`, so it fell back to `window.roamjsExtensionAPI` (undefined in Roam Depot) and `extensionAPI` became `null` — sending the code into the "no settings panel" branch.
  - `onload` now reads `input.extensionAPI` first (Roam Depot), then `input` directly (defensive), then `window.roamjsExtensionAPI` (legacy roam/js). The panel now creates correctly under Roam Depot.
  - Verified the `{ extensionAPI }` shape against two shipping Roam Depot extensions: `RoamJS/autotag` and `8bitgentleman/roam-depot-tweet-extract`.

## 1.0.1
- Fixed a style-reset bug reported by community member **panterarocks49**: when settings (e.g. icon position left↔right) changed, old inline styles were never cleared, so new styles stacked on top of stale ones.
  - `removeFavicon` now uses `removeProperty` to truly drop inline styles (previously pinned them to `initial`).
  - `removeFavicon` now clears **both** `padding-left` and `padding-right`, so a left↔right switch never leaves a stale pad.
  - `reapplyAll` no longer deletes the element flag before calling `removeFavicon`, so the removal guard runs correctly.

## 1.0.0
- Forked from [paulovieira/roam-show-favicon](https://github.com/paulovieira/roam-show-favicon) (original idea & implementation by Paul Vieira — thank you!).
- Added a native **settings panel** (Roam Depot → Settings) so users can configure everything without editing code:
  - Icon position (left / right)
  - Icon size (px)
  - Icon spacing (px)
  - Icon provider (duckduckgo / google / yandex)
  - Per-site custom icons (domain=image-url, one per line)
  - Optional fallback icon URL
- Settings persist per-graph via the Roam Depot `extensionAPI.settings` store.
- Added defensive fallback: if `extensionAPI` is unavailable, the extension still runs with default settings.
