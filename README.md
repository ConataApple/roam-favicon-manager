# Favicon Manager for Roam Research

A small Roam Research extension that displays the favicon (website icon) next to
every external link — with a **settings panel**, so you never have to touch code.

> Favicon Manager is a fork of [**roam-show-favicon**](https://github.com/paulovieira/roam-show-favicon)
> by **Paul Vieira (paulovieira)**. All credit for the original idea and its
> implementation belongs to him.
>
> The original extension worked exactly as well as this one, but it could only be
> configured by editing its source. Making those options user-configurable was on
> the original author's own TODO list — this fork does that, and nothing else.

## What it does

- Shows a small website icon next to every external link in Roam (main area and
  right sidebar), exactly like the original extension.
- Adds a **settings panel** (Roam Settings → Extension Settings → Favicon Manager):

| Setting | What it does |
| --- | --- |
| **Icon position** | Show the icon on the left or the right of the link |
| **Icon size (px)** | Display size of the icon (14–18 works well) |
| **Icon spacing (px)** | Gap between the icon and the link text |
| **Icon provider** | Which service provides the icons: duckduckgo / google / yandex |
| **Custom icons** | Give a specific website your own icon (see below) |

- Settings are saved per graph and persist across sessions.

## Custom icons

In the settings panel, under **Custom icons**, write a mapping as
`domain=image-url`:

```
github.com=https://github.com/favicon.ico
```

To give several websites their own icon, separate the mappings with a
**semicolon**:

```
github.com=https://github.com/favicon.ico; wikipedia.org=https://www.wikipedia.org/static/favicon/wikipedia.ico
```

- The part before `=` is the website's domain (a leading `www.` is ignored).
- The domain must match the link exactly — a mapping for `github.com` does not
  apply to `gist.github.com`.
- The part after `=` is any image URL.

## Install (Roam Depot)

1. Open Roam Research → **Settings** → **Roam Depot**.
2. Find **Favicon Manager** and enable it.
3. Open its **Settings** tab to tune things.

## For developers

- `extension.js` is the only required file. It `export default`s `{ onload, onunload }`.
- Configuration lives in `extensionAPI.settings`; there is no build step and no
  runtime dependency.
- This is a fork of [paulovieira/roam-show-favicon](https://github.com/paulovieira/roam-show-favicon).
  Please keep the attribution intact if you fork further.

## License

MIT — see [LICENSE](./LICENSE). Original work © Paul Vieira; modifications © ConataApple.
