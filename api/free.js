const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard } = require('../lib/board');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const username = requireAuth(req, res);
  if (!username) return;

  try {
    const { board } = await withClient((client) => withBoard(client, (b) => {
      const idx = b.seats.indexOf(username);
      if (idx === -1) {
        const err = new Error('Non hai un posto occupato.');
        err.statusCode = 409;
        throw err;
      }
      b.seats[idx] = null;
    }));
    res.status(200).json(board);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
