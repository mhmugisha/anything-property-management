"use client";

import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import ExelaLogo from "@/components/ExelaLogo";

export default function OnboardingPage() {
  const { data: user, loading: userLoading } = useUser();
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch("/api/staff/roles");
        if (res.ok) {
          const data = await res.json();
          // Filter out Admin role — only the system bootstrap assigns Admin
          const filteredRoles = (data.roles || []).filter(
            (r) => r.role_name !== "Admin",
          );
          setRoles(filteredRoles);
        }
      } catch (err) {
        console.error("Failed to fetch roles:", err);
      }
    };
    fetchRoles();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/staff/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: parseInt(selectedRole),
          phone,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to complete onboarding");
      }

      window.location.href = "/dashboard";
    } catch (err) {
      console.error(err);
      setError("Failed to complete onboarding. Please try again.");
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-slate-200 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <ExelaLogo variant="light" height="h-20" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-800 mb-2">
            Complete Your Profile
          </h1>
          <p className="text-slate-500">
            Welcome, {user?.name || user?.email}!
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Your Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                required
              >
                <option value="">Choose a role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+256 700 123456"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedRole}
              className="w-full bg-[#0B1F3A] text-white py-3 rounded-lg font-medium hover:bg-[#08172c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Setting up..." : "Complete Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
