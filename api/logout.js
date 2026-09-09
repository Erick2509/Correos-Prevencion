const { clearTokenCookie } = require('./_lib');

module.exports = (req, res) => {
  clearTokenCookie(res);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
};
