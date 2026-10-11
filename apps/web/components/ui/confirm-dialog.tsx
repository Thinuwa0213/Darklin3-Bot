"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { Button } from "./button";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  icon?: React.ReactNode;
  additionalNotice?: React.ReactNode;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  icon,
  additionalNotice,
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[440px] border-border/80 bg-zinc-950/95 backdrop-blur-md shadow-2xl rounded-2xl p-6 gap-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border",
              isDanger
                ? "bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-sm shadow-rose-950/30"
                : "bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-sm shadow-amber-950/30",
            )}
          >
            {icon ? (
              icon
            ) : isDanger ? (
              <Trash2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>

          <div className="space-y-1.5 flex-1 min-w-0">
            <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>

        {additionalNotice && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 text-xs text-rose-200/90 leading-relaxed">
            {additionalNotice}
          </div>
        )}

        <DialogFooter className="flex sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-none border-border hover:bg-muted text-xs cursor-pointer h-9"
          >
            {cancelLabel}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isLoading}
            onClick={onConfirm}
            className={cn(
              "flex-1 sm:flex-none text-xs font-semibold gap-2 cursor-pointer h-9 shadow-md transition-all",
              isDanger
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40"
                : "bg-primary hover:bg-primary/90 text-primary-foreground",
            )}
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
