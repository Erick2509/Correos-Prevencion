const { getTokenFromReq } = require('./_lib');

module.exports = (req, res) => {
  const tok = getTokenFromReq(req);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ connected: !!tok }));
};
