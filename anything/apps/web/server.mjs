import { createRequestListener } from '@react-router/node';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Pool } from '@neondatabase/serverless';
import { verify } from 'argon2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const build = await import('./build/server/index.js');
const SECRET = process.env.AUTH_SECRET || '';

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

async function createJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  })).toString('base64url');
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${Buffer.from(sig).toString('base64url')}`;
}

async function verifyJWT(token) {
  try {
    const [header, body, sig] = token.split('.');
    const data = `${header}.${body}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('HMAC', key, Buffer.from(sig, 'base64url'), new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function getCookieValue(cookieHeader, name) {
  const match = (cookieHeader || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function handleAuth(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/api/auth/csrf') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ csrfToken: 'csrf-placeholder' }));
    return true;
  }

  if (path === '/api/auth/session') {
    const token = getCookieValue(req.headers.cookie, '__Secure-authjs.session-token') ||
                  getCookieValue(req.headers.cookie, 'authjs.session-token');
    if (!token) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
      return true;
    }
    const payload = await verifyJWT(token);
    if (!payload) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      user: { id: payload.sub, email: payload.email, name: payload.name },
      expires: new Date(payload.exp * 1000).toISOString(),
    }));
    return true;
  }

  if (path === '/api/auth/providers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 'credentials-signin': { id: 'credentials-signin', name: 'Credentials', type: 'credentials' } }));
    return true;
  }

  if (path === '/api/auth/signout') {
    res.writeHead(302, {
      'Location': '/account/signin',
      'Set-Cookie': 'authjs.session-token=; Path=/; HttpOnly; Max-Age=0',
    });
    res.end();
    return true;
  }

  if (path === '/api/auth/callback/credentials-signin' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    const email = params.get('email');
    const password = params.get('password');
    const callbackUrl = params.get('callbackUrl') || '/dashboard';

    if (!email || !password) {
      res.writeHead(302, { 'Location': '/account/signin?error=missing' });
      res.end();
      return true;
    }

    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const userResult = await pool.query('SELECT * FROM auth_users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        await pool.end();
        res.writeHead(302, { 'Location': '/account/signin?error=invalid' });
        res.end();
        return true;
      }
      const user = userResult.rows[0];
      const accountResult = await pool.query('SELECT * FROM auth_accounts WHERE "userId" = $1 AND provider = $2', [user.id, 'credentials']);
      if (accountResult.rows.length === 0) {
        await pool.end();
        res.writeHead(302, { 'Location': '/account/signin?error=invalid' });
        res.end();
        return true;
      }
      const isValid = await verify(accountResult.rows[0].password, password);
      await pool.end();
      if (!isValid) {
        res.writeHead(302, { 'Location': '/account/signin?error=invalid' });
        res.end();
        return true;
      }
      const token = await createJWT({ sub: String(user.id), email: user.email, name: user.name });
      const isSecure = process.env.NODE_ENV === 'production';
      const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
      const cookieFlags = isSecure
        ? `Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`
        : `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
      res.writeHead(302, {
        'Location': callbackUrl,
        'Set-Cookie': `${cookieName}=${token}; ${cookieFlags}`,
      });
      res.end();
      return true;
    } catch (err) {
      console.error('Auth error:', err);
      res.writeHead(302, { 'Location': '/account/signin?error=server' });
      res.end();
      return true;
    }
  }

  return false;
}

const rrListener = createRequestListener({ build, mode: 'production' });

const server = createServer(async (req, res) => {
  // Handle auth routes first
  if (req.url.startsWith('/api/auth/')) {
    const handled = await handleAuth(req, res);
    if (handled) return;
  }

  // Serve static files
  const staticPath = join(__dirname, 'build/client', req.url.split('?')[0]);
  if (existsSync(staticPath) && !staticPath.endsWith('/')) {
    const ext = extname(staticPath);
    const mime = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' });
    res.end(readFileSync(staticPath));
    return;
  }

  // React Router handles everything else
  return rrListener(req, res);
});

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
