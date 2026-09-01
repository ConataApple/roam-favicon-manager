# Favicon Manager for Roam Research

A small, friendly Roam Research extension that displays the favicon (website icon) next to any external link — with a **real settings panel** so you never have to touch code.

> 💛 This extension is a community contribution, built **on top of** the wonderful original
> [**roam-show-favicon**](https://github.com/paulovieira/roam-show-favicon) by
> **Paul Vieira (paulovieira)**. All credit for the original idea and implementation goes to him.
> The original plugin did not have a settings UI (the author listed "make the options
> configurable by the user" as a future improvement); this version adds that settings panel
> plus per-site custom icons. If Paul ever wants these enhancements merged back into his
> project, we would be delighted.

## What it does

- Shows a small website icon next to every external link in Roam (main area + right sidebar).
- Gives you a **settings panel** (in Roam Depot → Settings) to tune everything without code:
  - **Icon position** — left or right of the link
  - **Icon size** — in pixels (14–18 recommended)
  - **Icon spacing** — gap between the icon and the text
  - **Icon provider** — duckduckgo / google / yandex
  - **Custom icons** — assign a specific icon to any website (one per line: `domain=image-url`)
  - **Fallback icon** — an optional icon shown if a provider fails to load an image
- Settings are saved per-graph and persist across sessions.

## Install (Roam Depot)

1. Open Roam Research → **Settings** (top-right menu) → **Roam Depot** (left sidebar).
2. Find **Favicon Manager** and enable it.
3. Click the extension's **Settings** to open the panel and tune to taste.

## Custom icons — quick example

In the settings panel, under *Custom icons*, add one site per line:

```
z-lib.fm=https://z-lib.fm/img/favicons/favicon.svg
github.com=https://www.google.com/s2/favicons?domain=github.com&sz=64
```

The part before `=` is the website domain (no `www.` needed). The part after `=` is any image URL.

## For developers

- `extension.js` is the only required file. It `export default`s `{ onload, onunload }`.
- Configuration lives in `extensionAPI.settings`; no external build step is required.
- This project is a fork of [paulovieira/roam-show-favicon](https://github.com/paulovieira/roam-show-favicon).
  Please keep the attribution intact if you fork further.

## License

MIT — see [LICENSE](./LICENSE). Original work © Paul Vieira; modifications © ConataApple.
