# Changelog

## 1.0.9
- **Fixed fallback overriding all icons.** 1.0.7 made the fallback the primary icon for any link without a custom mapping, so every normal link (which DuckDuckGo serves a real favicon for) showed the fallback instead of its real icon. Reverted the priority to **custom icon > provider > fallback**: real provider favicons show for normal links, and the fallback is used only when the icon actually fails to load (its true purpose). Updated the Fallback description to match.

## 1.0.8
- Replaced the `alicdn` example in an internal code comment with a `github.com`/`gist.github.com` example (no user-facing copy mentions alicdn anymore).

## 1.0.7
- **Fixed Fallback icon not appearing.** It previously only showed if the resolved icon failed to load, but providers (DuckDuckGo etc.) almost always return a valid image, so the fallback was effectively never used. Changed priority to **custom icon > fallback > provider**, with on-error fall-through: a link without a custom icon now shows the fallback directly, and the provider is used only if the fallback URL itself fails to load.
- Simplified the Custom icons description (removed the alicdn subdomain example; kept it short per feedback).

## 1.0.6
- **Fixed misleading copy on the Custom icons field.** The settings control is a single-line `input`, so the previous "one per line" wording (in the field name and description, and in the README) was inaccurate. Reworded to describe a single `domain=image-url` entry without claiming multi-line support. (True multi-line input via a `reactComponent` textarea remains a possible future upgrade, not yet implemented.)

## 1.0.5
- **Fixed custom icons and fallback not taking effect.**
  - Custom-icon matching was exact-hostname only, so a bare entry like `alicdn.com` never matched real links such as `img.alicdn.com`. Added `findCustomIcon()` with **suffix matching**: a bare domain now also covers its subdomains (and single-label entries like `com` are ignored for suffix matching to avoid over-matching).
  - Fallback now triggers when the **resolved** icon (custom OR provider) fails to load, not only when there was no custom icon and the provider failed.
  - Settings panel `onChange` now **explicitly saves** the typed value (`makeOnChange`) before re-applying, so input values are guaranteed to persist regardless of how Roam Depot persists `input` changes.
  - Updated the Custom icons description to explain the subdomain behavior.

## 1.0.4
- **Fixed the Custom icons field having no editable input box.**
  - Root cause: the setting used `action.type: 'text'`. In Roam Depot's settings schema, `text` renders as static text (a label), not an editable control — so the field showed the example but offered nowhere to type.
  - Changed it to `action.type: 'input'` (the same type used by the other working fields: size, spacing, fallback), so the Custom icons row now renders a real text box.
  - Confirmed `textarea` is not supported by the Roam Depot renderer (zero depot extensions use it), so `input` is the correct choice.

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
