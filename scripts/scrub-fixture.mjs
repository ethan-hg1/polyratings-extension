#!/usr/bin/env node
// Scrub PII from saved Cal Poly portal captures before they are committed as
// test fixtures (see .claude-docs/plan.md §8).
//
// The HighPoint shell embeds the logged-in student's identity in a base64
// `window.highpoint = JSON.parse(decodeURIComponent(escape(atob(`...`))))`
// blob. This script decodes every atob(`...`) blob it finds, redacts the
// identifying fields, replaces every other occurrence of those values anywhere
// in the JSON (menu URLs embed the student ID), re-encodes, and additionally
// replaces any plaintext/URL-encoded occurrences in the rest of the document.
//
// Usage: node scripts/scrub-fixture.mjs <input.html> <output.html>

import { readFileSync, writeFileSync } from 'node:fs';

const REDACTIONS = {
  student_id: '000000000',
  student_name: 'Redacted Student',
  student_avatar_initials: 'RS',
  photo: '',
};

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/scrub-fixture.mjs <input.html> <output.html>');
  process.exit(1);
}

const decode = (b64) => Buffer.from(b64, 'base64').toString('utf8');
const encode = (str) => Buffer.from(str, 'utf8').toString('base64');

// Values discovered in the blobs, so plaintext occurrences elsewhere in the
// document can be scrubbed too.
const foundValues = new Set();

function replaceEverywhere(str, value, replacement) {
  if (!value) return str;
  for (const variant of [value, encodeURIComponent(value)]) {
    str = str.split(variant).join(replacement);
  }
  return str;
}

function scrubBlob(b64) {
  let json;
  try {
    json = JSON.parse(decode(b64));
  } catch {
    return b64; // not JSON — leave untouched
  }
  for (const [key, replacement] of Object.entries(REDACTIONS)) {
    const value = json[key];
    if (typeof value === 'string' && value && value !== replacement) {
      foundValues.add(value);
    }
    if (key in json) json[key] = replacement;
  }
  // The student ID also appears inside menu/link URLs throughout the blob.
  let text = JSON.stringify(json);
  for (const value of foundValues) {
    text = replaceEverywhere(text, value, '[REDACTED]');
  }
  return encode(text);
}

let html = readFileSync(input, 'utf8');
let blobs = 0;
html = html.replace(/atob\(`([A-Za-z0-9+/=]+)`\)/g, (_, b64) => {
  blobs++;
  return 'atob(`' + scrubBlob(b64) + '`)';
});

for (const value of foundValues) {
  html = replaceEverywhere(html, value, '[REDACTED]');
}

writeFileSync(output, html);

// Verify: no discovered value survives anywhere, including inside re-decoded blobs.
const decodedAll = html.replace(/atob\(`([A-Za-z0-9+/=]+)`\)/g, (_, b64) => decode(b64));
for (const value of foundValues) {
  if (html.includes(value) || decodedAll.includes(value)) {
    console.error(`FAILED: "${value.slice(0, 3)}…" still present in output`);
    process.exit(1);
  }
}
console.log(`Scrubbed ${blobs} blob(s); redacted ${foundValues.size} value(s): ${output}`);
