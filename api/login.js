const bcrypt = require('bcryptjs');
const { withClient } = require('../lib/db');
const { signToken, setAuthCookie } = require('../lib/auth');
const { getClientIp, checkRateLimit } = require('../lib/rateLimit');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori.' });
  }

  try {
    const usernameLower = username.toLowerCase();
    const user = await withClient(async (client) => {
      await checkRateLimit(client, 'login:' + getClientIp(req), 10);
      const { rows } = await client.query(
        'SELECT username, password_hash FROM users WHERE username_lower = $1',
        [usernameLower]
      );
      return rows[0] || null;
    });

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenziali non valide.' });
    }

    const token = signToken(user.username);
    setAuthCookie(res, token);
    res.status(200).json({ username: user.username });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
