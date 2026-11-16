# @dennykuo/glass-toast

**English** | [繁體中文](README.zh-TW.md)

[Documentation (繁體中文)](https://dennykuo.github.io/glass-toast/) · [Interactive demo](https://dennykuo.github.io/glass-toast/demo.html)

Glassmorphism toast notifications — vanilla JS, zero runtime dependencies, no Tailwind or framework required. Works out of the box.

- 4 variants (success / error / warning / info): colored icon pill, entrance glow-ring pulse, and a countdown progress bar
- 3 positions (top-right / bottom-right / bottom-center), each with its own stacking container
- Frosted-glass shell (`backdrop-filter` + layered shadows); the stack collapses smoothly when a toast is dismissed
- Auto-dismiss and the progress bar pause on hover and keyboard focus. Press `Esc` to close the focused toast.
- Built-in dark appearance (**dark frosted glass with light text** — keeps the glass look without a glaring white card at night), picked up automatically from `prefers-color-scheme`, `[data-theme="dark"]`, or `.dark`
- Full `prefers-reduced-motion` support (plain fade, no movement, no glow; the countdown bar stays because it conveys remaining time)
- Separate live regions announce regular messages as `status` and errors as `alert`. Localize the close button’s accessible name with `closeLabel`.
- Inline `action` button (e.g. "Retry"); errors stay longer by default (10 s); at most 4 toasts per position, the oldest one closes when a fifth arrives
- SPA-friendly: containers and styles are rebuilt automatically after `<body>` / `<head>` swaps (tested with Astro View Transitions)

## Install

```bash
npm install @dennykuo/glass-toast@0.1.3
```

## Quick start

### 1. Side-effect entry (simplest)

```js
import '@dennykuo/glass-toast/auto';

// Styles are injected and window.toast is ready
toast.success('Saved');
toast.error('Connection failed', { position: 'bottom-center' });
```

`/auto` is an ES module. CommonJS can load it with `require()` on supported Node versions (22.13+ within 22.x, or 24+). It sets up the global and injects styles when a browser DOM is present.

### 2. Named imports (tree-shakable, no globals)

```js
import { success, show } from '@dennykuo/glass-toast';

success('Saved');                   // styles are injected on first use
show('Custom', { type: 'warning', duration: 8000 });
```

With an explicit stylesheet (recommended for CSP / SSR):

```js
import '@dennykuo/glass-toast/style.css';
import { register, success } from '@dennykuo/glass-toast';

register({ global: false, injectStyles: false }); // turn off auto-injection
success('Saved');
```

### 3. `<script>` tag (UMD, global `GlassToast`)

```html
<script src="https://unpkg.com/@dennykuo/glass-toast@0.1.3"></script>
<!-- Or use jsDelivr
<script src="https://cdn.jsdelivr.net/npm/@dennykuo/glass-toast@0.1.3"></script>
-->
<script>
  GlassToast.register(); // sets window.toast and injects styles
  toast.info('Hello');
</script>
```

## API

### `show(message, options?) => dismiss`

Returns a function that closes the toast. The shortcuts `success` / `error` / `warning` / `info` have the same signature (minus `type`).

| option | type | default | description |
|---|---|---|---|
| `type` | `'success' \| 'error' \| 'warning' \| 'info'` | `'info'` | Variant |
| `position` | `'top-right' \| 'bottom-right' \| 'bottom-center'` | `'top-right'` | Where the toast appears |
| `persistent` | `boolean` | `false` | When `true`, the toast never auto-dismisses and shows no progress bar |
| `duration` | `number` | `10000` for `error`, `5500` otherwise | Non-finite values use the default. Finite values ≤ 0 mean `persistent`. Positive values are capped at 2,147,483,647 ms. |
| `action` | `{ label, onClick }` | — | Runs once at a time and closes the toast on success. Without an explicit finite `duration`, action toasts are persistent. |
| `dialog` | `HTMLDialogElement` | — | Shows and announces the toast inside an open native dialog. Closing the dialog clears its toasts. |

Messages are written with `textContent` and never parsed as HTML, so any string is safe (`action.label` too).

```js
import { error } from '@dennykuo/glass-toast';

error('Upload failed. Retry?', {
  action: { label: 'Retry', onClick: () => retryUpload() },
});
```

Return the Promise from `onClick` to pause the countdown until the request settles. If the callback throws or rejects, the library logs the error and lets the user retry. Handle any user-facing error details in your application.

On short screens, scroll the stack to reach older toasts. Tabbing to a button brings it into view.

### `dismissAll(options?)`

Clears every toast. **By default it only clears; later `show()` calls work as usual.** Pass `{ suppress: true }` to also block later toasts — useful when a session expires and you hard-navigate to the login page, so nothing flashes between the redirect and unload. A full page reload unblocks automatically; in an SPA without a reload, call `resume()`:

```js
dismissAll();                   // clear only (default)
dismissAll({ suppress: true }); // clear and block later show() calls (before a hard navigation)
resume();                       // unblock manually in an SPA
```

### `register(options?) => api`

Sets up the global and injects styles (the `/auto` entry is the same as calling this with no options).

| option | default | description |
|---|---|---|
| `global` | `true` | Assign the API to `target.toast` |
| `injectStyles` | `true` | `false` turns off automatic style injection entirely |
| `target` | `window` | Object that receives the global |
| `closeLabel` | `'Close'` | The close button's `aria-label`; set it to your UI language, e.g. `register({ closeLabel: 'Schließen' })` |

### `ensureStyles()`

Injects the styles idempotently. `show()` does a cheap re-check every time, so it also recovers if an SPA navigation removes the injected `<style>` from `<head>`. No-op during SSR (no `document`).

## Theming (CSS variables)

All colors go through `--gt-*` custom properties scoped to `.glass-toast`, so nothing leaks onto `:root`. Override them in your own stylesheet:

```css
.glass-toast { --gt-text: #333; --gt-radius: 0.5rem; }
.glass-toast--success { --gt-icon: #0a7d4f; --gt-ring: 10, 125, 79; }
```

| variable | default (light) | description |
|---|---|---|
| `--gt-bg` | `rgba(255,255,255,.8)` | Shell background |
| `--gt-bg-opaque` | `rgba(255,255,255,.96)` | Fallback background when `backdrop-filter` is unsupported |
| `--gt-border` | `rgba(229,231,235,.4)` | Shell border |
| `--gt-text` | `#4a5565` | Message text |
| `--gt-blur` | `24px` | Frosted-glass blur radius |
| `--gt-radius` | `1rem` | Shell corner radius |
| `--gt-shadow` | layered shadow | Shell shadow (the glow ring is drawn on top) |
| `--gt-close-*` | grays | Close button bg / border / text (plus `-hover` versions) |
| `--gt-focus-ring` | `#2563eb` (dark: `#93c5fd`) | Focus-visible ring for the close and action buttons |
| `--gt-action-*` | follows the appearance | Action button bg / border / text (plus `-bg-hover`); light mode uses variant-colored text (error uses red-700), dark mode uses message text and a neutral hover background |
| `--gt-pill-bg` / `--gt-icon` / `--gt-bar` | per variant | Icon pill / icon color / progress bar |
| `--gt-ring` | per variant | Glow-ring color as an `R, G, B` triplet (fed to `el.animate()`) |

### Dark appearance

Dark mode is **dark frosted glass** (a low-luminance translucent background, `rgba(28,28,30,.72)`, with light text) — it keeps the glass look without a glaring white card at night. Variant pills and icons reuse the light values. The shell, close button and focus ring are overridden; action buttons use the message text color and a neutral hover background so small text stays legible.

It applies when any of these is true (an explicit `data-theme="light"` or `.light` on the page wins over the OS setting):

1. `@media (prefers-color-scheme: dark)`
2. `<html data-theme="dark">`
3. `<html class="dark">` (Tailwind convention)

All dark overrides use `:where()` to keep the same specificity as the base rules, so your overrides never have to fight the package's selectors.

## CSP / SSR notes

Use `persistent: true` for important messages or actions available only in the toast, or provide another way to access them after it closes. See [WCAG 2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html).

- Strict CSP (no inline `<style>`): import `'@dennykuo/glass-toast/style.css'` explicitly and call `register({ injectStyles: false })`
- Already loading the stylesheet yourself and want to avoid a duplicate: add a `data-glass-toast` attribute to your `<link>` / `<style>` and auto-injection will detect it and skip
- SSR: `show()` returns a no-op dismiss function when no DOM is available. Call it on the client to display a toast.

Pass the open `dialog` element to keep the toast and its controls inside a native modal. An unopened or detached dialog produces no toast.

```js
import { error } from '@dennykuo/glass-toast';

const dialog = document.querySelector('#upload-dialog');
dialog.showModal();
error('Upload failed', { dialog, persistent: true });
```

## Development

Use Node 24 (`nvm use`; CI reads `.nvmrc`). Node 22.13+ is also supported on the 22.x line.

```bash
npm ci --ignore-scripts # install from the lockfile without dependency lifecycle scripts
npx playwright install chromium firefox webkit # one-time browser setup
npm run dev            # docs site: / docs, /demo.html interactive playground
npm test               # vitest + jsdom (includes documentation coverage guards)
npm run test:browser   # Chromium, Firefox, and WebKit at desktop and mobile widths
npm run lint           # ESLint, including docs scripts
npm run build          # dist/: ESM + UMD + CSS + .d.ts / .d.cts
npm run check:package  # lint the tarball and type-check the README examples against it
npm run build:docs     # dist-docs/: static docs site (relative paths, ready for GitHub Pages)
```

The docs site lives entirely in `docs/` (the site content is currently in Traditional Chinese):

```
docs/
  index.html        Docs (home page)
  demo.html         Interactive playground
  partials/         Shared HTML fragments, inserted at build time by vite.config.js
  site.css          Shared styles
  index.js          Docs page interactions
  demo.js           Demo page interactions
  site.js           Shared scripts
  public/appearance.js  Restores appearance before the page is painted
  scrollspy.js      Table-of-contents scroll sync (pure function, test/scrollspy.test.js)
  vite.config.js    Docs site config (picked up automatically by `vite docs`)
```

Pages sit flat in the `docs/` root, so links inside partials always use `./`. The package name and version come from `package.json` via `%PKG_NAME%` and friends.

CI checks pushes to `main` and `develop`, plus pull requests. On `main`, CI installs the exact public npm version into a fresh project before deploying the docs. If deployment is skipped because the version is unpublished, run **CI** on `main` after publishing. After deployment, CI opens the live docs and verifies the version, CDN scripts, and the demo retry action. CI also checks the version in both READMEs.

ESLint 10.15.0 requires a patched `minimatch` release directly. The lockfile resolves 11.0.8,
so the temporary override for [GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) has been removed.

Documentation coverage is guarded by tests that scan the source for the public API, the `show()` / `register()` options, and every `--gt-*` variable:

- `test/docs.test.js` checks that `docs/index.html` has a matching `data-doc` entry for each
- `test/readme.test.js` checks that both `README.md` and `README.zh-TW.md` mention every export and option, and link to each other

When you add an API, update all of them.

## License

MIT © Denny
