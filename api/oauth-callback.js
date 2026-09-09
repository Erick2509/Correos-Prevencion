const { exchangeCodeForTokens, setTokenCookie } = require('./_lib');

module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    res.writeHead(302, { Location: '/?auth=error' });
    return res.end();
  }

  try {
    const tokens = await exchangeCodeForTokens(code, req);
    setTokenCookie(
      res,
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      },
      60 * 60 * 24 * 30
    );
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    res.writeHead(302, { Location: '/?auth=error' });
    res.end();
  }
};
