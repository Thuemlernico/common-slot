import express, { type NextFunction, type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ZodError } from 'zod';
import { compareAvailability } from './api/compare.js';
import { compareRequestSchema } from './api/schema.js';
import { ProviderAvailabilityExtractor } from './providers/router.js';
import type { AvailabilityExtractor } from './providers/types.js';

export interface AppDependencies { extractor?: AvailabilityExtractor }

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const extractor = dependencies.extractor ?? new ProviderAvailabilityExtractor();
  const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
  let activeComparisons = 0;

  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin'
    });
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.post('/api/compare', async (request, response, next) => {
    if (activeComparisons >= 2) {
      response.status(429).set('Retry-After', '10').json({ error: 'The comparison service is busy; retry shortly' });
      return;
    }
    activeComparisons += 1;
    try {
      const input = compareRequestSchema.parse(request.body);
      response.set('Cache-Control', 'no-store');
      response.json(await compareAvailability(input, extractor));
    } catch (error) { next(error); }
    finally { activeComparisons -= 1; }
  });

  app.use(express.static(publicDirectory, { etag: true, maxAge: '1h', index: 'index.html' }));
  app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found' }));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({ error: 'Invalid comparison request', issues: error.issues.map(({ path: issuePath, message }) => ({ path: issuePath.join('.'), message })) });
      return;
    }
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    console.error('Request failed without logging submitted booking links');
    response.status(500).json({ error: 'The comparison could not be completed' });
  });
  return app;
}
