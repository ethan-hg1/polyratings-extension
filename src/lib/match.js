// Pure functions: normalize/parse portal instructor names and match them
// against the cached Polyratings professor list. See .claude-docs/plan.md §4.2.

const PLACEHOLDER_NAMES = new Set(['', 'staff', 'tba', 'tbd']);

export function isPlaceholderName(raw) {
  return PLACEHOLDER_NAMES.has(raw.trim().toLowerCase());
}

// PeopleSoft renders instructor names as "Last,First" (search results table)
// or "First Last" (class detail dt/dd pair).
export function parsePortalName(raw) {
  if (isPlaceholderName(raw)) return null;
  const trimmed = raw.trim();

  if (trimmed.includes(',')) {
    const [last, first = ''] = trimmed.split(',').map((part) => part.trim());
    return { first, last };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

export function normalizeNamePart(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ') // punctuation/hyphens -> space, not deleted
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildProfessorIndex(professors) {
  const byLastName = new Map();
  for (const professor of professors) {
    const key = normalizeNamePart(professor.lastName);
    if (!byLastName.has(key)) byLastName.set(key, []);
    byLastName.get(key).push(professor);
  }
  return { byLastName };
}

function matchesSubject(professor, subjectCode) {
  const code = subjectCode.trim().toLowerCase();
  if (professor.department?.toLowerCase().includes(code)) return true;
  return professor.courses?.some((course) => course.toLowerCase().startsWith(code)) ?? false;
}

// Returns { status: 'match', professor } | { status: 'ambiguous', candidates }
// | { status: 'none' }. Never guesses among tied candidates.
export function matchInstructor(rawName, index, { subjectCode } = {}) {
  const parsed = parsePortalName(rawName);
  if (!parsed) return { status: 'none' };

  const candidates = index.byLastName.get(normalizeNamePart(parsed.last));
  if (!candidates?.length) return { status: 'none' };

  let filtered = candidates;
  const firstInitial = normalizeNamePart(parsed.first).charAt(0);
  if (firstInitial) {
    const byInitial = candidates.filter(
      (p) => normalizeNamePart(p.firstName).charAt(0) === firstInitial,
    );
    if (byInitial.length > 0) filtered = byInitial;
  }

  if (filtered.length === 1) return { status: 'match', professor: filtered[0] };

  if (filtered.length > 1 && subjectCode) {
    const bySubject = filtered.filter((p) => matchesSubject(p, subjectCode));
    if (bySubject.length === 1) return { status: 'match', professor: bySubject[0] };
    if (bySubject.length > 1) filtered = bySubject;
  }

  return { status: 'ambiguous', candidates: filtered };
}
