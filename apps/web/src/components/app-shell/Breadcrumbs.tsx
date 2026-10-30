"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs() {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-x-auto px-4 py-2 text-xs text-[var(--muted)] whitespace-nowrap">
      {parts.map((p, i) => {
        const href = "/" + parts.slice(0, i + 1).join("/");
        const last = i === parts.length - 1;
        return (
          <span key={href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
            {last ? (
              <span className="text-[var(--text)]">{humanize(p)}</span>
            ) : (
              <Link href={href} className="hover:text-[var(--text)]">
                {humanize(p)}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function humanize(seg: string) {
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
