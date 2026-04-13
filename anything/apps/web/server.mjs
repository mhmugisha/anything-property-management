import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { createRequestHandler } from 'react-router';

const app = new Hono();

// Serve static assets
app.use('/assets/*', serveStatic({ root: './build/client' }));
app.use('/favicon.ico', serveStatic({ root: './build/client' }));
app.use('*', serveStatic({ root: './build/client', rewriteRequestPath: (path) => path }));

// Handle all other requests with React Router
app.all('*', async (c) => {
  const handler = createRequestHandler(
    () => import('./build/server/index.js'),
    'production'
  );
  return handler(c.req.raw);
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server started on port ${info.port}`);
});
