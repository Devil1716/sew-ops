"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PinPad } from "@/components/operator/PinPad";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api/client";
import { SESSION_KEY, safeNext, type SessionUser } from "@/lib/auth/session";
import { AlertCircle, ArrowLeft, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

// A terminal is bolted to one machine, so remember its code (not a secret).
const MACHINE_KEY = "sewops_machine_code";

export default function OperatorLoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [padKey, setPadKey] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MACHINE_KEY);
      if (saved) setCode(saved);
    } catch {
      // storage unavailable: the operator types the code
    }
  }, []);

  const onPin = async (pin: string) => {
    const machineCode = code.trim().toUpperCase();
    if (!machineCode) {
      setError("Enter the machine code first.");
      setPadKey((k) => k + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.post<{ user: SessionUser }>("/auth/operator-login", { machineCode, pin });
      try {
        window.localStorage.setItem(MACHINE_KEY, machineCode);
      } catch {
        // ignore
      }
      qc.setQueryData(SESSION_KEY, user);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(safeNext(next, "operator"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError("Too many attempts. Wait a minute and try again.");
      } else if (e instanceof ApiError && e.status === 401) {
        setError("Wrong PIN, or nobody is assigned to this machine right now.");
      } else {
        setError("Cannot reach the server. Check the connection and try again.");
      }
      setPadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-[380px] space-y-7">
      {/* Header */}
      <div className="space-y-2 text-center">
        {/* Terminal icon badge */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2)]">
          <Cpu className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          {t("auth.operatorTitle")}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Enter the machine code, then your 6-digit PIN.
        </p>
      </div>

      {/* Machine code input */}
      <div className="space-y-1.5">
        <label
          htmlFor="op-machine-code"
          className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]"
        >
          {t("auth.machineCode")}
        </label>
        <input
          id="op-machine-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. M-042"
          className={cn(
            "h-14 w-full rounded-[var(--radius-md)] border bg-[var(--surface)] px-4 text-center",
            "font-mono text-xl font-bold tracking-[0.25em] text-[var(--text)]",
            "outline-none transition-colors placeholder:text-[var(--muted)]/50 placeholder:font-sans placeholder:text-sm placeholder:tracking-normal",
            "focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]",
            error && !code ? "border-red-500" : "border-[var(--border)]",
          )}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-red-500/30 bg-red-500/8 p-3 text-xs font-medium text-red-500"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* PIN Pad — wrapped to dim when busy */}
      <div
        className={cn(
          "transition-opacity",
          busy ? "pointer-events-none opacity-50" : "opacity-100",
        )}
      >
        <PinPad key={padKey} length={6} onComplete={onPin} />
      </div>

      {/* Back link */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>
    </div>
  );
}