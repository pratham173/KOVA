import type { IncomingMessage, ServerResponse } from 'node:http';
import type express from 'express';
import { createApiApp } from './app.ts';
import { normalizeVercelApiUrl } from './vercelUrl.ts';

let cachedApp: express.Express | null = null;
let initError: Error | null = null;

function getApp(): express.Express {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (initError) {
      throw initError;
    }
    const app = getApp();
    req.url = normalizeVercelApiUrl(req.url);
    return app(req as express.Request, res as express.Response);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (!cachedApp) {
      initError = error;
    }
    console.error('Vercel API handler error:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: `API initialization error: ${error.message}`,
        })
      );
    }
  }
}
