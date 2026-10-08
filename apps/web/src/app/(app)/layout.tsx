import { Providers } from "@/components/providers-root";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { Topbar } from "@/components/app-shell/Topbar";
import { Breadcrumbs } from "@/components/app-shell/Breadcrumbs";
import { CommandPalette } from "@/components/app-shell/CommandPalette";
import messages from "@/i18n/en.json";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers messages={messages} defaultTheme="dark">
      <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <Breadcrumbs />
          <main className="min-w-0 flex-1 px-4 pb-10 md:px-6">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </Providers>
  );
}
