const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard } = require('../lib/board');

module.exports = async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const { board } = await withClient((client) => withBoard(client, null));
    res.status(200).json({ ...board, you: username, serverTime: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
