import { createRequestListener } from '@react-router/node';
import { createServer } from 'node:http';

const port = Number(process.env.PORT) || 3000;

const server = createServer(
  createRequestListener(() => import('./build/server/index.js'))
);

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
