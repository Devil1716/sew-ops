import { Providers } from "@/components/providers-root";
import messages from "@/i18n/en.json";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers messages={messages} defaultTheme="light">
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6">
        {children}
      </div>
    </Providers>
  );
}
