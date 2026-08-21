const { requireAuth } = require('../lib/auth');

module.exports = async (req, res) => {
  const username = requireAuth(req, res);
  if (!username) return;
  res.status(200).json({ username });
};
