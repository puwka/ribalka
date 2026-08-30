/**
 * Download real stock photos and place them at paths from src/data/bases.js
 * Sources: burst.shopifycdn.com + GitLab project hero assets
 * Run: node scripts/fetch-catalog-photos.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { paidBases, freePlaces } from '../src/data/bases.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const poolDir = path.join(root, 'public', 'img', '_pool');

const BURST_SLUGS = [
  'clear-water-and-rock-formation',
  'man-fishing-on-shore',
  'lake-in-the-mountains',
  'fishing-on-a-lake',
  'fishing-rod-and-reel',
  'person-fishing-on-a-dock',
  'calm-lake-in-forest',
  'river-in-the-forest',
  'camping-by-the-lake',
  'fishing-on-the-pier',
  'mountain-lake-reflection',
  'fishing-boat-on-lake',
  'dock-on-a-lake',
  'fishing-in-a-river',
  'kayak-on-lake',
  'sunset-over-lake',
  'forest-lake',
  'fishing-gear',
  'man-fishing-in-river',
  'lake-with-mountains',
  'fishing-at-sunset',
  'wooden-dock-on-lake',
];

const GITLAB = 'https://gitlab.com/mokrushin3/rybalka/-/raw/main/public/img/hero';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);

    const req = https.get(url, { headers: { 'User-Agent': 'rybalka-fetch/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(() => {
          fs.unlink(dest, () => download(res.headers.location, dest).then(resolve).catch(reject));
        });
        return;
      }
      if (res.statusCode !== 200) {
        file.close(() => {
          fs.unlink(dest, () => reject(new Error(`HTTP ${res.statusCode}`)));
        });
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          try {
            const size = fs.statSync(dest).size;
            if (size < 10000) {
              fs.unlinkSync(dest);
              reject(new Error(`Too small (${size}b)`));
            } else {
              resolve();
            }
          } catch (err) {
            reject(err);
          }
        });
      });
    });

    req.on('error', (err) => {
      file.close(() => {
        fs.unlink(dest, () => reject(err));
      });
    });
  });
}

function isValidFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 10000;
}

async function ensurePool() {
  fs.mkdirSync(poolDir, { recursive: true });
  const pool = [];

  // Reuse files from earlier discovery in _pool/*.jpg
  for (const entry of fs.readdirSync(poolDir)) {
    const full = path.join(poolDir, entry);
    if (entry.endsWith('.jpg') && isValidFile(full)) pool.push(full);
  }

  for (let i = 0; i < BURST_SLUGS.length; i++) {
    const dest = path.join(poolDir, `burst-${i + 1}.jpg`);
    if (!isValidFile(dest)) {
      const url = `https://burst.shopifycdn.com/photos/${BURST_SLUGS[i]}.jpg?width=960`;
      process.stdout.write(`download burst ${i + 1}… `);
      try {
        await download(url, dest);
        console.log('ok');
      } catch (e) {
        console.log('skip', e.message);
        continue;
      }
    }
    if (isValidFile(dest) && !pool.includes(dest)) pool.push(dest);
  }

  for (const [name, file] of [
    ['gitlab-header.jpeg', 'header-img.jpeg'],
    ['gitlab-rybak.jpg', 'rybak.jpg'],
    ['gitlab-saby.jpg', 'saby.jpg'],
  ]) {
    const dest = path.join(poolDir, name);
    if (!isValidFile(dest)) {
      process.stdout.write(`download ${name}… `);
      try {
        await download(`${GITLAB}/${file}`, dest);
        console.log('ok');
      } catch (e) {
        console.log('skip', e.message);
        continue;
      }
    }
    if (isValidFile(dest) && !pool.includes(dest)) pool.push(dest);
  }

  return pool;
}

function collectPaths() {
  const paths = [];
  for (const item of [...paidBases, ...freePlaces]) {
    for (const img of item.images || []) paths.push(img);
  }
  paths.push('/img/hero/header-img.jpeg', '/img/hero/rybak.jpg', '/img/hero/saby.jpg');
  return [...new Set(paths)];
}

async function main() {
  const pool = await ensurePool();
  if (!pool.length) {
    console.error('No images in pool');
    process.exit(1);
  }
  console.log(`Pool: ${pool.length} images`);

  const targets = collectPaths();
  for (let i = 0; i < targets.length; i++) {
    const rel = targets[i];
    const dest = path.join(root, 'public', rel.replace(/^\//, ''));
    let src;
    if (rel === '/img/hero/header-img.jpeg') src = path.join(poolDir, 'gitlab-header.jpeg');
    else if (rel === '/img/hero/rybak.jpg') src = path.join(poolDir, 'gitlab-rybak.jpg');
    else if (rel === '/img/hero/saby.jpg') src = path.join(poolDir, 'gitlab-saby.jpg');
    else src = pool[i % pool.length];
    if (!isValidFile(src)) src = pool[i % pool.length];
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`→ ${rel}`);
  }

  const covers = {};
  for (const item of [...paidBases, ...freePlaces]) {
    covers[item.id] = [...(item.images || [])];
  }

  fs.writeFileSync(
    path.join(root, 'src', 'data', 'catalogImageCovers.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'burst.shopifycdn.com + gitlab hero assets',
        covers,
        hero: '/img/hero/header-img.jpeg',
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`\nDone: ${targets.length} catalog image files`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
