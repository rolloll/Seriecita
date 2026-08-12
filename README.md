# Seriecita

Google Play Books' web library (`play.google.com/books`) has no way to group a multi-volume series together. Once your library grows, volume 1, volume 2, and side stories of the same series end up scattered across the shelf.

Seriecita is a Chrome/Edge (Manifest V3) extension that hooks into the library page, recognizes volume numbers in book titles, and collapses each series into a single "deck". It never touches your Google account or server-side data — everything happens client-side, in the page you already see.

## Features

- **Automatic series detection**: Titles ending in patterns like `1권`, `2`, `외전1`, `(외전 1)`, `번외` are grouped by base title + author. A series only collapses once you actually own 2+ volumes of it — a single volume has nothing to group with, so it's left alone.
- **Deck view**: A grouped series shows only its lowest-numbered volume, with a badge (e.g. "5 vol. ›") in the bottom-right corner of the cover. Clicking the badge expands that series into its full, ordered list of volumes, with a header (title + count + a collapse button) at the top.
- **Select all in a series**: The "Select all" button in an expanded series header clicks Google's native "Select" checkbox on every volume in that series, so you can immediately use Google's own selection toolbar (delete, add to shelf, etc.).
- **Collect by author**: A small "Collect" link next to each author's name filters the whole shelf down to just that author's books. A chip in the bottom-right corner (with a ✕) clears the filter.
- **On/off toggle**: The `Seriecita: ON/OFF` button in the bottom-right corner instantly reverts to Google's normal view. State is saved in `chrome.storage.local` and persists across visits.
- **Update notifications**: A background check every 6 hours against this repo's [latest release](https://github.com/rolloll/Seriecita/releases/latest). If a newer version exists, you get a desktop notification (click it to jump to the release page) and, if a Play Books tab is open, a green update banner. Each version is only announced once.
- **Classify by author / publish year / publisher**: The classification bar in the top-right corner splits the whole shelf into sections by one of these (a grouped series is classified by its lowest-numbered volume). Author classification is instant since that data is already on the page; year/publisher require fetching each book's info from the Google Books API, so the bar shows a "Loading metadata (N/M)" status while that's in progress, and books with no data land in an "Unknown year"/"Unknown publisher" section. Once fetched, results are cached.
- **Manual series grouping**: For series the title heuristic misses (no volume marker, or an irregular one), turn on "Manual grouping" in the bottom-left corner to get a selection checkbox on every cover. Select 2+ books, click "Group as series", and name it — it becomes a deck just like an auto-detected series, with the same badge/expand/select-all behavior. From an expanded custom group's header you can **rename** it or **add books** (re-enters selection mode); each volume also gets a ✕ button to remove just that one (the group auto-dissolves once it drops below 2 members). Deleting a group removes the whole grouping — none of this ever deletes an actual book.
- **English/Korean UI**: All of Seriecita's own text (buttons, banners, dialogs, notifications) is available in English and Korean. It follows the page's language by default, and can be pinned to either in Settings.

## Installation

1. Download the zip from the [latest release](https://github.com/rolloll/Seriecita/releases/latest) and unzip it, or clone this repository.
2. Go to `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Turn on **Developer mode** (bottom-left in Edge, top-right in Chrome).
4. Click **"Load unpacked"** and select the unzipped/cloned folder.
5. Reload `play.google.com/books`.

When a new version is released, download the new zip from the release page the notification/banner links to, overwrite the same folder, then click **"Reload"** on the Seriecita card in your extensions list.

## Settings

Right-click the extension icon → **Options** (or, on `chrome://extensions`, Seriecita's "Details → Extension options") to:

- **Language**: Auto-detect (follows the Play Books page's language), Korean, or English. Applies to every button, banner, dialog, and notification Seriecita adds.
- **Google Books API key (optional)**: used for year/publisher classification, which calls `GET https://www.googleapis.com/books/v1/volumes/{id}` for every book. It works without a key, but unauthenticated requests have a low quota and a large library may hit 429 errors. The key is stored only in Seriecita's own `chrome.storage.local` and is never sent anywhere else.

## Project structure

```
manifest.json   Manifest V3 definition. Injects content.js/content.css into
                https://play.google.com/books*, registers background.js as
                the service worker, and options/ as the options page.
content.js      All library-page logic (see "How it works" below)
content.css     Styles for the injected badges, headers, toggle, classify
                bar, checkboxes, etc.
background.js   1) Checks the GitHub Releases API every 6 hours and notifies
                   on a newer version
                2) Looks up volume ids that content.js requests against the
                   Google Books API, caching results in
                   chrome.storage.local (`seriecitaMetaCache`)
options/        Settings page (options_ui): language and the optional API key
icon*.png       Toolbar/management-page icons (16/48/128px)
```

There's no build step — the browser reads these files as-is.

## How it works

Since the Play Books library is an Angular app, moving DOM nodes directly risks Angular's next change-detection pass undoing it. The implementation follows two rules instead:

1. **Never move a card node.** Each `<gpb-volume-card>` only gets its inline `style.order` (CSS Grid's visual order) and `style.display` touched. The actual DOM tree stays exactly as Angular left it.
2. **Only add/remove nodes we created ourselves.** Series headers, badges, the "Collect" button, and filter chips are all elements Seriecita appends, tagged with `data-seriecita-*` attributes so they can be cleanly removed and rebuilt on every re-render.

Key functions in `content.js`:

- `parseSeries(title)`: a regex heuristic that pulls a series' base title, volume number, and kind (`volume`/`sidestory`/`extra`/`single`) out of a title string. Google exposes no series metadata for owned books (the Google Books API's `mylibrary` endpoints don't cover Play Store purchases), so title text is the only signal available.
- `computeEntries(cards)`: first pulls out any cards covered by `customGroups` (manual grouping, keyed by volume id), then auto-groups whatever's left by `base title|author`. Two or more items become a group, sorted by volume number then kind; manual groups always take priority over auto-detection.
- `buildBuckets(entries)`: splits entries into sections per `classifyMode` (author/year/publisher) and sorts them (years newest-first, everything else alphabetically). With no classification active, it just returns one bucket, so behavior is unchanged.
- `applyGrouping(grid)`: recomputes and redraws everything from scratch each time (clearing and rebuilding headers/badges/classify-headers) rather than reading state back from the DOM — `expandedKeys`, `authorFilter`, `classifyMode`, `customGroups`, and `metaCache` live in module scope and get reapplied on every pass.
- `getGrid()`: finds the grid container via `document.querySelector('gpb-volume-card').parentElement` instead of a CSS class name, so a Google class-name change won't break it.
- Re-run trigger: a `MutationObserver` on `document.body` (childList/subtree) catches sort changes, lazy loading, and navigating away and back, debounced 300ms before reapplying. An `isApplying` flag stops it from reacting to mutations Seriecita itself just made.

Manual grouping (`customGroups`) and classification (`classifyMode`/`metaCache`) persist across restarts in `chrome.storage.local` under `seriecitaCustomGroups`, `seriecitaClassifyMode`, and `seriecitaMetaCache`. `getVolumeId(card)`, which extracts the id from a card's `a.title` href (`.../reader?id=XXXX`), is the shared key across all three features.

Localization: `content.js`, `background.js`, and `options/options.js` each keep a small `STRINGS = { ko: {...}, en: {...} }` dictionary (no shared module system, since there's no build step) and a `t(key, ...args)` helper that looks up the current locale's entry, calling it if it's a function (for strings that interpolate a count, name, etc.). The active locale comes from `seriecitaLocale` in `chrome.storage.local` (`'auto' | 'ko' | 'en'`, default `'auto'`); when set to `'auto'`, `content.js` reads `document.documentElement.lang` (falling back to `navigator.language`) since it runs on the actual Play Books page, while `background.js` and `options.js` — which have no page to inspect — fall back to `navigator.language` directly. Changing the setting in Options writes `seriecitaLocale`, and `content.js`'s existing `chrome.storage.onChanged` subscription re-resolves the locale and calls `refreshStaticLabels()` (for the toggle/classify-bar/select-mode chrome that's only built once) plus a full `applyGrouping()` re-render (for headers/badges/dialogs, which already call `t()` fresh on every render).

Metadata lookup flow: when `content.js` switches classification to year or publisher, it sends any uncached ids to the background via `chrome.runtime.sendMessage({type:'seriecitaFetchMetadata', ids})`. The background worker calls `https://www.googleapis.com/books/v1/volumes/{id}` one at a time (150ms apart) and writes results into `seriecitaMetaCache`. `content.js` subscribes to that via `chrome.storage.onChanged` and redraws as data arrives.

Update-check flow in `background.js`:

1. On install and every 6 hours (`chrome.alarms`), `GET https://api.github.com/repos/rolloll/Seriecita/releases/latest`.
2. Compare the returned `tag_name` (e.g. `v1.1.0`) against `chrome.runtime.getManifest().version` (`compareVersions`).
3. If the release is newer, store `{version, url}` in `seriecitaUpdateAvailable` and fire `chrome.notifications.create` once per version.
4. `content.js` subscribes to that value via `chrome.storage.onChanged` to show or hide the banner.

For this mechanism to pick up a new release, bump `version` in `manifest.json` and tag the matching GitHub Release `vX.X.X`.

## Known limitations

- A series with no volume marker at all in its titles (only the subtitle differs) won't be auto-detected — use manual grouping for those.
- "Select all" finds Google's own internal "Select"/"선택" button by its label text and clicks it; if Google changes that markup or label, it may silently stop working.
- There's no automated test against Google Play Books' own UI changes (class names, DOM structure). If something breaks, check the selectors in `content.js` (`gpb-volume-card`, `.metadata`, `.cover`, `a.title`).
- Update checks call the GitHub Releases API unauthenticated, so there's a per-IP hourly limit (60 requests) — a non-issue at personal-use scale.
- Year/publisher lookups use Google Books' per-id volume API; books that genuinely have no such data there (self-published, unlisted, etc.) land in the "Unknown" bucket. If bulk lookups without an API key hit a 429, wait a bit and re-select the classification to retry.
- Adding/removing books from a manual group is keyed by volume id, so if a book is fully removed from your library, it naturally drops out of any custom group on the next render.
