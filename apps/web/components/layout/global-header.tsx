"use client";

import * as React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";

interface GlobalHeaderProps {
  user: {
    id: string;
    name: string;
    email?: string | undefined;
    image?: string | null | undefined;
  };
  className?: string;
}

export function GlobalHeader({ user, className }: GlobalHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-background/95 px-4 sm:px-8 backdrop-blur-xs", className)}>
      <Link href="/guilds" className="flex items-center gap-2.5 group">
        <img
          src="/logo-icon.png"
          alt="Darklin3"
          className="h-7 w-7 rounded-md object-cover transition-transform group-hover:scale-105 shadow-xs"
        />
        <span className="font-bold text-base tracking-tight text-foreground">
          Darklin3
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
