import express from 'express';
import { apiRouter } from './routes.ts';
import { applyPrivateNoStore } from './cacheHeaders.ts';

export function createApiApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('etag', 'strong');

  // Security headers and safe private default for all API responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/api', (_req, res, next) => {
    applyPrivateNoStore(res);
    next();
  });

  // Capture raw request body for Razorpay webhook HMAC verification
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Mount API routes
  app.use('/api', apiRouter);

  // Return clean JSON 404 for unknown API endpoints instead of HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global JSON error handler for API requests
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (req.path.startsWith('/api')) {
        console.error('Unhandled API error:', err);
        res.status(500).json({ error: 'Internal server error.' });
        return;
      }
      next(err);
    }
  );

  return app;
}
