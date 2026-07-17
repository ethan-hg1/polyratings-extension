import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePortalName,
  normalizeNamePart,
  buildProfessorIndex,
  matchInstructor,
} from '../src/lib/match.js';

function professor(overrides) {
  return {
    id: 'id',
    firstName: 'First',
    lastName: 'Last',
    department: 'Some Department',
    overallRating: 3.5,
    numEvals: 10,
    courses: [],
    ...overrides,
  };
}

test('parsePortalName: Last,First form', () => {
  assert.deepEqual(parsePortalName('Abercromby,Kira'), { first: 'Kira', last: 'Abercromby' });
});

test('parsePortalName: First Last form', () => {
  assert.deepEqual(parsePortalName('Kira Abercromby'), { first: 'Kira', last: 'Abercromby' });
});

test('parsePortalName: placeholders return null', () => {
  assert.equal(parsePortalName('Staff'), null);
  assert.equal(parsePortalName('TBA'), null);
  assert.equal(parsePortalName('tba'), null);
  assert.equal(parsePortalName('  '), null);
  assert.equal(parsePortalName(''), null);
});

test('normalizeNamePart: strips diacritics, punctuation, and case', () => {
  assert.equal(normalizeNamePart('García'), 'garcia');
  assert.equal(normalizeNamePart('Smith-Jones'), 'smith jones');
  assert.equal(normalizeNamePart('  De   La Cruz '), 'de la cruz');
});

test('matchInstructor: exact single match', () => {
  const index = buildProfessorIndex([professor({ id: '1', firstName: 'Kira', lastName: 'Abercromby' })]);
  const result = matchInstructor('Abercromby,Kira', index);
  assert.equal(result.status, 'match');
  assert.equal(result.professor.id, '1');
});

test('matchInstructor: nickname mismatch on first name matches by initial', () => {
  const index = buildProfessorIndex([professor({ id: '1', firstName: 'Michael', lastName: 'Haungs' })]);
  const result = matchInstructor('Mike Haungs', index);
  assert.equal(result.status, 'match');
  assert.equal(result.professor.id, '1');
});

test('matchInstructor: hyphenated last name', () => {
  const index = buildProfessorIndex([professor({ id: '1', firstName: 'Anna', lastName: 'Smith-Jones' })]);
  const result = matchInstructor('Smith-Jones,Anna', index);
  assert.equal(result.status, 'match');
  assert.equal(result.professor.id, '1');
});

test('matchInstructor: two-word last name', () => {
  const index = buildProfessorIndex([professor({ id: '1', firstName: 'Maria', lastName: 'De La Cruz' })]);
  const result = matchInstructor('De La Cruz,Maria', index);
  assert.equal(result.status, 'match');
  assert.equal(result.professor.id, '1');
});

test('matchInstructor: diacritics normalized on both sides', () => {
  const index = buildProfessorIndex([professor({ id: '1', firstName: 'José', lastName: 'García' })]);
  const result = matchInstructor('Garcia,Jose', index);
  assert.equal(result.status, 'match');
  assert.equal(result.professor.id, '1');
});

test('matchInstructor: shared last name disambiguated by subject code', () => {
  const index = buildProfessorIndex([
    professor({
      id: 'csc',
      firstName: 'James',
      lastName: 'Smith',
      department: 'Computer Science',
      courses: ['CSC 101', 'CSC 202'],
    }),
    professor({
      id: 'math',
      firstName: 'Jane',
      lastName: 'Smith',
      department: 'Mathematics',
      courses: ['MATH 141'],
    }),
  ]);
  const result = matchInstructor('Smith,J', index, { subjectCode: 'CSC' });
  assert.equal(result.status, 'match');
  assert.equal(result.professor.id, 'csc');
});

test('matchInstructor: ambiguous ties are never silently guessed', () => {
  const index = buildProfessorIndex([
    professor({ id: 'a', firstName: 'James', lastName: 'Smith' }),
    professor({ id: 'b', firstName: 'John', lastName: 'Smith' }),
  ]);
  const result = matchInstructor('Smith,J', index);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.candidates.length, 2);
});

test('matchInstructor: Staff and TBA are skipped', () => {
  const index = buildProfessorIndex([professor({ id: '1', lastName: 'Staff' })]);
  assert.equal(matchInstructor('Staff', index).status, 'none');
  assert.equal(matchInstructor('TBA', index).status, 'none');
});

test('matchInstructor: unknown last name returns none', () => {
  const index = buildProfessorIndex([professor({ id: '1', lastName: 'Abercromby' })]);
  const result = matchInstructor('Nobody,Nowhere', index);
  assert.equal(result.status, 'none');
});
