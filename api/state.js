const { withClient } = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { withBoard, parseBalconyId } = require('../lib/board');
const { getHeatAlert } = require('../lib/globalState');

module.exports = async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  const balcony = parseBalconyId(req.query && req.query.balcony);

  try {
    const { board, heatAlert } = await withClient(async (client) => {
      const { board } = await withBoard(client, balcony, null);
      const heatAlert = await getHeatAlert(client);
      return { board, heatAlert };
    });
    res.status(200).json({ ...board, you: username, balcony, heatAlert, serverTime: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Errore imprevisto.' });
  }
};
