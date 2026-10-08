import { Providers } from "@/components/providers-root";
import { Navbar } from "@/components/marketing/Navbar";
import { SmoothScroll } from "@/components/marketing/SmoothScroll";
import messages from "@/i18n/en.json";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers messages={messages} defaultTheme="light">
      <SmoothScroll>
        <Navbar />
        <main>{children}</main>
      </SmoothScroll>
    </Providers>
  );
}
