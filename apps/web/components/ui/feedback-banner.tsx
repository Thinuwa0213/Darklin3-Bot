"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FeedbackBannerProps {
  type?: "success" | "error" | "warning" | "info";
  message: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  id?: string;
}

export function FeedbackBanner({
  type = "success",
  message,
  onDismiss,
  className,
  id,
}: FeedbackBannerProps) {
  const config = {
    success: {
      icon: CheckCircle2,
      styles: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400",
      iconStyles: "text-emerald-600 dark:text-emerald-400",
    },
    error: {
      icon: AlertCircle,
      styles: "bg-destructive/10 border-destructive/25 text-destructive",
      iconStyles: "text-destructive",
    },
    warning: {
      icon: AlertTriangle,
      styles: "bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-400",
      iconStyles: "text-amber-600 dark:text-amber-400",
    },
    info: {
      icon: Info,
      styles: "bg-primary/10 border-primary/25 text-primary",
      iconStyles: "text-primary",
    },
  }[type];

  const Icon = config.icon;

  return (
    <div
      id={id}
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center justify-between gap-3 p-3 px-3.5 rounded-lg border text-xs font-medium animate-in fade-in slide-in-from-top-1 shadow-2xs transition-all",
        config.styles,
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
          className="shrink-0 p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity focus:outline-none"
          title="Dismiss"
          aria-label="Dismiss message"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
