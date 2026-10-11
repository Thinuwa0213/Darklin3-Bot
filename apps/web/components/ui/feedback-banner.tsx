"use client";

import * as React from "react";
import { useEffect } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedbackBannerProps {
  type?: "success" | "error" | "warning" | "info";
  message: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  id?: string;
  /**
   * If true, renders inline within document flow instead of floating toast.
   * Defaults to false (floating bottom-right toast).
   */
  inline?: boolean;
}

export function FeedbackBanner({
  type = "success",
  message,
  onDismiss,
  className,
  id,
  inline = false,
}: FeedbackBannerProps) {
  // Auto-dismiss floating toast after 4.5 seconds
  useEffect(() => {
    if (!onDismiss || inline) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss, inline]);

  const config = {
    success: {
      icon: CheckCircle2,
      borderStyles: "border-emerald-500/40 text-emerald-300 ring-emerald-500/20",
      iconStyles: "text-emerald-400",
      indicatorBg: "bg-emerald-500",
    },
    error: {
      icon: AlertCircle,
      borderStyles: "border-rose-500/40 text-rose-300 ring-rose-500/20",
      iconStyles: "text-rose-400",
      indicatorBg: "bg-rose-500",
    },
    warning: {
      icon: AlertTriangle,
      borderStyles: "border-amber-500/40 text-amber-300 ring-amber-500/20",
      iconStyles: "text-amber-400",
      indicatorBg: "bg-amber-500",
    },
    info: {
      icon: Info,
      borderStyles: "border-[#5865F2]/40 text-[#5865F2] ring-[#5865F2]/20",
      iconStyles: "text-[#5865F2]",
      indicatorBg: "bg-[#5865F2]",
    },
  }[type];

  const Icon = config.icon;

  if (inline) {
    return (
      <div
        id={id}
        role={type === "error" ? "alert" : "status"}
        className={cn(
          "flex items-center justify-between gap-3 p-3 px-3.5 rounded-lg border text-xs font-medium animate-in fade-in slide-in-from-top-1 shadow-2xs transition-all bg-[#1e1f22]/90",
          config.borderStyles,
          className,
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={cn("h-4 w-4 shrink-0", config.iconStyles)} />
          <span className="leading-relaxed truncate">{message}</span>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-white transition-colors cursor-pointer"
            title="Dismiss"
            aria-label="Dismiss message"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Floating Bottom-Right Side Toast (Prevents page layout shifts)
  return (
    <div
      id={id}
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-auto rounded-xl border bg-[#1e1f22]/95 text-white shadow-2xl backdrop-blur-md ring-1 p-3.5 px-4 flex items-center justify-between gap-3.5 text-xs font-medium animate-in fade-in slide-in-from-right-8 slide-in-from-bottom-2 duration-200 transition-all cursor-default select-none",
        config.borderStyles,
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0 flex items-center justify-center">
          <Icon className={cn("h-4.5 w-4.5", config.iconStyles)} />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-[#1e1f22]",
              config.indicatorBg,
            )}
          />
        </div>
        <span className="leading-snug break-words text-white/95 font-medium">{message}</span>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 -mr-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
