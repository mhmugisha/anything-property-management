import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import ExelaLogo from "@/components/ExelaLogo";
import { createJWT } from "@/app/api/utils/jwt";

export async function action({ request }) {
  const { Pool } = await import('@neondatabase/serverless');
  const { verify } = await import('argon2');

  const origin = request.headers.get('origin');
  const host = new URL(request.url).origin;
  if (origin && origin !== host) {
    return { error: 'Invalid request origin' };
  }

  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    return { error: 'Please fill in all fields' };
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const userResult = await pool.query('SELECT * FROM auth_users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      await pool.end();
      return { error: 'Invalid email or password' };
    }

    const user = userResult.rows[0];
    const accountResult = await pool.query(
      'SELECT * FROM auth_accounts WHERE "userId" = $1 AND provider = $2',
      [user.id, 'credentials']
    );

    if (accountResult.rows.length === 0) {
      await pool.end();
      return { error: 'Invalid email or password' };
    }

    const account = accountResult.rows[0];
    const isValid = await verify(account.password, password);
    await pool.end();

    if (!isValid) {
      return { error: 'Invalid email or password' };
    }

    const token = await createJWT({ sub: String(user.id), email: user.email, name: user.name });

    const isSecure = request.url.startsWith('https');
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
    const cookieFlags = isSecure
      ? `Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${30 * 24 * 60 * 60}`
      : `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;

    const { redirect } = await import('react-router');
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': `${cookieName}=${token}; ${cookieFlags}`,
      },
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
          <div className="flex justify-center mb-5">
            <ExelaLogo variant="light" height="h-24" />
          </div>
          <h1 className="text-4xl font-bold text-[#0B1F3A] text-center mb-7">
            Welcome Back
          </h1>
          <form method="POST" className="space-y-4">
            <div>
              <input
                type="email"
                name="email"
                placeholder="Email or Username"
                className="w-full px-5 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#0B1F3A] text-base"
                required
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                className="w-full px-5 py-4 pr-12 bg-white border-2 border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#0B1F3A] text-base"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-[#0B1F3A] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#162d4d] transition-colors mt-5"
            >
              Login
            </button>
          </form>
          <div className="mt-6 pt-5 border-t border-gray-200 text-center">
            <p className="text-[#0B1F3A] text-sm">
              Need help?{" "}
              <a href="#" className="font-semibold hover:text-[#3B82F6] transition-colors">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
