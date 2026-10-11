"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface ModuleHeroCardProps {
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  subtitle: string;
  badgeLabel?: string;
  badgeVariant?: "active" | "paused" | "pro";
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
  category?: string;
}

export function ModuleHeroCard({
  icon,
  iconClassName,
  title,
  subtitle,
  badgeLabel,
  badgeVariant,
  enabled,
  onToggle,
  primaryAction,
  secondaryAction,
  backHref,
  backLabel = "Server Overview",
  className,
  category,
}: ModuleHeroCardProps) {
  const isCurrentlyActive = enabled;
  const currentBadgeLabel = badgeLabel ?? (isCurrentlyActive ? "ACTIVE" : "PAUSED");
  const currentVariant = badgeVariant ?? (isCurrentlyActive ? "active" : "paused");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 sm:p-6 backdrop-blur-md shadow-xl transition-all",
        className,
      )}
    >
      {/* Optional Top Category / Breadcrumb & Back Link */}
      <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          {category && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              {category}
            </span>
          )}
        </div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{backLabel}</span>
          </Link>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        {/* Left: Glowing Icon + Title + Status + Description */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "shrink-0 p-3.5 rounded-xl border transition-all shadow-inner",
              isCurrentlyActive
                ? "bg-zinc-900 border-zinc-700 text-zinc-100 shadow-zinc-950/50"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-400",
              iconClassName,
            )}
          >
            {icon}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-zinc-100 font-sans">
                {title}
              </h1>

              {currentVariant === "active" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {currentBadgeLabel}
                </span>
              )}

              {currentVariant === "paused" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wide uppercase bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 shadow-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  {currentBadgeLabel}
                </span>
              )}

              {currentVariant === "pro" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-xs">
                  <Sparkles className="h-2.5 w-2.5 text-zinc-300" />
                  PRO
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: Master Toggle & Actions */}
        <div className="flex items-center gap-3 self-start lg:self-center shrink-0">
          {/* Master Switch with visual state */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
              isCurrentlyActive
                ? "bg-zinc-900 border-zinc-700 text-zinc-200"
                : "bg-zinc-900/50 border-zinc-800 text-zinc-400",
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wider font-mono">
              {isCurrentlyActive ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          {secondaryAction}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}
