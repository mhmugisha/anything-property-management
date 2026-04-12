"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import ExelaLogo from "@/components/ExelaLogo";

export default function SignInPage() {
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.csrfToken || ""))
      .catch(() => {});
  }, []);

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
          <form
            method="POST"
            action="/api/auth/callback/credentials-signin"
            className="space-y-4"
          >
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="callbackUrl" value="/dashboard" />
            <div>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email or Username"
                className="w-full px-5 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#0B1F3A] text-base"
                required
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              Need help? <a href="#" className="font-semibold hover:text-[#3B82F6] transition-colors">Contact support</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
