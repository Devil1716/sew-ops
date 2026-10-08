"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { useState, type ReactNode } from "react";
import { RealtimeProvider } from "@/lib/realtime/provider";
import { ThemeRoot } from "@/components/theme";

export function Providers({
  children,
  messages,
  defaultTheme = "light",
}: {
  children: ReactNode;
  messages: Record<string, unknown>;
  defaultTheme?: "light" | "dark";
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ThemeRoot defaultTheme={defaultTheme}>
        <QueryClientProvider client={client}>
          <RealtimeProvider>{children}</RealtimeProvider>
        </QueryClientProvider>
      </ThemeRoot>
    </NextIntlClientProvider>
  );
}
