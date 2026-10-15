import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { loadWebConfig } from "@creatorcore/config";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const config = loadWebConfig();

export const metadata: Metadata = {
  title: {
    default: config.NEXT_PUBLIC_APP_NAME || "Darklin3",
    template: `%s | ${config.NEXT_PUBLIC_APP_NAME || "Darklin3"}`,
  },
  description: "Darklin3 Bot Operations & Management.",
};

import { PlatformBroadcastBanner } from "@/components/platform-broadcast-banner";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body
        className={`min-h-screen bg-background text-foreground antialiased font-sans ${GeistSans.className}`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PlatformBroadcastBanner platform="BOT_WEB" />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
