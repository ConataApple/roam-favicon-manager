# Favicon Manager for Roam Research

A small, friendly Roam Research extension that displays the favicon (website icon) next to any external link — with a **real settings panel** so you never have to touch code.

> Favicon Manager is a fork of [**roam-show-favicon**](https://github.com/paulovieira/roam-show-favicon) by **Paul Vieira (paulovieira)**. All credit for the original idea and implementation goes to him.
> The original plugin had no settings UI (the author listed "make the options configurable by the user" as a future improvement); this version adds that settings panel plus per-site custom icons.

## What it does

- Shows a small website icon next to every external link in Roam (main area + right sidebar).
- Gives you a **settings panel** (in Roam Depot → Settings) to tune everything without code:
  - **Icon position** — left or right of the link
  - **Icon size** — in pixels (14–18 recommended)
  - **Icon spacing** — gap between the icon and the text
  - **Icon provider** — duckduckgo / google / yandex
  - **Custom icons** — assign a specific favicon to any website by `domain=image-url` (e.g. `github.com=https://github.com/favicon.ico`). A bare domain also covers its subdomains.
  - **Fallback icon** — an optional icon shown if a provider fails to load an image
- Settings are saved per-graph and persist across sessions.

## Install (Roam Depot)

1. Open Roam Research → **Settings** (top-right menu) → **Roam Depot** (left sidebar).
2. Find **Favicon Manager** and enable it.
3. Click the extension's **Settings** to open the panel and tune to taste.

## Custom icons — quick example

In the settings panel, under *Custom icons*, enter a `domain=image-url` mapping, e.g.:

```
github.com=https://www.google.com/s2/favicons?domain=github.com&sz=64
```

The part before `=` is the website domain (no `www.` needed). A bare domain also covers its subdomains — e.g. `github.com` will match `gist.github.com` too. The part after `=` is any image URL.

> Note: this field is currently a single-line input, so it holds **one mapping at a time**. A multi-line editor (several `domain=image-url` lines) is a planned upgrade.

## For developers

- `extension.js` is the only required file. It `export default`s `{ onload, onunload }`.
- Configuration lives in `extensionAPI.settings`; no external build step is required.
- This project is a fork of [paulovieira/roam-show-favicon](https://github.com/paulovieira/roam-show-favicon).
  Please keep the attribution intact if you fork further.

## License

MIT — see [LICENSE](./LICENSE). Original work © Paul Vieira; modifications © ConataApple.
