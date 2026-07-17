# Polyratings for Cal Poly Portal

A browser extension (Firefox + Chrome) that annotates instructor names on the
Cal Poly student portal's Class Search with [Polyratings](https://polyratings.dev/)
ratings — a star rating, evaluation count, and a link to the professor's page —
so you don't have to look them up separately while building your schedule.

**Status:** matcher, caching, and badge injection are built and tested,
including against a real captured Class Search DOM snapshot (see
`test/content.test.js`). What's left is a live, logged-in verification pass
against the real portal.

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
├── content.test.js    # scan() exercised against a real captured portal DOM
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

`npm run build` produces `dist/chrome/` and `dist/firefox/` (unpacked) plus
zipped versions of each, loadable via each browser's standard
developer/unpacked-extension flow.

Never commit a raw portal capture used as a test fixture — the HighPoint
shell embeds the logged-in student's name and ID. Scrub any saved HTML
first:

```sh
node scripts/scrub-fixture.mjs <input.html> <output.html>
```

## Privacy

See [`PRIVACY.md`](./PRIVACY.md).

## License

MPL-2.0 (see `LICENSE`). Not affiliated with Cal Poly or Polyratings.
