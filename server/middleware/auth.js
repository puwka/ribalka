import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'dev-change-me-in-production';

export function signToken(payload) {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, secret);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = verifyToken(token);
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user?.sub) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  const roles = req.user?.roles || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
