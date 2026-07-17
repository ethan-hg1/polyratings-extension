#!/usr/bin/env node
// Assembles dist/chrome and dist/firefox and zips each. See
// .claude-docs/plan.md §4.4.
//
// content.js ships as a single classic script (content_scripts entries can't
// use static `import`), so its lib/ dependencies are inlined here rather than
// referenced at runtime. background.js runs as a real ES module (manifest
// declares "type": "module"), so it keeps its imports and lib/ is copied
// alongside it as-is.

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const { version } = pkg;

const BROWSERS = ['chrome', 'firefox'];

function stripModuleSyntax(source) {
  return source.replace(/^import\s+.*?;\s*$/gm, '').replace(/^export\s+/gm, '');
}

function buildFlattenedContentScript() {
  const libDir = path.join(root, 'src', 'lib');
  const libSources = ['api.js', 'cache.js', 'match.js'].map((file) =>
    stripModuleSyntax(readFileSync(path.join(libDir, file), 'utf8')),
  );
  const contentSource = stripModuleSyntax(readFileSync(path.join(root, 'src', 'content.js'), 'utf8'));
  return [...libSources, contentSource].join('\n');
}

function checkVersionsMatch() {
  for (const browser of BROWSERS) {
    const manifestPath = path.join(root, 'manifests', `manifest.${browser}.json`);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.version !== version) {
      throw new Error(
        `manifest.${browser}.json version (${manifest.version}) does not match package.json (${version})`,
      );
    }
  }
}

function zipDir(dir, outFile) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(dir, false);
    archive.finalize();
  });
}

async function buildBrowser(browser) {
  const outDir = path.join(root, 'dist', browser);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  writeFileSync(path.join(outDir, 'content.js'), buildFlattenedContentScript());
  cpSync(path.join(root, 'src', 'background.js'), path.join(outDir, 'background.js'));
  cpSync(path.join(root, 'src', 'lib'), path.join(outDir, 'lib'), { recursive: true });
  cpSync(path.join(root, 'icons'), path.join(outDir, 'icons'), {
    recursive: true,
    filter: (src) => !src.endsWith('.svg'),
  });
  cpSync(path.join(root, 'manifests', `manifest.${browser}.json`), path.join(outDir, 'manifest.json'));

  const zipPath = path.join(root, 'dist', `polyratings-${browser}-${version}.zip`);
  await zipDir(outDir, zipPath);
  console.log(`Built dist/${browser} -> ${path.relative(root, zipPath)}`);
}

checkVersionsMatch();
mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const browser of BROWSERS) {
  await buildBrowser(browser);
}
