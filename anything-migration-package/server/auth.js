/**
 * auth.js — Standard Auth.js configuration
 * Replaces the proprietary @auth/create package from the original platform.
 * Uses @hono/auth-js which is the open-source equivalent.
 */
import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';

export function CreateAuth() {
  const auth = async () => {
    const c = getContext();
    const token = await getToken({
      req: c.req.raw,
      secret: process.env.AUTH_SECRET,
      secureCookie: process.env.AUTH_URL?.startsWith('https'),
    });
    if (token) {
      return {
        user: {
          id: token.sub,
          email: token.email,
          name: token.name,
          image: token.picture,
        },
        expires: token.exp?.toString(),
      };
    }
    return null;
  };
  return { auth };
}

export default CreateAuth;
