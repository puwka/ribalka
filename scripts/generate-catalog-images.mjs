/**
 * Generates local SVG cover images for catalog items (no network).
 * Run: node scripts/generate-catalog-images.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { paidBases, freePlaces } from '../src/data/bases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'img', 'catalog');

const PALETTES = [
  ['#1e3a5f', '#3d6b8e', '#7eb8da'],
  ['#0f3d3e', '#2d6a6f', '#6ba3a8'],
  ['#1a365d', '#2c5282', '#63b3ed'],
  ['#234e52', '#285e61', '#4fd1c5'],
  ['#2d3748', '#4a5568', '#90cdf4'],
  ['#1c4532', '#276749', '#68d391'],
  ['#2c3e50', '#34495e', '#5dade2'],
  ['#1b4332', '#2d6a4f', '#95d5b2'],
  ['#003049', '#669bbc', '#c1121f'],
  ['#14213d', '#fca311', '#e5e5e5'],
  ['#184e77', '#1e6091', '#52b69a'],
  ['#354f52', '#52796f', '#84a98c'],
  ['#03045e', '#0077b6', '#90e0ef'],
  ['#264653', '#2a9d8f', '#e9c46a'],
  ['#1b263b', '#415a77', '#778da9'],
  ['#003566', '#001d3d', '#ffc300'],
  ['#0d1b2a', '#1b263b', '#415a77'],
  ['#2b2d42', '#8d99ae', '#edf2f4'],
  ['#006d77', '#83c5be', '#edf6f9'],
  ['#3d405b', '#81b29a', '#f2cc8f'],
  ['#4a5759', '#b0c4b1', '#dedbd2'],
  ['#588157', '#3a5a40', '#a3b18a'],
  ['#6b705c', '#a5a58d', '#ddbea9'],
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeSvg(id, title, paletteIndex) {
  const [deep, mid, light] = PALETTES[paletteIndex % PALETTES.length];
  const shortTitle = escapeXml(title.length > 42 ? `${title.slice(0, 40)}…` : title);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600" role="img" aria-label="${shortTitle}">
  <defs>
    <linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="55%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${deep}"/>
    </linearGradient>
    <linearGradient id="water-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${deep}"/>
      <stop offset="100%" stop-color="${mid}"/>
    </linearGradient>
  </defs>
  <rect width="960" height="600" fill="url(#sky-${id})"/>
  <path d="M0 340 Q240 300 480 330 T960 320 L960 600 L0 600 Z" fill="url(#water-${id})" opacity="0.95"/>
  <path d="M0 360 Q200 390 400 370 T800 385 T960 375 L960 600 L0 600 Z" fill="${deep}" opacity="0.35"/>
  <text x="32" y="560" fill="#ffffff" font-family="Rubik, Arial, sans-serif" font-size="22" font-weight="600" opacity="0.92">${shortTitle}</text>
</svg>`;
}

function writeCover(type, item, index) {
  const filename = `${type}-${item.id}-cover.svg`;
  const filepath = path.join(outDir, filename);
  fs.writeFileSync(filepath, makeSvg(item.id, item.name, index), 'utf8');
  return `/img/catalog/${filename}`;
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'public', 'img', 'hero'), { recursive: true });

const mapping = {};

paidBases.forEach((item, i) => {
  const cover = writeCover('paid', item, i);
  mapping[item.id] = [cover, ...item.images];
});

freePlaces.forEach((item, i) => {
  const cover = writeCover('free', item, i + paidBases.length);
  mapping[item.id] = [cover, ...item.images];
});

// Hero
const heroSvg = makeSvg('hero', 'Пермский край', 8);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'img', 'hero', 'header-img.svg'), heroSvg, 'utf8');

const manifest = {
  generatedAt: new Date().toISOString(),
  note: 'Local SVG covers until original photos are restored to public/img/bases and public/img/free',
  covers: mapping,
  hero: '/img/hero/header-img.svg',
};

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'data', 'catalogImageCovers.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

console.log(`Generated ${Object.keys(mapping).length} catalog covers + hero`);
console.log('Manifest: src/data/catalogImageCovers.json');
