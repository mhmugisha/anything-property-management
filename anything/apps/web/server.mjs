import { createRequestListener } from '@react-router/node';
import { createServer } from 'node:http';

const port = Number(process.env.PORT) || 3000;

const build = await import('./build/server/index.js');

const listener = createRequestListener(() => build, { build });

const server = createServer(listener);

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
