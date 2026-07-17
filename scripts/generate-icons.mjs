#!/usr/bin/env node
// Rasterizes icons/icon.svg into the PNG sizes the manifests reference.
// Run manually after editing icon.svg: npm run icons

import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const iconsDir = path.dirname(fileURLToPath(import.meta.url)).replace(/scripts$/, 'icons');
const svg = readFileSync(path.join(iconsDir, 'icon.svg'));

const sizes = [16, 32, 48, 96, 128];

await Promise.all(
  sizes.map((size) =>
    sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`)),
  ),
);

console.log(`Generated ${sizes.join(', ')} px icons in ${iconsDir}`);
