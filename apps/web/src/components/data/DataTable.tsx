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
    <div className={cn("app-surface overflow-hidden rounded-[var(--radius-lg)]", className)}>
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-4 py-3 font-medium">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
