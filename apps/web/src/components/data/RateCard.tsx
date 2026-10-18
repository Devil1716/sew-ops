import { Card } from "@/components/ui/card";

export function RateCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="font-data text-3xl font-semibold tracking-tight">{value}%</p>
    </Card>
  );
}