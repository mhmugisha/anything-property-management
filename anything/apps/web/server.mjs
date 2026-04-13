import { createRequestHandler } from '@react-router/node';
import { createServer } from 'node:http';

const port = Number(process.env.PORT) || 3000;

const handler = createRequestHandler(
  () => import('./build/server/index.js'),
  'production'
);

const server = createServer(async (req, res) => {
  try {
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? null : req,
    });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.arrayBuffer());
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
