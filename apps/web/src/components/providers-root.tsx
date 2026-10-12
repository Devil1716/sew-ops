"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { useState, type ReactNode } from "react";
import { RealtimeProvider } from "@/lib/realtime/provider";
import { ThemeRoot } from "@/components/theme";
import { AuthLostListener } from "@/components/auth-lost-listener";

export function Providers({
  children,
  messages,
  defaultTheme = "light",
}: {
  children: ReactNode;
  messages: AbstractIntlMessages;
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
          <AuthLostListener />
          <RealtimeProvider>{children}</RealtimeProvider>
        </QueryClientProvider>
      </ThemeRoot>
    </NextIntlClientProvider>
  );
}