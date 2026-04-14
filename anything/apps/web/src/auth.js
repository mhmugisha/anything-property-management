import { verifyJWT, getCookieValue } from '@/app/api/utils/jwt';

export async function auth(request) {
  try {
    const req = request || globalThis.__currentRequest;
    let cookieHeader = '';

    if (req) {
      if (req.headers?.get) {
        cookieHeader = req.headers.get('cookie') || '';
      } else if (req.headers?.cookie) {
        cookieHeader = req.headers.cookie;
      }
    }

    const token = getCookieValue(cookieHeader, '__Secure-authjs.session-token') ||
                  getCookieValue(cookieHeader, 'authjs.session-token');

    if (!token) return null;

    const payload = await verifyJWT(token);
    if (!payload) return null;

    return {
      user: { id: payload.sub, email: payload.email, name: payload.name },
      expires: new Date(payload.exp * 1000).toISOString(),
    };
  } catch { return null; }
}

export default { auth };
