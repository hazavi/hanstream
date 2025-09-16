"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      await signUp(email, password);
      router.push("/");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: string }).message
          : null;
      setError(msg ?? "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.push("/");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: string }).message
          : null;
      setError(msg ?? "Google sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-sm">
        {/* Minimal Clean Card */}
        <div className="glass-surface p-8 rounded-2xl">
          {/* Minimal Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold heading mb-1">Create Account</h1>
            <p className="text-sm text-muted">Join to start watching</p>
          </div>

          {/* Google Sign Up - Simplified */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 p-3 glass-btn mb-4"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <g>
                <path
                  fill="#4285F4"
                  d="M24 9.5c3.54 0 6.73 1.22 9.24 3.22l6.9-6.9C35.64 2.36 30.13 0 24 0 14.61 0 6.27 5.7 2.22 14.01l8.06 6.27C12.36 13.13 17.73 9.5 24 9.5z"
                />
                <path
                  fill="#34A853"
                  d="M46.1 24.55c0-1.64-.15-3.22-.43-4.76H24v9.04h12.44c-.54 2.9-2.18 5.36-4.64 7.02l7.18 5.59C43.73 37.36 46.1 31.41 46.1 24.55z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.28 28.28c-.62-1.86-.98-3.84-.98-5.89s.36-4.03.98-5.89l-8.06-6.27C.73 13.41 0 18.52 0 24s.73 10.59 2.22 15.76l8.06-6.27z"
                />
                <path
                  fill="#EA4335"
                  d="M24 48c6.13 0 11.64-2.02 15.82-5.5l-7.18-5.59c-2.01 1.35-4.59 2.15-7.64 2.15-6.27 0-11.64-3.63-13.72-8.76l-8.06 6.27C6.27 42.3 14.61 48 24 48z"
                />
              </g>
            </svg>
            <span className="text-sm font-medium">Continue with Google</span>
          </button>

          {/* Minimal Divider */}
          <div className="my-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-current opacity-20" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 surface text-muted">or</span>
              </div>
            </div>
          </div>

          {/* Minimal Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input - Simplified */}
            <div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm surface border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-muted"
                placeholder="Email address"
                disabled={loading}
              />
            </div>

            {/* Password Input - Simplified */}
            <div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-sm surface border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-muted"
                  placeholder="Password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-primary transition-colors"
                  disabled={loading}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {showPassword ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                      />
                    ) : (
                      <>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Confirm Password Input - Simplified */}
            <div>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2.5 text-sm surface border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all placeholder:text-muted"
                placeholder="Confirm password"
                disabled={loading}
              />
            </div>

            {/* Error Message - Minimal */}
            {error && (
              <div className="text-red-600 dark:text-red-400 text-xs p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                {error}
              </div>
            )}

            {/* Submit Button - Clean */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 rounded-lg"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          {/* Sign In Link - Minimal */}
          <div className="mt-6 text-center">
            <span className="text-xs text-muted">
              Already have an account?{" "}
              <Link href="/login" className="link font-medium">
                Sign in
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
