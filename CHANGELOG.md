# Changelog

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
