function requireApiVersion(req, res, next) {
  const version = req.headers['x-api-version'];
  if (!version) {
    return res.status(400).json({ status: 'error', message: 'API version header required' });
  }
  if (version !== '1') {
    return res.status(400).json({ status: 'error', message: 'Unsupported API version' });
  }
  next();
}

module.exports = { requireApiVersion };