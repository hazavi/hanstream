"use client";
import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await resetPassword(email);
      setMessage(
        "Check your email for password reset instructions. If you don't see it, check your spam folder."
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: string }).message
          : null;
      setError(msg ?? "Failed to send reset email");
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
            <h1 className="text-2xl font-bold heading mb-1">Reset Password</h1>
            <p className="text-sm text-muted">
              Enter your email to receive reset instructions
            </p>
          </div>

          {/* Success Message */}
          {message && (
            <div className="mb-4 text-green-600 dark:text-green-400 text-xs p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              {message}
            </div>
          )}

          {/* Form */}
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

            {/* Error Message - Minimal */}
            {error && (
              <div className="text-red-600 dark:text-red-400 text-xs p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                {error}
              </div>
            )}

            {/* Submit Button - Clean */}
            <button
              type="submit"
              disabled={loading || !!message}
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
                  Sending...
                </>
              ) : message ? (
                "Email sent!"
              ) : (
                "Send reset email"
              )}
            </button>
          </form>

          {/* Back to Login Link - Minimal */}
          <div className="mt-6 text-center">
            <span className="text-xs text-muted">
              Remember your password?{" "}
              <Link href="/login" className="link font-medium">
                Back to sign in
              </Link>
            </span>
          </div>

          {/* Sign Up Link - Minimal */}
          <div className="mt-3 text-center">
            <span className="text-xs text-muted">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="link font-medium">
                Create account
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
