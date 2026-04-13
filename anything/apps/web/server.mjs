import { createRequestListener } from '@react-router/node';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const build = await import('./build/server/index.js');

const mimeTypes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

const rrListener = createRequestListener({ build, mode: 'production' });

const server = createServer(async (req, res) => {
  // Serve static files from build/client
  const staticPath = join(__dirname, 'build/client', req.url.split('?')[0]);
  if (existsSync(staticPath) && !staticPath.endsWith('/')) {
    const ext = extname(staticPath);
    const mime = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' });
    res.end(readFileSync(staticPath));
    return;
  }

  // Fall through to React Router
  return rrListener(req, res);
});

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
