import app from '../../../backend/app';

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false,
  },
};

export default function handler(req, res) {
  req.url = (req.url || '').replace(/^\/api\/backend/, '') || '/';
  return app(req, res);
}
