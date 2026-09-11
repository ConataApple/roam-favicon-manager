# Favicon Manager for Roam Research

A small, friendly Roam Research extension that displays the favicon (website icon) next to any external link — with a **real settings panel** so you never have to touch code.

> Favicon Manager is a fork of [**roam-show-favicon**](https://github.com/paulovieira/roam-show-favicon) by **Paul Vieira (paulovieira)**. All credit for the original idea and implementation goes to him.
> The original plugin had no settings UI (the author listed "make the options configurable by the user" as a future improvement); this version adds that settings panel plus per-site custom icons.

## What it does

- Shows a small website icon next to every external link in Roam (main area + right sidebar).
- Gives you a **settings panel** (in Roam Depot → Settings) to tune everything without code:
  - **Icon position** — left or right of the link
  - **Icon size** — a positive whole number of pixels (14–18 recommended; default 16)
  - **Icon spacing** — a nonnegative whole number of pixels (zero is supported; default 4)
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

The part before `=` is the website domain (case-insensitive; no `www.` needed). A bare domain also covers its subdomains — e.g. `github.com` will match `gist.github.com` too. If stored mappings overlap, the exact host or most specific parent domain wins. The part after `=` is an image URL.

Icons are tried in this order: **custom icon → selected provider → fallback**. A provider that successfully returns a generic placeholder has not failed to load, so that response does not trigger fallback. If every candidate fails, the extension restores the link's original styles instead of leaving empty icon spacing.

> Note: this field is currently a single-line input, so it holds **one mapping at a time**. A multi-line editor (several `domain=image-url` lines) is a planned upgrade.

## For developers

- `extension.js` is the only required file. It `export default`s `{ onload, onunload }`.
- Configuration lives in `extensionAPI.settings`; no external build step is required.
- This project is a fork of [paulovieira/roam-show-favicon](https://github.com/paulovieira/roam-show-favicon).
  Please keep the attribution intact if you fork further.

### Automated regression tests

With Node.js 20+ and an installed Chrome/Chromium:

```sh
npm run check
npm test
```

No `npm install`, build step, or additional packages are needed. Set `CHROME_BIN` if your browser is not found automatically. The runner uses a temporary browser profile and a loopback-only test server; it does not touch your normal browser profile or a Roam graph.

Tests use real DOM inputs and MutationObservers, controlled image responses and timers, and a mock of the Depot settings API. They cover the public lifecycle and panel callbacks, including an unmodified ES-module smoke test. These checks are not a substitute for testing the actual Roam settings panel or network providers.

### Test a source PR before it is merged

1. Check out the PR branch locally and note `git rev-parse HEAD`.
2. In a test Roam graph, disable other copies of this extension and `roam-show-favicon` to avoid competing styles.
3. Open **Settings → Roam Depot**, enable developer mode, and use **Load extension** to choose the folder containing `extension.js` and `README.md`. The browser needs you to grant folder access.
4. Open **Favicon Manager (dev)** under Extension Settings. After changing code, reload it from **Developer Extensions** or use Roam's `ctrl-d ctrl-r` sequence.
5. After a full page refresh, reload a local-folder extension again: local-folder extensions do not auto-start. Check that the saved values remain.

A source-repository PR does **not** update `ConataApple+favicon-manager+1443`. That shorthand refers to the separate [Depot registration PR](https://github.com/Roam-Research/roam-depot/pull/1443), not to a PR in this repository.

After the source fix is merged, update that Depot PR's `source_commit` to the exact accepted source SHA, wait for its build/publish workflow, and reload the shorthand to test the distributed artifact. `roam-depot-metadata.json` in this repository is a submission copy, not the live registration; do not copy its old SHA without updating it. Developer extensions are client-local and are not a replacement for a Depot release.

See the official [Roam extension development documentation](https://roamresearch.com/#/app/developer-documentation/page/5BB8h4I7b).

### Manual Roam acceptance checklist

Record the source SHA, Roam/browser version, and observed results:

- The panel appears when loaded through Depot developer mode.
- Custom icon, fallback URL, size, and spacing edits take effect and survive refresh/reload. Clearing optional values also persists.
- Left ↔ right switches preserve the other side's original padding; spacing `0` is respected.
- Links added or edited in the main view and a newly opened sidebar get the correct domain's icon. Non-HTTP links stay unchanged.
- Custom/provider/fallback order is correct. Use a known failed image request to test fallback; a generic provider placeholder is not an error.
- Unloading during pending image requests or immediately after editing a block leaves no icon styles behind. Original styles and unrelated CSS remain intact.
- Reloading repeatedly does not create duplicate decoration or leave active observers behind.

Invalid stored types from older versions are reset to defaults; text overwritten with `false` cannot be recovered and must be entered again. Invalid numeric text renders with defaults, while the input remains editable. Save failures are reported in the console rather than silently hidden.

## License

MIT — see [LICENSE](./LICENSE). Original work © Paul Vieira; modifications © ConataApple.
