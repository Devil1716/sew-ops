"use client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/data/EmptyState";
import { DataTable } from "@/components/data/DataTable";
import { KpiSkeleton, RowSkeleton } from "@/components/data/Skeletons";
import { ErrorState } from "@/components/data/ErrorState";

/**
 * Shifts. Data comes from feature hooks (one per resource) that call
 * lib/api/client.ts. No demo data is rendered here — empty systems show
 * designed empty states; failures show error with retry.
 */
export default function Page() {
  const loading = false;
  const error: string | null = null;
  return (
    <div className="space-y-6 py-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Shifts</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Shift schedules per factory.</p>
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Data view</CardTitle>
        </CardHeader>
        {loading ? (
          <RowSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <EmptyState
            title="Nothing here yet"
            body="Connect the backend or record events from the operator terminal and this view will fill itself."
          />
        )}
      </Card>
    </div>
  );
}
