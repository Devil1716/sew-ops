import { Providers } from "@/components/providers-root";
import messages from "@/i18n/en.json";

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers messages={messages} defaultTheme="dark">
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">{children}</div>
    </Providers>
  );
}
