"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PinPad } from "@/components/operator/PinPad";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function OperatorLoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [code, setCode] = useState("");

  const onPin = (_pin: string) => {
    document.cookie = `sew_ops_role=operator; path=/; max-age=43200`;
    router.push("/operator");
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.operatorTitle")}</h1>
        <p className="text-sm text-[var(--muted)]">Scan or enter the machine code, then your PIN.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-[var(--muted)]">{t("auth.machineCode")}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="h-12 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 text-center text-xl font-semibold tracking-widest outline-none focus:border-[var(--accent)]"
        />
      </label>
      <PinPad onComplete={onPin} />
      <Button variant="ghost" size="sm" className="mx-auto block" onClick={() => router.back()}>
        Cancel
      </Button>
    </div>
  );
}
