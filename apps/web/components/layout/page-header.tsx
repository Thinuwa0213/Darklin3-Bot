import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  category?: string;
  badge?: React.ReactNode;
  badges?: React.ReactNode[];
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function ProBadge({
  label = "PRO",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] font-bold tracking-wider uppercase border-amber-500/40 text-amber-500 dark:text-amber-400 bg-amber-500/10 shadow-2xs px-2 py-0.5",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export interface ModuleToggleProps {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  activeLabel?: string;
  disabledLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function ModuleToggle({
  enabled,
  onToggle,
  activeLabel = "Active",
  disabledLabel = "Paused",
  disabled = false,
  className,
  id,
}: ModuleToggleProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/80 bg-card shadow-2xs transition-colors",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full transition-all",
          enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground",
        )}
      />
      <span className="text-xs font-medium text-foreground">
        {enabled ? activeLabel : disabledLabel}
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
        className="ml-1 scale-90"
      />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  category,
  badge,
  badges,
  actions,
  backHref,
  backLabel = "Back",
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 mb-6 border-b border-border/80",
        className,
      )}
    >
      <div className="space-y-1">
        {category && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {category}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {badge}
          {badges?.map((b, idx) => (
            <React.Fragment key={idx}>{b}</React.Fragment>
          ))}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
        {backHref && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground shadow-2xs"
          >
            <a href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span>{backLabel}</span>
            </a>
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
