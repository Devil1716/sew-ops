"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginRequestSchema, type LoginRequest } from "@sew-ops/shared";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api/client";
import { SESSION_KEY, safeNext, type SessionUser } from "@/lib/auth/session";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
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

  return (
    <form onSubmit={onSubmit} className="app-surface w-full max-w-sm space-y-5 rounded-[var(--radius-lg)] p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.loginTitle")}</h1>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted)]">{t("auth.email")}</span>
        <input
          type="email"
          autoComplete="username"
          {...form.register("email")}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        {form.formState.errors.email && (
          <span className="text-xs text-red-500">Enter a valid email address.</span>
        )}
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted)]">{t("auth.password")}</span>
        <input
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        {form.formState.errors.password && (
          <span className="text-xs text-red-500">Enter your password.</span>
        )}
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in…" : t("auth.submit")}
      </Button>
    </form>
  );
}