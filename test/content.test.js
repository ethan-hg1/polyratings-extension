import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { buildProfessorIndex } from '../src/lib/match.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(path.join(here, 'fixtures', 'class-search-results.html'), 'utf8');

// content.js reads `document`/`location`/`MutationObserver` as bare globals,
// since it's written to run as an injected content script (see plan §4.3).
// Tests provide a jsdom environment via globalThis before importing it. The
// URL deliberately omits H_CLASS_SEARCH so the module's own auto-run guard
// stays inert — tests drive `scan()`/`findSubjectCode()` directly instead.
const dom = new JSDOM(fixtureHtml, { url: 'https://cmsweb.pscs.calpoly.edu/psc/other' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location;
globalThis.MutationObserver = dom.window.MutationObserver;

const { scan, findSubjectCode } = await import('../src/content.js');

function professor(overrides) {
  return {
    id: 'kira-id',
    firstName: 'Kira',
    lastName: 'Abercromby',
    department: 'Aerospace Engineering',
    overallRating: 3.6,
    numEvals: 42,
    courses: ['AERO 121'],
    ...overrides,
  };
}

function instructorFields() {
  return Array.from(document.querySelectorAll('dt')).filter(
    (dt) => dt.textContent.trim().replace(/:$/, '') === 'Instructor',
  );
}

test('scan: finds the real Instructor field among its 18 sibling dt/dd pairs and badges it', () => {
  const index = buildProfessorIndex([professor()]);
  scan(index);

  const [instructorDt, ...rest] = instructorFields();
  assert.ok(instructorDt, 'fixture should contain an Instructor field');
  assert.equal(rest.length, 0, 'fixture is expected to have exactly one Instructor field');

  const dd = instructorDt.nextElementSibling;
  assert.equal(dd.dataset.polyratings, 'processed');

  const host = dd.querySelector('.polyratings-badge-host');
  assert.ok(host, 'badge host should be appended to the Instructor dd');
  const badge = host.shadowRoot.querySelector('a.badge-match');
  assert.ok(badge, 'should render a match badge for Kira Abercromby');
  assert.equal(badge.href, 'https://polyratings.dev/professor/kira-id');

  // None of the other 17 sibling fields (Class Number, Description, ...)
  // should have been touched — matching is anchored on the "Instructor"
  // label text specifically, not any dt/dd pair.
  const allDts = Array.from(document.querySelectorAll('dt'));
  const untouchedDds = allDts.filter((dt) => dt !== instructorDt).map((dt) => dt.nextElementSibling);
  for (const otherDd of untouchedDds) {
    assert.equal(otherDd.dataset.polyratings, undefined);
  }
});

test('scan: rescanning does not duplicate the badge', () => {
  const index = buildProfessorIndex([professor()]);
  scan(index);
  scan(index);

  const dd = instructorFields()[0].nextElementSibling;
  assert.equal(dd.querySelectorAll('.polyratings-badge-host').length, 1);
});

test('findSubjectCode: real fixture — a course code mentioned only in prose is not treated as the subject code', () => {
  // The only "AERO 121"-shaped text in this captured class-detail panel is
  // inside the free-text Description field ("...Formerly AERO 121."); none
  // of the structured fields (Class Number, Components, etc.) carry a real
  // subject code. Trusting the prose mention would risk a wrong silent
  // match instead of a safe "ambiguous" fallback.
  assert.equal(findSubjectCode(instructorFields()[0]), undefined);
});

test('scan: renders a "none" badge when no professor matches', () => {
  const dl = document.createElement('dl');
  dl.innerHTML =
    '<dt>Instructor<span aria-hidden="true">:</span></dt><dd><span>Nobody Nowhere</span></dd>';
  document.body.appendChild(dl);

  scan(buildProfessorIndex([professor()]));

  const dd = dl.querySelector('dd');
  const badge = dd.querySelector('.polyratings-badge-host').shadowRoot.querySelector('a');
  assert.equal(badge.className, 'badge badge-none');
  assert.equal(badge.href, 'https://polyratings.dev/new-professor');
  dl.remove();
});

test('scan: renders an "ambiguous" badge listing candidates without silently guessing', () => {
  const dl = document.createElement('dl');
  dl.innerHTML =
    '<dt>Instructor<span aria-hidden="true">:</span></dt><dd><span>Smith,J</span></dd>';
  document.body.appendChild(dl);

  const index = buildProfessorIndex([
    professor({ id: 'a', firstName: 'James', lastName: 'Smith' }),
    professor({ id: 'b', firstName: 'John', lastName: 'Smith' }),
  ]);
  scan(index);

  const dd = dl.querySelector('dd');
  const badge = dd.querySelector('.polyratings-badge-host').shadowRoot.querySelector('a');
  assert.equal(badge.className, 'badge badge-ambiguous');
  assert.equal(badge.textContent, '2 matches');
  dl.remove();
});

test('findSubjectCode: finds a subject code when a field structurally contains one', () => {
  const dl = document.createElement('dl');
  dl.innerHTML =
    '<dt>Class Number<span aria-hidden="true">:</span></dt><dd>CSC 349-01</dd>' +
    '<dt>Instructor<span aria-hidden="true">:</span></dt><dd>Smith,J</dd>';
  const instructorDt = dl.querySelectorAll('dt')[1];
  assert.equal(findSubjectCode(instructorDt), 'CSC');
});
