# Polyratings for Cal Poly Portal

A browser extension (Firefox + Chrome) that annotates instructor names on the
Cal Poly student portal's Class Search with [Polyratings](https://polyratings.dev/)
ratings — a star rating, evaluation count, and a link to the professor's page —
so you don't have to look them up separately while building your schedule.


## How it works

- **Data source:** the extension fetches the public professor list from
  `api-prod.polyratings.org` (no auth, no user data sent) and caches it in
  `storage.local` for 24 hours.
- **Matching:** a content script scans the Class Search DOM (rendered inside
  an iframe on `cmsweb.pscs.calpoly.edu`) for instructor names, normalizes
  them, and matches them against the cached professor list — falling back to
  course/department disambiguation when two professors share a last name.
- **Display:** a matched instructor gets a badge (`★ 3.2/4 · 17 evals`) linking
  to their Polyratings page; ambiguous or unmatched names get a lighter-weight
  badge instead of a silent guess.

All matching happens locally in the browser; the only network request is the
anonymous fetch of the public professor list.

## Project layout

```
src/
├── content.js        # portal-side: observes the DOM, matches names, injects badges
├── background.js     # cache refresh via alarms
└── lib/
    ├── api.js         # fetch + parse professors.all
    ├── cache.js       # storage.local read/write, 24h TTL
    └── match.js       # name normalization + matching (pure functions)
manifests/
├── manifest.chrome.json
└── manifest.firefox.json
icons/
├── icon.svg           # source; edit this, then `npm run icons`
└── icon-{16,32,48,96,128}.png
scripts/
├── build.mjs          # assembles dist/chrome + dist/firefox, zips both
├── generate-icons.mjs # rasterizes icon.svg to the PNG sizes above
└── scrub-fixture.mjs  # strips PII from saved portal HTML before it's committed as a fixture
test/
├── match.test.js
├── cache.test.js
└── fixtures/          # scrubbed portal DOM snapshots
```

## Development setup

Requires Node 20+.

```sh
npm install
npm test               # unit tests (node:test)
npm run build           # produces dist/chrome, dist/firefox, and both zips
npm run lint             # web-ext lint against dist/firefox
npm run icons             # regenerate icons/*.png from icons/icon.svg (only when the icon changes)
```

## Loading the extension locally

Run `npm run build` first, then:

**Firefox:**

```sh
npx web-ext run --source-dir dist/firefox
```

Opens a fresh Firefox profile with the extension loaded, auto-reloading on
changes. Alternatively: `about:debugging` → "This Firefox" → "Load Temporary
Add-on" → select `dist/firefox/manifest.json`. Temporary add-ons disappear on
restart — that's expected during development.

**Chrome:**

`chrome://extensions` → toggle **Developer mode** (top right) → **Load
unpacked** → select `dist/chrome/`. Click the refresh icon on the extension's
card after each rebuild.

## Testing against the live portal

Badge placement and instructor-name matching still need verification against
a real, logged-in Class Search session — that's a manual step:

1. Log into the portal, open Class Search, run a search with many results.
2. Confirm badges appear next to instructor names, survive
   pagination/filter changes, and link to the right Polyratings professor
   pages.
3. Note any instructor names that fail to match or match incorrectly — feed
   them back into `test/match.test.js` as regression fixtures.
4. Spot-check a few departments (engineering, liberal arts, sciences) — name
   formats and adjunct coverage differ.

### Test fixtures

Never commit a raw portal capture — the HighPoint shell embeds the logged-in
student's name and ID. Scrub any saved HTML first:

```sh
node scripts/scrub-fixture.mjs <input.html> <output.html>
```

## Privacy

See [`PRIVACY.md`](./PRIVACY.md).

## License

MPL-2.0 (see `LICENSE`). Not affiliated with Cal Poly or Polyratings.
