const bcrypt = require('bcryptjs');
const { withClient } = require('../lib/db');
const { signToken, setAuthCookie } = require('../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori.' });
  }
  if (typeof username !== 'string' || username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'Username deve avere tra 3 e 32 caratteri.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password deve avere almeno 8 caratteri.' });
  }

  try {
    const usernameLower = username.toLowerCase();
    const passwordHash = bcrypt.hashSync(password, 12);

    await withClient(async (client) => {
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
