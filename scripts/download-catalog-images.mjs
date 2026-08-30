/**
 * Downloads catalog images to public/img/ paths referenced in src/data/bases.js
 * Run: node scripts/download-catalog-images.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** Unsplash — nature, lakes, rivers, fishing (free to use) */
const POOL = [
  'photo-1506905925346-21bda4d32df4',
  'photo-1473448912268-2022ce9509b8',
  'photo-1439066615861-d1af74d74000',
  'photo-1470071459604-3b5ec3a7fe05',
  'photo-1493246507139-91e8fad9978e',
  'photo-1519501025264-65ba15a82390',
  'photo-1464822759023-f7d0b85f3c0b',
  'photo-1501597349823-ef187e45ab58',
  'photo-1559827263-fc2590bccdfa',
  'photo-1540206351-d0b7434f4393',
  'photo-1500375161778-6d7bb0b5172a',
  'photo-1469474968028-56623f02e42e',
  'photo-1513836279017-97f1f8041468',
  'photo-1527487826081-302bd10983e6',
  'photo-1418069780489-7ce4694efb7a',
  'photo-1544551763-46a013bb70d5',
  'photo-1519048042101-7d7b4ae0500b',
  'photo-1509316785289-025f5b846b8e',
  'photo-1441974231531-c6227db76b6e',
  'photo-1532274402916-9a07f331fee6',
  'photo-1518173946687-a4c036bcab3b',
  'photo-1501785888041-af3ef285b470',
  'photo-1483728642382-8a3bfae89137',
  'photo-1454496526348-38a376e06861',
  'photo-1472214103451-9374bd1c798e',
];

const CATALOG_PATHS = [
  ...Array.from({ length: 20 }, (_, i) => {
    const id = i + 1;
    const paths = [`/img/bases/base-${id}-1.jpg`, `/img/bases/base-${id}-2.jpg`];
    if ([1, 3, 10, 16, 20].includes(id)) paths.push(`/img/bases/base-${id}-3.jpg`);
    return paths;
  }).flat(),
  '/img/free/free-101-1.jpg',
  '/img/free/free-101-2.jpg',
  '/img/free/free-102-1.jpg',
  '/img/free/free-102-2.jpg',
  '/img/free/free-103-1.jpg',
  '/img/free/free-103-2.jpg',
  '/img/hero/header-img.jpeg',
  '/img/hero/rybak.jpg',
  '/img/hero/saby.jpg',
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const request = https.get(url, { headers: { 'User-Agent': 'rybalka-catalog/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    request.on('error', reject);
    file.on('error', reject);
  });
}

async function main() {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < CATALOG_PATHS.length; i++) {
    const rel = CATALOG_PATHS[i];
    const dest = path.join(root, 'public', rel.replace(/^\//, ''));
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log(`skip ${rel}`);
      ok++;
      continue;
    }
    const photo = POOL[i % POOL.length];
    const url = `https://images.unsplash.com/${photo}?w=960&q=85&fm=jpg`;
    try {
      await download(url, dest);
      console.log(`ok   ${rel}`);
      ok++;
    } catch (err) {
      console.error(`fail ${rel}:`, err.message);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
