import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import basesRoutes from './routes/bases.js';
import newsRoutes from './routes/news.js';
import uploadRoutes from './routes/uploads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/bases', basesRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', express.static(uploadDir));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT} (uploads: ${uploadDir})`);
});
