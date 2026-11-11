"use client";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/data/EmptyState";
import { ErrorState } from "@/components/data/ErrorState";
import { RowSkeleton } from "@/components/data/Skeletons";
import { inputClass } from "@/components/admin/kit";
import { DateField } from "@/components/data/DateField";
import { useAuditLog } from "@/features/audit/hooks";
import { useFactoriesList } from "@/features/factories/hooks";
import { formatDateTime } from "@/lib/time";

const CATEGORIES = [
  { id: "", label: "Everything" },
  { id: "auth", label: "Sign-ins" },
  { id: "user", label: "People" },
  { id: "account", label: "Passwords" },
  { id: "factory", label: "Factories" },
  { id: "line", label: "Lines" },
  { id: "machine", label: "Machines" },
  { id: "shift", label: "Shifts" },
  { id: "assignment", label: "Assignments" },
  { id: "work_order", label: "Work orders" },
  { id: "issue", label: "Issues" },
  { id: "production", label: "Production" },
  { id: "quality", label: "Quality" },
  { id: "settings", label: "Settings" },
];

function describe(action: string): string {
  const [category, ...rest] = action.split(".");
  return `${category.replace(/_/g, " ")} · ${rest.join(".").replace(/_/g, " ")}`;
}

export default function AuditLogPage() {
  const factories = useFactoriesList().data ?? [];
  const [fid, setFid] = useState("");
  const factoryId = factories.length > 1 ? fid || factories[0]?.id : undefined;
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const log = useAuditLog({ category, from, to, factoryId });
  const items = log.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Who did what, and when. Entries are permanent: they cannot be edited or deleted. Passwords and PINs are never recorded.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        {factories.length > 1 && (
          <select className={`${inputClass} w-auto`} value={factoryId ?? ""} onChange={(e) => setFid(e.target.value)}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        <label className="space-y-1">
          <span className="block text-xs text-[var(--muted)]">Category</span>
          <select className={`${inputClass} w-auto`} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
        {(category || from || to) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCategory("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {log.isLoading ? (
        <Card>
          <RowSkeleton />
        </Card>
      ) : log.isError ? (
        <ErrorState message="Could not load the audit log." onRetry={() => log.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No entries match" body="Try clearing the filters." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs font-semibold tracking-wide text-[color-mix(in_srgb,var(--text)_78%,transparent)]">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Who</th>
                <th className="px-4 py-2 font-medium">What</th>
                <th className="px-4 py-2 font-medium">Record</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((e) => {
                const hasDetails = e.before !== null || e.after !== null;
                const expanded = open === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr>
                      <td className="whitespace-nowrap px-4 py-2 text-xs">{formatDateTime(e.createdAt)}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span>{e.actorName ?? "System"}</span>
                          {e.actorRole && (
                            <span className="rounded-full bg-[color-mix(in_srgb,var(--text)_8%,transparent)] px-2 py-0.5 text-xs font-medium capitalize text-[color-mix(in_srgb,var(--text)_70%,transparent)]">
                              {e.actorRole}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 capitalize">{describe(e.action)}</td>
                      <td className="px-4 py-2 text-sm">
                        {e.entityLabel || e.entityType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {hasDetails && (
                          <Button size="sm" variant="ghost" onClick={() => setOpen(expanded ? null : e.id)}>
                            {expanded ? "Hide" : "Details"}
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={5} className="bg-[color-mix(in_srgb,var(--text)_4%,transparent)] px-4 py-3">
                          <pre className="overflow-x-auto whitespace-pre-wrap font-data text-xs">
                            {JSON.stringify({ before: e.before, after: e.after, ip: e.ip }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {items.length > 0 && (
        <div className="flex justify-center">
          {log.hasNextPage ? (
            <Button variant="secondary" disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
              {log.isFetchingNextPage ? "Loading…" : "Load older entries"}
            </Button>
          ) : (
            <span className="text-xs text-[var(--muted)]">That is everything.</span>
          )}
        </div>
      )}
    </div>
  );
}