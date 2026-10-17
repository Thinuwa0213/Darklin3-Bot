import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { loadWebConfig } from "@darklin3_bot/config";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const config = loadWebConfig();

export const metadata: Metadata = {
  title: {
    default: config.NEXT_PUBLIC_APP_NAME || "Darklin3",
    template: `%s | ${config.NEXT_PUBLIC_APP_NAME || "Darklin3"}`,
  },
  description: "Darklin3 Bot Operations & Management.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
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
