// Portal-side content script: observes the Class Search DOM, matches
// instructor names against the cached Polyratings professor list, and
// injects rating badges. See .claude-docs/plan.md §4.3.
//
// Written as ES modules for development; scripts/build.mjs inlines the
// lib/ imports into a single classic script for dist (content scripts can't
// use static `import` without a manifest module declaration — see plan §2).
import { ensureFreshProfessors } from './lib/cache.js';
import { buildProfessorIndex, isPlaceholderName, matchInstructor } from './lib/match.js';

const ext = globalThis.browser ?? globalThis.chrome;

if (location.href.includes('H_CLASS_SEARCH')) {
  main();
}

async function main() {
  const professors = await ensureFreshProfessors(ext).catch((err) => {
    console.error('[polyratings] failed to load professors', err);
    return [];
  });
  const index = buildProfessorIndex(professors);

  scan(index);
  const observer = new MutationObserver(debounce(() => scan(index), 200));
  observer.observe(document.body, { childList: true, subtree: true });
}

function debounce(fn, delayMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

// Instructor name lives in a <dt>Instructor:</dt><dd><span>Name</span></dd>
// pair (see test/fixtures/instructor-row.html). PeopleSoft doesn't expose a
// stable id/data-testid for it, so matching anchors on the label text —
// selectors will need tuning against the live logged-in DOM (plan §5).
export function scan(index) {
  for (const dt of document.querySelectorAll('dt')) {
    if (dt.textContent.trim().replace(/:$/, '') !== 'Instructor') continue;
    const dd = dt.nextElementSibling;
    if (!dd || dd.tagName !== 'DD' || dd.dataset.polyratings) continue;
    dd.dataset.polyratings = 'processed';

    const rawName = dd.textContent.trim();
    if (isPlaceholderName(rawName)) continue;

    const result = matchInstructor(rawName, index, { subjectCode: findSubjectCode(dt) });
    dd.appendChild(renderBadge(result, rawName));
  }
}

// Best-effort: look for a "SUBJ 123"-shaped course code among this class's
// other detail fields, to disambiguate same-surname professors. Confirmed
// against a real captured class-detail panel (test/fixtures/class-search-results.html):
// none of its 18 dt/dd fields structurally carries a subject code, but
// free-text fields (Description, Class Notes) can incidentally mention one
// (e.g. "...Formerly AERO 121.") — those are excluded below so a stray
// mention can't produce a false match. Revisit once live testing (plan §5)
// shows whether/where the portal renders the subject code structurally.
const PROSE_FIELD_LABELS = new Set(['Description', 'Class Notes']);

export function findSubjectCode(dtNode) {
  const detailList = dtNode.closest('dl') ?? dtNode.parentElement;
  if (!detailList) return undefined;

  const text = Array.from(detailList.querySelectorAll('dt'))
    .filter((dt) => !PROSE_FIELD_LABELS.has(dt.textContent.trim().replace(/:$/, '')))
    .map((dt) => dt.nextElementSibling?.textContent ?? '')
    .join(' ');

  const match = text.match(/\b([A-Z]{2,4})\s?\d{3}\b/);
  return match ? match[1] : undefined;
}

function renderBadge(result, rawName) {
  const host = document.createElement('span');
  host.className = 'polyratings-badge-host';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = BADGE_CSS;
  shadow.appendChild(style);
  shadow.appendChild(buildBadgeLink(result, rawName));
  return host;
}

function buildBadgeLink(result, rawName) {
  const badge = document.createElement('a');
  badge.target = '_blank';
  badge.rel = 'noopener';
  badge.className = `badge badge-${result.status}`;

  if (result.status === 'match') {
    const p = result.professor;
    const rating = p.overallRating?.toFixed(1) ?? '?';
    badge.href = `https://polyratings.dev/professor/${p.id}`;
    badge.textContent = `★ ${rating}/4 · ${p.numEvals} evals`;
    badge.setAttribute(
      'aria-label',
      `Polyratings: ${rating} out of 4 from ${p.numEvals} evaluations for ${rawName}`,
    );
  } else if (result.status === 'ambiguous') {
    badge.href = 'https://polyratings.dev/';
    badge.textContent = `${result.candidates.length} matches`;
    badge.title = result.candidates
      .map((c) => `${c.firstName} ${c.lastName} — ${c.department}`)
      .join('\n');
    badge.setAttribute(
      'aria-label',
      `Polyratings: ${result.candidates.length} possible matches for ${rawName}`,
    );
  } else {
    badge.href = 'https://polyratings.dev/new-professor';
    badge.textContent = 'Rate on Polyratings';
    badge.setAttribute('aria-label', `Rate ${rawName} on Polyratings`);
  }

  return badge;
}

// Colors/font per .claude-docs/branding.md. Inlined (rather than a
// manifest-injected badge.css) because the Shadow DOM already isolates the
// badge from page styles, so there's nothing for a page-level sheet to do.
const BADGE_CSS = `
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    margin-left: 0.5em;
    padding: 0.1em 0.6em;
    border-radius: 999px;
    font: 600 0.85em Nunito, "Helvetica Neue", Helvetica, Arial, sans-serif;
    text-decoration: none;
    white-space: nowrap;
  }
  .badge-match {
    color: #1F4715;
    background: #D7EACE;
    border: 1px solid #BD8B13;
  }
  .badge-ambiguous {
    color: #1F4715;
    background: #F3F4F6;
    border: 1px solid #1F4715;
  }
  .badge-none {
    color: #1F4715;
    background: transparent;
    border: 1px solid #D7EACE;
  }
  .badge:hover {
    background: #D7EACE;
  }
`;
