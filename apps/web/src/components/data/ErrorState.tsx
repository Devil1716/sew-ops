"use client";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="app-surface flex flex-col items-start gap-3 rounded-[var(--radius-lg)] p-5">
      <div className="inline-flex items-center gap-2 text-[var(--status-breakdown)]">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm font-medium">{message ?? "Something went wrong"}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
