"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import ExelaLogo from "@/components/ExelaLogo";

export default function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const queryClient = useQueryClient();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      queryClient.clear();

      // Get CSRF token first
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      // Submit credentials directly
      const res = await fetch("/api/auth/callback/credentials-signin", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          password,
          csrfToken,
          callbackUrl: "/dashboard",
          redirect: "true",
        }),
        redirect: "follow",
      });

      if (res.ok || res.redirected) {
        // Check if we got a session
        const sessionRes = await fetch("/api/auth/session");
        const session = await sessionRes.json();

        if (session?.user) {
          window.location.href = "/dashboard";
        } else {
          setError("Invalid email or password. Please try again.");
          setLoading(false);
        }
      } else {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E5E7EB] flex items-center justify-center p-4">
      <div className="w-full max-w-[576px]">
        <div className="bg-white rounded-3xl px-10 py-8 shadow-lg">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <ExelaLogo variant="light" height="h-24" />
          </div>

          {/* Welcome Back Title */}
          <h1 className="text-4xl font-bold text-[#0B1F3A] text-center mb-7">
            Welcome Back
          </h1>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email or Username"
                className="w-full px-5 py-4 bg-white border-2 border-gray-300 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#0B1F3A] text-base"
                required
              />
            </div>

            {/* Password Field */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
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
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <a
                href="#"
                className="text-[#3B82F6] hover:text-[#2563EB] text-sm font-medium"
              >
                Forgot Password?
              </a>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0B1F3A] text-white py-4 rounded-xl font-semibold text-lg hover:bg-[#162d4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-5"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          {/* Support Text */}
          <div className="mt-6 pt-5 border-t border-gray-200 text-center">
            <p className="text-[#0B1F3A] text-sm">
              Need help?{" "}
              <a
                href="#"
                className="font-semibold hover:text-[#3B82F6] transition-colors"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
