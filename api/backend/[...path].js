const app = require('../../backend/app');

module.exports = (req, res) => {
  req.url = (req.url || '').replace(/^\/api\/backend/, '') || '/';
  return app(req, res);
};
