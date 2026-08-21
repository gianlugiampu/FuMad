const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard, startReservation } = require('../lib/board');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const { board } = await withClient((client) => withBoard(client, (b) => {
      startReservation(b, 'privacy', [username]);
    }));
    res.status(200).json(board);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
