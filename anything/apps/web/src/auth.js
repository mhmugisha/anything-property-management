// Custom auth implementation that reads our JWT session cookie

async function verifyJWT(token) {
  try {
    const secret = process.env.AUTH_SECRET || '';
    const [header, body, sig] = token.split('.');
    const data = `${header}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC', key,
      Buffer.from(sig, 'base64url'),
      new TextEncoder().encode(data)
    );
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

export async function auth(request) {
  try {
    // Get request from global context if not passed
    const req = request || (typeof globalThis.__currentRequest !== 'undefined' ? globalThis.__currentRequest : null);
    
    let cookieHeader = '';
    if (req?.headers) {
      cookieHeader = req.headers.get ? req.headers.get('cookie') : req.headers.cookie;
    }

    const token = getCookieValue(cookieHeader, '__Secure-authjs.session-token') ||
                  getCookieValue(cookieHeader, 'authjs.session-token');

    if (!token) return null;

    const payload = await verifyJWT(token);
    if (!payload) return null;

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      },
      expires: new Date(payload.exp * 1000).toISOString(),
    };
  } catch { return null; }
}

export default { auth };
