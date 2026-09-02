import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { authMiddleware, requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const bucket = req.params.bucket || 'misc';
    const dir = path.join(uploadRoot, bucket, req.user.sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '') || '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

const router = Router();

router.post('/:bucket', authMiddleware, requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const bucket = req.params.bucket;
  const relative = path.join(bucket, req.user.sub, req.file.filename).replace(/\\/g, '/');
  const publicUrl = `/uploads/${relative}`;
  res.status(201).json({ path: `${req.user.sub}/${req.file.filename}`, publicUrl });
});

export default router;
