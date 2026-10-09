"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PinPad } from "@/components/operator/PinPad";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api/client";
import { SESSION_KEY, safeNext, type SessionUser } from "@/lib/auth/session";

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
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.operatorTitle")}</h1>
        <p className="text-sm text-[var(--muted)]">Enter the machine code, then your 6-digit PIN.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted)]">{t("auth.machineCode")}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 text-center text-xl font-semibold tracking-widest outline-none focus:border-[var(--accent)]"
        />
      </label>
      {error && (
        <p role="alert" className="text-center text-sm text-red-500">
          {error}
        </p>
      )}
      <div className={busy ? "pointer-events-none opacity-60" : undefined}>
        <PinPad key={padKey} length={6} onComplete={onPin} />
      </div>
      <Button variant="ghost" size="sm" className="mx-auto block" onClick={() => router.back()}>
        Cancel
      </Button>
    </div>
  );
}