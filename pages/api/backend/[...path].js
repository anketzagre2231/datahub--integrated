import app from '../../../backend/app';

export const config = {
  api: {
    externalResolver: true,
    bodyParser: false,
    responseLimit: false,
  },
  maxDuration: 30, // Allow up to 30s for QuickBooks API calls
};

export default function handler(req, res) {
  req.url = (req.url || '').replace(/^\/api\/backend/, '') || '/';
  return app(req, res);
}
