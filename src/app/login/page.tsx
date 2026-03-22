"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/locales";

// Module-level singleton — stable reference
const supabase = createClient();

type Mode = "login" | "signup";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get("error") === "auth" ? "auth" : ""
  );

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  const errorMessage = error === "auth" ? t.login.authFailed : error;

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-1 text-center text-3xl font-bold tracking-tight text-text-heading">
        {mode === "login" ? t.login.welcomeBack : t.login.createAccount}
      </h1>
      <p className="mb-10 text-center text-sm text-text-secondary">
        {mode === "login"
          ? t.login.signInSubtitle
          : t.login.signUpSubtitle}
      </p>

      {/* Google OAuth */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-border-input bg-surface-card px-4 py-3 text-sm font-medium text-gray-700 shadow-none transition-colors hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {t.login.continueGoogle}
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-muted">{t.login.or}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Email / Password form */}
      <form onSubmit={handleEmailAuth} className="space-y-3">
        <input
          type="email"
          placeholder={t.login.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-border-input bg-surface-card px-3 py-2.5 text-sm text-text-heading placeholder-gray-400 outline-none transition-colors focus:border-primary-text dark:placeholder-gray-500"
        />
        <input
          type="password"
          placeholder={t.login.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-lg border border-border-input bg-surface-card px-3 py-2.5 text-sm text-text-heading placeholder-gray-400 outline-none transition-colors focus:border-primary-text dark:placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "..." : mode === "login" ? t.login.signIn : t.login.signUp}
        </button>
      </form>

      {errorMessage && (
        <p className="mt-3 text-center text-sm text-red-500 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <p className="mt-6 text-center text-sm text-text-secondary">
        {mode === "login" ? t.login.noAccount : t.login.hasAccount}
        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError("");
          }}
          className="font-medium text-primary-text hover:text-red-700 dark:hover:text-red-300"
        >
          {mode === "login" ? t.login.signUp : t.login.signIn}
        </button>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 pt-14 transition-colors md:pt-0">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
