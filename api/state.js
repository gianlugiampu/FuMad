const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard, parseBalconyId } = require('../lib/board');

module.exports = async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const balcony = parseBalconyId(req.query && req.query.balcony);

  try {
    const { board } = await withClient((client) => withBoard(client, balcony, null));
    res.status(200).json({ ...board, you: username, balcony, serverTime: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
