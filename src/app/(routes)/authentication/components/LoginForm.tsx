"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle } from "lucide-react";
import { login } from "../service/authService";
import { setRole, setToken } from "@/helper/helper";
import { accessCan, setSelectedBranchId, setStoredAccess } from "@/helper/access";

// Demo logins box is turned off (hidden from the login page). The demo
// accounts are now real branch logins, so their passwords are not kept here.
// const SHOW_DEMO_LOGINS = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGINS === "true";
// const DEMO_ACCOUNTS = [{ label: "...", email: "...", password: "..." }];

// Staff-only sign in. There is no registration or password reset here on
// purpose — accounts are created by an admin from Customers/Employees.
export const LoginForm: React.FC = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sync lock: a double Enter / double click can't send two sign-in requests.
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submitLockRef.current) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    submitLockRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await login({ email: trimmedEmail, password });

      // Persist to localStorage + cookie so middleware can gate /admin.
      setToken(res.token);
      if (res.data?.role) setRole(res.data.role);
      // Branch + role + permissions (refreshed by the admin layout via /me/access).
      // A new login never keeps the previous user's picked branch.
      setSelectedBranchId(null);
      setStoredAccess(res.access ?? null);

      if (res.data?.role === "admin") {
        // Staff without the POS permission start on the dashboard instead.
        const canPos = !res.access || accessCan(res.access, "pos", "view");
        router.replace(canPos ? "/admin/pos" : "/admin");
      } else {
        // Only admins have anywhere to go in a POS-only app.
        setError("This account does not have admin access.");
        submitLockRef.current = false;
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
      <div className="text-center">
        <h1 className="text-xl font-bold text-gray-900">Sign in</h1>
        <p className="mt-1 text-xs text-gray-500">Enter your credentials to open the POS</p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="text-xs font-medium text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-semibold text-gray-700">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#dc2626] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] disabled:opacity-60"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-xs font-semibold text-gray-700">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            disabled={loading}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#dc2626] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={loading}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 transition-colors hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#dc2626] py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#b91c1c] focus:outline-none focus:ring-2 focus:ring-[#dc2626] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>

      {/* Demo logins box hidden — see the note at the top of this file.
      {SHOW_DEMO_LOGINS && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Demo logins
          </p>
          <ul className="mt-1.5 divide-y divide-gray-200 text-xs">
            {DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.email} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">{acc.label}</p>
                  <p className="truncate font-mono text-gray-600">
                    {acc.email} · {acc.password}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                    setError(null);
                  }}
                  disabled={loading}
                  className="shrink-0 text-[11px] font-semibold text-[#dc2626] transition-colors hover:text-[#b91c1c] disabled:opacity-60"
                >
                  Autofill
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      */}
    </form>
  );
};

export default LoginForm;
