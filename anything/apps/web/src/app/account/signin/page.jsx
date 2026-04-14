import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import ExelaLogo from "@/components/ExelaLogo";

export async function action({ request }) {
  const { neon } = await import('@neondatabase/serverless');
  const argon2 = await import('argon2');
  const { redirect } = await import('react-router');

  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) return { error: 'Please fill in all fields' };

  try {
    const sql = neon(process.env.DATABASE_URL);

    const userRows = await sql`SELECT * FROM auth_users WHERE email = ${email}`;
    if (userRows.length === 0) return { error: 'Invalid email or password' };

    const user = userRows[0];
    const accountRows = await sql`SELECT * FROM auth_accounts WHERE "userId" = ${user.id} AND provider = 'credentials'`;
    if (accountRows.length === 0) return { error: 'Invalid email or password' };

    const isValid = await argon2.verify(accountRows[0].password, password);
    if (!isValid) return { error: 'Invalid email or password' };

    const secret = process.env.AUTH_SECRET || '';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: String(user.id), email: user.email, name: user.name,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    })).toString('base64url');
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const token = `${data}.${Buffer.from(sig).toString('base64url')}`;

    const cookieName = '__Secure-authjs.session-token';
    const cookieFlags = `Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`;

    return redirect('/dashboard', {
      headers: { 'Set-Cookie': `${cookieName}=${token}; ${cookieFlags}` }
    });
  } catch (error) {
    console.error('Signin error:', error);
    return { error: 'Something went wrong. Please try again.' };
  }
}

export default function SignInPage({ actionData }) {
  const [showPassword, setShowPassword] = useState(false);
  const error = actionData?.error;

  return (
    <div className="min-h-screen bg-[#E5E7EB] flex items-center justify-center p-4">
      <div className="w-full max-w-[576px]">
        <div className="bg-white rounded-3xl px-10 py-8 shadow-lg">
          <div className="flex justify-center mb-5"><ExelaLogo variant="light" height="h-24" /></div>
          <h1 className="text-4xl font-bold text-[#0B1F3A] text-center mb-7">Welcome Back</h1>
          <form method="POST" className="space-y-4">
            <div><input type="email" name="email" placeholder="Email or Username" className="w-full px-5 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#0B1F3A] text-base" required /></div>
            <div className="relative">
              <input type={showPassword ? "text" : "password"} name="password" placeholder="Password" className="w-full px-5 py-4 pr-12 bg-white border-2 border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#0B1F3A] text-base" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm">{error}</div>}
            <button type="submit" className="w-full bg-[#0B1F3A] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#162d4d] transition-colors mt-5">Login</button>
          </form>
          <div className="mt-6 pt-5 border-t border-gray-200 text-center">
            <p className="text-[#0B1F3A] text-sm">Need help? <a href="#" className="font-semibold hover:text-[#3B82F6] transition-colors">Contact support</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
