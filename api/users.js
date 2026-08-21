const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const users = await withClient(async (client) => {
      const { rows } = await client.query(
        'SELECT username FROM users WHERE username_lower != $1 ORDER BY username_lower',
        [username.toLowerCase()]
      );
      return rows.map((r) => r.username);
    });
    res.status(200).json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
