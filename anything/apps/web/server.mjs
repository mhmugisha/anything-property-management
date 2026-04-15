import { createRequestListener } from '@react-router/node';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Pool } from '@neondatabase/serverless';
import { verify } from 'argon2';
import { createJWT, verifyJWT, getCookieValue } from './src/app/api/utils/jwt.js';

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

// CSRF: double-submit cookie pattern.
// The cookie holds `rawToken|hmac(rawToken)`. The form body holds rawToken.
// On validation we re-derive the HMAC and do a timing-safe comparison.
async function generateCsrfToken() {
  const secret = process.env.AUTH_SECRET || '';
  const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hash = Buffer.from(sig).toString('hex');
  return { token: raw, cookieValue: `${raw}|${hash}` };
}

async function verifyCsrfToken(token, cookieValue) {
  if (!token || !cookieValue) return false;
  const pipeIndex = cookieValue.lastIndexOf('|');
  if (pipeIndex === -1) return false;
  const storedToken = cookieValue.slice(0, pipeIndex);
  const storedHash = cookieValue.slice(pipeIndex + 1);
  if (token !== storedToken) return false;
  const secret = process.env.AUTH_SECRET || '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token));
  const expectedHash = Buffer.from(sig).toString('hex');
  // Timing-safe comparison
  if (storedHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    diff |= storedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

function nodeRequestToWebRequest(req, body) {
  const url = `https://${req.headers.host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  return new Request(url, {
    method: req.method,
    headers,
    ...(body && body.length > 0 ? { body } : {}),
  });
}

async function handleAuth(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/api/auth/csrf') {
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
    const cookieName = isSecure ? '__Secure-authjs.csrf-token' : 'authjs.csrf-token';
    const { token, cookieValue } = await generateCsrfToken();
    const cookieFlags = isSecure
      ? `Path=/; HttpOnly; SameSite=Lax; Secure`
      : `Path=/; HttpOnly; SameSite=Lax`;
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `${cookieName}=${encodeURIComponent(cookieValue)}; ${cookieFlags}`,
    });
    res.end(JSON.stringify({ csrfToken: token }));
    return true;
  }

  if (path === '/api/auth/session') {
    const token = getCookieValue(req.headers.cookie, '__Secure-authjs.session-token') ||
                  getCookieValue(req.headers.cookie, 'authjs.session-token');
    if (!token) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({})); return true; }
    const payload = await verifyJWT(token);
    if (!payload) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({})); return true; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: { id: payload.sub, email: payload.email, name: payload.name }, expires: new Date(payload.exp * 1000).toISOString() }));
    return true;
  }

  if (path === '/api/auth/providers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 'credentials-signin': { id: 'credentials-signin', name: 'Credentials', type: 'credentials' } }));
    return true;
  }

  if (path === '/api/auth/signout') {
    // Consume the POST body so the TCP connection drains cleanly
    let signoutBody = '';
    for await (const chunk of req) signoutBody += chunk;
    const signoutParams = new URLSearchParams(signoutBody);
    const callbackUrl = signoutParams.get('callbackUrl') || '/account/signin';

    const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
    const sessionCookie = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
    const csrfCookie = isSecure ? '__Secure-authjs.csrf-token' : 'authjs.csrf-token';
    const clearFlags = isSecure ? 'Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0' : 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

    // @hono/auth-js/react sends X-Auth-Return-Redirect: 1 and calls .json()
    // on the response — return JSON so it can navigate instead of a 302
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': [
        `${sessionCookie}=; ${clearFlags}`,
        `${csrfCookie}=; ${clearFlags}`,
      ],
    });
    res.end(JSON.stringify({ url: callbackUrl }));
    return true;
  }

  if (path === '/api/auth/callback/credentials-signin' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    const email = params.get('email');
    const password = params.get('password');
    const callbackUrl = params.get('callbackUrl') || '/dashboard';

    // Validate CSRF token
    const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
    const csrfCookieName = isSecure ? '__Secure-authjs.csrf-token' : 'authjs.csrf-token';
    const csrfTokenFromBody = params.get('csrfToken');
    const csrfCookieRaw = getCookieValue(req.headers.cookie, csrfCookieName);
    const csrfCookieValue = csrfCookieRaw ? decodeURIComponent(csrfCookieRaw) : null;
    const csrfValid = await verifyCsrfToken(csrfTokenFromBody, csrfCookieValue);
    if (!csrfValid) {
      res.writeHead(302, { 'Location': '/account/signin?error=csrf' });
      res.end();
      return true;
    }

    if (!email || !password) { res.writeHead(302, { 'Location': '/account/signin?error=missing' }); res.end(); return true; }
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const userResult = await pool.query('SELECT * FROM auth_users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) { await pool.end(); res.writeHead(302, { 'Location': '/account/signin?error=invalid' }); res.end(); return true; }
      const user = userResult.rows[0];
      const accountResult = await pool.query('SELECT * FROM auth_accounts WHERE "userId" = $1 AND provider = $2', [user.id, 'credentials']);
      if (accountResult.rows.length === 0) { await pool.end(); res.writeHead(302, { 'Location': '/account/signin?error=invalid' }); res.end(); return true; }
      const isValid = await verify(accountResult.rows[0].password, password);
      await pool.end();
      if (!isValid) { res.writeHead(302, { 'Location': '/account/signin?error=invalid' }); res.end(); return true; }
      const token = await createJWT({ sub: String(user.id), email: user.email, name: user.name });
      const cookieName = '__Secure-authjs.session-token';
      res.writeHead(302, { 'Location': callbackUrl, 'Set-Cookie': `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}` });
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

async function handleApiRoute(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Convert URL path to file path
  // /api/staff/profile -> src/app/api/staff/profile/route.js
  const apiPath = pathname.replace(/^\/api/, '');
  
  // Try exact match first, then with dynamic segments
  const baseDir = join(__dirname, 'build/api');
  
  async function findRoute(urlParts, dirPath, params = {}) {
    if (urlParts.length === 0) {
      const routeFile = join(dirPath, 'route.js');
      if (existsSync(routeFile)) return { file: routeFile, params };
      return null;
    }
    
    const [segment, ...rest] = urlParts;
    
    // Try exact match
    const exactPath = join(dirPath, segment);
    if (existsSync(exactPath)) {
      const result = await findRoute(rest, exactPath, params);
      if (result) return result;
    }
    
    // Try dynamic segment [id]
    const { readdirSync } = await import('node:fs');
    try {
      const entries = readdirSync(dirPath);
      for (const entry of entries) {
        if (entry.startsWith('[') && entry.endsWith(']')) {
          const paramName = entry.slice(1, -1).replace('...', '');
          const newParams = { ...params, [paramName]: segment };
          const result = await findRoute(rest, join(dirPath, entry), newParams);
          if (result) return result;
        }
      }
    } catch {}
    
    return null;
  }
  
  const urlParts = apiPath.split('/').filter(Boolean);
  const route = await findRoute(urlParts, baseDir);
  
  if (!route) return false;
  
  try {
    const module = await import(route.file);
    const handler = module[req.method] || module[req.method?.toUpperCase()];
    
    if (!handler) {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return true;
    }
    
    // Read the raw body so POST/PUT/PATCH handlers can call request.json()
    let reqBody;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      reqBody = Buffer.concat(chunks);
    }

    // Set global request for auth()
    const webRequest = nodeRequestToWebRequest(req, reqBody);
    globalThis.__currentRequest = webRequest;

    const response = await handler(webRequest, { params: route.params });
    
    // Convert Response to Node.js response
    const responseHeaders = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    res.writeHead(response.status, responseHeaders);
    const responseBody = await response.arrayBuffer();
    res.end(Buffer.from(responseBody));
    return true;
  } catch (err) {
    console.error(`API route error for ${pathname}:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
    return true;
  }
}

const rrListener = createRequestListener({ build, mode: 'production' });

const server = createServer(async (req, res) => {
  try {
    // Handle auth routes
    if (req.url.startsWith('/api/auth/')) {
      const handled = await handleAuth(req, res);
      if (handled) return;
    }

    // Handle API routes
    if (req.url.startsWith('/api/')) {
      const handled = await handleApiRoute(req, res);
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
    let rrBody;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      rrBody = Buffer.concat(chunks);
    }
    const webRequest = nodeRequestToWebRequest(req, rrBody);
    globalThis.__currentRequest = webRequest;
    return rrListener(req, res);
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
