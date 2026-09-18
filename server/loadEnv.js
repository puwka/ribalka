import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Project-root .env — works even when pm2 cwd ≠ project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
