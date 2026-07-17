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
├── content.js       # portal-side: observes the DOM, matches names, injects badges
├── background.js    # cache refresh via alarms
└── lib/
    ├── api.js        # fetch + parse professors.all
    ├── cache.js       # storage.local read/write, 24h TTL
    └── match.js       # name normalization + matching (pure functions)
scripts/
└── scrub-fixture.mjs  # strips PII from saved portal HTML before it's committed as a fixture
test/
├── match.test.js
├── cache.test.js
└── fixtures/          # scrubbed portal DOM snapshots
```

`manifests/` and `icons/` exist but are currently empty — manifest files and
extension icons are not yet checked in.

## Development

Requires Node 20+.

```sh
npm install
npm test
```

`npm run build` and `npm run lint` are declared in `package.json` for the
eventual `scripts/build.mjs` (assembling `dist/firefox` and `dist/chrome`,
then `web-ext lint`), but that build script doesn't exist yet, so those
commands will currently fail.

### Test fixtures

Never commit a raw portal capture — the HighPoint shell embeds the logged-in
student's name and ID. Scrub any saved HTML first:

```sh
node scripts/scrub-fixture.mjs <input.html> <output.html>
```

## License

MPL-2.0 (see `LICENSE`). Not affiliated with Cal Poly or Polyratings.
