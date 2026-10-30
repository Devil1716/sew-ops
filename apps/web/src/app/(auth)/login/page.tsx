"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginRequestSchema, type LoginRequest } from "@sew-ops/shared";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api/client";
import { SESSION_KEY, safeNext, type SessionUser } from "@/lib/auth/session";
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const form = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const { user } = await api.post<{ user: SessionUser }>("/auth/login", values);
      qc.setQueryData(SESSION_KEY, user);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNext(next, user.role));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError("Too many attempts. Wait a minute and try again.");
      } else if (e instanceof ApiError && e.status === 401) {
        setError("Wrong email or password, or the account is temporarily locked.");
      } else {
        setError("Cannot reach the server. Check your connection and try again.");
      }
    }
  });

  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="w-full max-w-[400px] space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
          {t("auth.loginTitle")}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Manager &amp; admin access — enter your credentials below.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            {t("auth.email")}
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden
            />
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="you@factory.com"
              {...form.register("email")}
              className={cn(
                "h-11 w-full rounded-[var(--radius-md)] border bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]/60 transition-colors",
                "focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
                form.formState.errors.email
                  ? "border-red-500"
                  : "border-[var(--border)]",
              )}
            />
          </div>
          {form.formState.errors.email && (
            <p className="text-xs text-red-500">Enter a valid email address.</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="login-password"
            className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
          >
            {t("auth.password")}
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden
            />
            <input
              id="login-password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              {...form.register("password")}
              className={cn(
                "h-11 w-full rounded-[var(--radius-md)] border bg-[var(--surface)] pl-9 pr-10 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]/60 transition-colors",
                "focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
                form.formState.errors.password
                  ? "border-red-500"
                  : "border-[var(--border)]",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p className="text-xs text-red-500">Enter your password.</p>
          )}
        </div>

        {/* Error alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/8 p-3 text-xs font-medium text-red-500"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "relative w-full overflow-hidden rounded-[var(--radius-md)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] transition-all",
            "bg-[var(--accent)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
            "disabled:opacity-60 disabled:pointer-events-none",
            "inline-flex items-center justify-center gap-2",
          )}
        >
          {isSubmitting ? (
            <>
              <span
                aria-hidden
                className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
              />
              Signing in…
            </>
          ) : (
            <>
              {t("auth.submit")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Operator login link */}
      <p className="text-center text-xs text-[var(--muted)]">
        Sewing machine operator?{" "}
        <a
          href="/operator-login"
          className="font-semibold text-[var(--accent)] hover:underline"
        >
          Use the PIN terminal
        </a>
      </p>
    </div>
  );
}