"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginRequestSchema, type LoginRequest } from "@sew-ops/shared";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const form = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  const onSubmit = form.handleSubmit(async () => {
    // UI stub: real auth is backend-driven; cookie sets role for middleware.
    document.cookie = `sew_ops_role=manager; path=/; max-age=86400`;
    router.push("/manager/dashboard");
  });

  return (
    <form onSubmit={onSubmit} className="app-surface w-full max-w-sm space-y-5 rounded-[var(--radius-lg)] p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("auth.loginTitle")}</h1>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted)]">{t("auth.email")}</span>
        <input
          type="email"
          defaultValue="manager@sewops.internal"
          {...form.register("email")}
          placeholder="manager@sewops.internal"
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted)]">{t("auth.password")}</span>
        <input
          type="password"
          defaultValue="password123"
          {...form.register("password")}
          placeholder="••••••••"
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
      </label>
      <Button type="submit" variant="primary" size="lg" className="w-full">
        {t("auth.submit")}
      </Button>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            document.cookie = `sew_ops_role=manager; path=/; max-age=86400`;
            router.push("/manager/dashboard");
          }}
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          Demo Manager
        </button>
        <button
          type="button"
          onClick={() => {
            document.cookie = `sew_ops_role=admin; path=/; max-age=86400`;
            router.push("/admin/factories");
          }}
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          Demo Admin
        </button>
      </div>
    </form>
  );
}
