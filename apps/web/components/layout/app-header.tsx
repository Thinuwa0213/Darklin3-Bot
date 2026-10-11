"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ThemeToggle } from "@/components/theme-toggle";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbSegment[] | undefined;
}

const MODULE_NAMES: Record<string, string> = {
  notifications: "Content Alerts",
  welcome: "Welcome & Onboarding",
  levels: "XP & Leveling",
  embeds: "Embed Builder",
  giveaways: "Giveaways",
  moderation: "Auto-Moderation",
  presence: "Rich Presence",
  roles: "Reaction Roles",
  branding: "Bot Branding",
  radar: "Community Radar",
  settings: "Server Settings",
  setup: "Bot Configuration",
  billing: "Billing & Plans",
};

export function AppHeader({ breadcrumbs = [] }: AppHeaderProps) {
  const pathname = usePathname();

  // Dynamically resolve sub-route breadcrumb if only the guild level was provided
  const resolvedBreadcrumbs = React.useMemo(() => {
    if (!pathname) return breadcrumbs;

    // If user passed more than 1 segment explicitly, honor it
    if (breadcrumbs.length > 1) return breadcrumbs;

    const segments = [...breadcrumbs];

    // Detect if we are inside a module or sub-route
    const match = pathname.match(/(?:\/modules\/([a-z0-9-]+)|\/(settings|setup|billing))/i);
    if (match) {
      const routeKey = (match[1] || match[2] || "").toLowerCase();
      const label = MODULE_NAMES[routeKey] || routeKey.charAt(0).toUpperCase() + routeKey.slice(1);
      segments.push({
        label,
        isCurrent: true,
      });
    }

    return segments;
  }, [breadcrumbs, pathname]);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-xs">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4 mx-1" />

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/guilds">Servers</BreadcrumbLink>
            </BreadcrumbItem>

            {resolvedBreadcrumbs.map((segment, index) => (
              <React.Fragment key={`${segment.label}-${index}`}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {segment.isCurrent || !segment.href ? (
                    <BreadcrumbPage className="font-medium text-foreground">{segment.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={segment.href}>{segment.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
