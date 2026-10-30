"use client";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/data/EmptyState";

export function DataTable<T>({
  data,
  columns,
  emptyTitle,
  className,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyTitle?: string;
  className?: string;
}) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  if (!data.length) return <EmptyState title={emptyTitle ?? "No data"} />;
  return (
    <div className={cn("app-surface overflow-hidden rounded-[var(--radius-lg)] shadow-[var(--shadow-1)]", className)}>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[500px] border-collapse text-sm">
          <thead className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--text)_2%,var(--surface))] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 font-medium whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle whitespace-nowrap sm:whitespace-normal">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
