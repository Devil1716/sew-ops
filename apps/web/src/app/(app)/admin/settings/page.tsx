"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { CheckboxField, describeError, inputClass } from "@/components/admin/kit";
import { useFactoriesList } from "@/features/factories/hooks";
import { ALERT_RULES, useSettings, useSystemHealth, useUpdateAlertRules, type AlertRuleKey } from "@/features/settings/hooks";
import { formatDateTime } from "@/lib/time";

const POLICY = [
  "Five wrong passwords or PINs lock an account for 15 minutes.",
  "Staff sessions last up to 14 days when used; operator terminals sign out after 12 hours.",
  "Passwords need at least 12 characters. Operator PINs are 6 digits and easy ones (123456, 111111) are refused.",
  "Every change to people, machines, orders, issues and settings is written to the audit log.",
  "Pieces and issue reports can never be double-counted, even after a network drop.",
];

export default function SettingsPage() {
  const factories = useFactoriesList().data ?? [];
  const [fid, setFid] = useState("");
  const factoryId = factories.length > 1 ? fid || factories[0]?.id : undefined;
  const settings = useSettings(factoryId);
  const update = useUpdateAlertRules();
  const health = useSystemHealth();
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: AlertRuleKey, value: boolean) => {
    setError(null);
    update.mutate({ factoryId, rules: { [key]: value } }, { onError: (e) => setError(describeError(e)) });
  };

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {settings.data ? `${settings.data.factoryName} · timezone ${settings.data.timezone}` : "Factory settings"}
          </p>
        </div>
        {factories.length > 1 && (
          <select className={`${inputClass} w-auto`} value={factoryId ?? ""} onChange={(e) => setFid(e.target.value)}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </header>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Alerts to managers</h2>
          <p className="text-sm text-[var(--muted)]">
            Which problems ring the bell for managers and admins. The issue itself is always recorded; this only controls the alert.
            Breaks never alert.
          </p>
        </div>
        {error && <ErrorState message={error} />}
        {settings.isLoading ? (
          <RowSkeleton />
        ) : settings.isError || !settings.data ? (
          <ErrorState message="Could not load settings." onRetry={() => settings.refetch()} />
        ) : (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">
            {ALERT_RULES.map((rule) => (
              <li key={rule.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{rule.label}</p>
                  <p className="text-xs text-[var(--muted)]">{rule.hint}</p>
                </div>
                <CheckboxField
                  checked={settings.data.alertRules[rule.key]}
                  onChange={(v) => toggle(rule.key, v)}
                  label={settings.data.alertRules[rule.key] ? "Alerts on" : "Alerts off"}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">System status</h2>
        {health.isLoading ? (
          <RowSkeleton />
        ) : health.isError || !health.data ? (
          <p className="text-sm text-[var(--status-breakdown)]">The server did not answer. Check that the API is running.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-[var(--muted)]">Server</dt>
              <dd className="text-sm font-medium" style={{ color: health.data.status === "ok" ? "var(--status-running)" : "var(--status-breakdown)" }}>
                {health.data.status === "ok" ? "Running" : health.data.status}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Database</dt>
              <dd className="text-sm font-medium" style={{ color: health.data.database === "up" ? "var(--status-running)" : "var(--status-breakdown)" }}>
                {health.data.database === "up" ? "Connected" : health.data.database}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Server time</dt>
              <dd className="font-data text-sm">{formatDateTime(health.data.time)}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Security policy</h2>
        <p className="text-sm text-[var(--muted)]">Fixed by the system and shown here for reference.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {POLICY.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}