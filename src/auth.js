// Autenticazione JWT: login via email+password (hash bcrypt in Postgres),
// token firmato con JWT_SECRET, verificato su ogni richiesta /api/* tranne
// /api/auth/login. Nessuna sessione lato server: il token stesso, con
// scadenza, è l'unico stato.

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET non impostata (vedi .env)');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

// Blocca ogni rotta protetta se manca un Bearer token valido. Applicato a
// tutte le /api/* tranne /api/auth/login (montato prima di questo middleware).
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'Autenticazione richiesta.' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Sessione scaduta o non valida.' });
  }
}

module.exports = { signToken, verifyToken, checkPassword, hashPassword, requireAuth };
