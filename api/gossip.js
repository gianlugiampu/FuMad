const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard, startReservation, parseBalconyId } = require('../lib/board');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito.' });
  }
  const username = requireAuth(req, res);
  if (!username) return;
  const balcony = parseBalconyId(req.body && req.body.balcony);

  let { members } = req.body || {};
  if (!Array.isArray(members)) members = [];
  members = Array.from(new Set(members.filter((m) => typeof m === 'string' && m !== username)));
  if (members.length === 0) {
    return res.status(400).json({ error: 'Seleziona almeno un altro utente da invitare.' });
  }

  try {
    const { board } = await withClient(async (client) => {
      const { rows } = await client.query('SELECT username FROM users WHERE username = ANY($1)', [members]);
      if (rows.length !== members.length) {
        const err = new Error('Uno o piu utenti selezionati non esistono.');
        err.statusCode = 400;
        throw err;
      }
      return withBoard(client, balcony, (b) => {
        startReservation(b, 'gossip', [username].concat(members));
      });
    });
    res.status(200).json({ ...board, balcony });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
