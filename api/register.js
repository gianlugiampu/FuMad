const bcrypt = require('bcryptjs');
const { withClient } = require('../lib/db');
const { signToken, setAuthCookie } = require('../lib/auth');
const { getClientIp, checkRateLimit } = require('../lib/rateLimit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  let { username, password, inviteCode } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori.' });
  }
  username = typeof username === 'string' ? username.trim() : username;
  if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'Username deve avere tra 3 e 32 caratteri.' });
  }
  if (!/^[\p{L}\p{N} _.-]+$/u.test(username)) {
    return res.status(400).json({ error: 'Username puo contenere solo lettere, numeri, spazi, underscore, punto e trattino.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password deve avere almeno 8 caratteri.' });
  }
  if (process.env.REGISTER_INVITE_CODE && inviteCode !== process.env.REGISTER_INVITE_CODE) {
    return res.status(403).json({ error: 'Codice di invito non valido.' });
  }

  try {
    const usernameLower = username.toLowerCase();
    const passwordHash = bcrypt.hashSync(password, 12);

    await withClient(async (client) => {
      await checkRateLimit(client, 'register:' + getClientIp(req), 10);
      const existing = await client.query('SELECT id FROM users WHERE username_lower = $1', [usernameLower]);
      if (existing.rows.length > 0) {
        const err = new Error('Username gia registrato.');
        err.statusCode = 409;
        throw err;
      }
      await client.query(
        'INSERT INTO users (username, username_lower, password_hash) VALUES ($1, $2, $3)',
        [username, usernameLower, passwordHash]
      );
    });

    const token = signToken(username);
    setAuthCookie(res, token);
    res.status(200).json({ username });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
