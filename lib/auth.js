const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const COOKIE_NAME = 'fumad_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

function getSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET non impostata. Configurala nelle Environment Variables di Vercel.');
  }
  return process.env.JWT_SECRET;
}

function signToken(username) {
  return jwt.sign({ username }, getSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch (e) {
    return null;
  }
}

function getTokenFromReq(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parsed = cookie.parse(header);
  return parsed[COOKIE_NAME] || null;
}

function getUsernameFromReq(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload ? payload.username : null;
}

function setAuthCookie(res, token) {
  const secure = process.env.COOKIE_SECURE === 'true';
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: TOKEN_TTL_SECONDS
  }));
}

function clearAuthCookie(res) {
  const secure = process.env.COOKIE_SECURE === 'true';
  res.setHeader('Set-Cookie', cookie.serialize(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 0
  }));
}

function requireAuth(req, res) {
  const username = getUsernameFromReq(req);
  if (!username) {
    res.status(401).json({ error: 'Non autenticato.' });
    return null;
  }
  return username;
}

module.exports = {
  signToken,
  verifyToken,
  getUsernameFromReq,
  setAuthCookie,
  clearAuthCookie,
  requireAuth
};
