"use client";

import React, { useState, useEffect, useTransition, useMemo, useRef } from "react";
import {
  Terminal,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Play,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type GuildConsoleLogEntry,
  formatConsoleTimestamp,
} from "@/lib/console-logs-types";
import {
  getGuildConsoleLogsAction,
  clearGuildConsoleLogsAction,
} from "@/app/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeedbackBanner } from "@/components/ui/feedback-banner";

interface GuildLiveConsoleProps {
  tenantId: string;
  guildId: string;
  guildTimezone?: string;
  initialLogs?: GuildConsoleLogEntry[];
}

export function GuildLiveConsole({
  tenantId,
  guildId,
  guildTimezone = "Asia/Colombo",
  initialLogs = [],
}: GuildLiveConsoleProps) {
  const [logs, setLogs] = useState<GuildConsoleLogEntry[]>(initialLogs);
  const [isConsoleVisible, setIsConsoleVisible] = useState(true);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isErrorLogOpen, setIsErrorLogOpen] = useState(true);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const errorLogContainerRef = useRef<HTMLDivElement>(null);

  // Timezone defaults to the guild's configured timezone
  const currentTimezone = guildTimezone || "Asia/Colombo";

  // Fetch latest logs from shared multi-tenant storage
  const refreshLogs = async () => {
    startTransition(async () => {
      const res = await getGuildConsoleLogsAction(tenantId, guildId, currentTimezone);
      if (res.ok && res.logs) {
        setLogs(res.logs);
        setLastUpdated(new Date());
      }
    });
  };

  // Auto-refresh interval (every 5 seconds)
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      void refreshLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, tenantId, guildId, currentTimezone]);

  // Split logs into Activity Logs vs Error-Logs
  const activityLogs = useMemo(
    () => logs.filter((l) => l.level !== "ERROR"),
    [logs],
  );

  const errorLogs = useMemo(
    () => logs.filter((l) => l.level === "ERROR"),
    [logs],
  );

  // Auto-scroll to bottom as new live logs stream in (terminal behavior)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [activityLogs.length]);

  useEffect(() => {
    if (errorLogContainerRef.current) {
      errorLogContainerRef.current.scrollTop = errorLogContainerRef.current.scrollHeight;
    }
  }, [errorLogs.length]);

  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Open sleek confirm dialog when clear button is clicked
  const handleOpenClearConfirm = () => {
    setIsConfirmClearOpen(true);
  };

  // Perform actual clear action inside ConfirmDialog
  const handleConfirmClear = async () => {
    startTransition(async () => {
      const res = await clearGuildConsoleLogsAction(tenantId, guildId);
      if (res.ok) {
        setLogs([]);
        setIsConfirmClearOpen(false);
        setToastMessage({
          type: "success",
          text: "Live server console logs have been cleared.",
        });
      } else {
        setToastMessage({
          type: "error",
          text: res.error || "Failed to clear console logs.",
        });
      }
    });
  };

  // Handle Copy to Clipboard with floating feedback banner
  const handleCopy = () => {
    const text = logs
      .map(
        (log) =>
          `[${formatConsoleTimestamp(log.timestamp, currentTimezone)}] [${log.level}] [${log.category}] ${log.message}`,
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setToastMessage({
      type: "info",
      text: `${logs.length} log ${logs.length === 1 ? "entry" : "entries"} copied to clipboard.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  // Minimized Compact View
  if (!isConsoleVisible) {
    return (
      <div className="pt-2">
        <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Live Server Console</h3>
              <Badge
                variant="outline"
                className="font-mono text-[10px] text-zinc-400 border-zinc-700 bg-zinc-900/60"
              >
                {logs.length} Entries
              </Badge>
              {isAutoRefresh && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live Feed
                </span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConsoleVisible(true)}
            className="h-8 text-xs gap-1.5"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Expand Console</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Sleek, Compact Header Toolbar */}
      <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Console Title & Feed Status */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Live Server Console</h2>
              <Badge
                variant="outline"
                className="font-mono text-[10px] text-zinc-400 border-zinc-700 bg-zinc-900/60"
              >
                {logs.length} Entries
              </Badge>
              {isAutoRefresh && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live Feed
                </span>
              )}
            </div>
          </div>

          {/* Right: Compact Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Auto-Refresh Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className="h-8 text-xs gap-1.5"
              title={isAutoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
            >
              {isAutoRefresh ? (
                <>
                  <Pause className="h-3 w-3 text-amber-400" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 text-emerald-400" />
                  <span>Resume</span>
                </>
              )}
            </Button>

            {/* Manual Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshLogs()}
              disabled={isPending}
              className="h-8 text-xs gap-1.5"
              title="Refresh logs"
            >
              <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            {/* Copy Logs */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={logs.length === 0}
              className="h-8 text-xs gap-1.5"
              title="Copy logs to clipboard"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>

            {/* Clear Console */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenClearConfirm}
              disabled={isPending || logs.length === 0}
              className="h-8 text-xs gap-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/20 cursor-pointer"
              title="Clear console"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </Button>

            {/* Minimize Console */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsConsoleVisible(false)}
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
              title="Minimize console"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Minimize</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Panel 1: Activity Log (Collapsible) */}
      <div className="rounded-xl border border-zinc-800 bg-[#0d1117] overflow-hidden shadow-md">
        <button
          type="button"
          onClick={() => setIsLogOpen(!isLogOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-[#161b22] hover:bg-[#1c2128] transition-colors text-left border-b border-zinc-800/80"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            {isLogOpen ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )}
            <span>Log</span>
            <span className="text-xs font-mono text-zinc-400">({activityLogs.length})</span>
          </div>
          <span suppressHydrationWarning className="text-[11px] text-zinc-400 font-mono">
            Updated: {mounted ? formatConsoleTimestamp(lastUpdated.toISOString(), currentTimezone, false) : "..."}
          </span>
        </button>

        {isLogOpen && (
          <div className="p-3">
            {/* Monospace Log Lines - Compact height ~8-10 lines with terminal auto-scroll */}
            <div
              ref={logContainerRef}
              className="bg-[#090d13] border border-zinc-800/80 rounded-lg p-3 h-52 overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-300 space-y-1 select-text scroll-smooth"
            >
              {activityLogs.length === 0 ? (
                <div className="text-zinc-500 italic py-6 text-center text-xs">
                  No activity records logged yet. Real Discord events and operational traces will appear live here.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 font-mono whitespace-pre-wrap hover:bg-zinc-800/30 px-1 py-0.5 rounded transition-colors"
                  >
                    <span className="text-zinc-400 shrink-0">
                      [{formatConsoleTimestamp(log.timestamp, currentTimezone)}]
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${
                        log.level === "SUCCESS"
                          ? "text-emerald-400"
                          : log.level === "WARN"
                            ? "text-amber-400"
                            : "text-blue-400"
                      }`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-zinc-200">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Panel 2: Error-Log (Collapsible) */}
      <div className="rounded-xl border border-zinc-800 bg-[#0d1117] overflow-hidden shadow-md">
        <button
          type="button"
          onClick={() => setIsErrorLogOpen(!isErrorLogOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-[#161b22] hover:bg-[#1c2128] transition-colors text-left border-b border-zinc-800/80"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            {isErrorLogOpen ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )}
            <span>Error-Log</span>
            <span
              className={`text-xs font-mono px-1.5 py-0.2 rounded ${
                errorLogs.length > 0 ? "bg-rose-500/20 text-rose-400 font-bold" : "text-zinc-400"
              }`}
            >
              ({errorLogs.length})
            </span>
          </div>
          {errorLogs.length === 0 && (
            <span className="text-[11px] text-emerald-400/80 font-mono flex items-center gap-1">
              <Check className="h-3 w-3" /> All healthy
            </span>
          )}
        </button>

        {isErrorLogOpen && (
          <div className="p-3">
            {/* Error Monospace Lines or "No data found" */}
            <div
              ref={errorLogContainerRef}
              className="bg-[#090d13] border border-zinc-800/80 rounded-lg p-3 max-h-44 overflow-y-auto font-mono text-[11px] leading-relaxed select-text scroll-smooth"
            >
              {errorLogs.length === 0 ? (
                <div className="text-zinc-400 font-mono py-2 flex items-center gap-2 text-xs">
                  <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>No data found (All healthy - zero diagnostic errors reported)</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {errorLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 font-mono whitespace-pre-wrap bg-rose-500/10 text-rose-300 p-1.5 rounded border border-rose-500/20"
                    >
                      <span className="text-zinc-400 shrink-0">
                        [{formatConsoleTimestamp(log.timestamp, currentTimezone)}]
                      </span>
                      <span className="text-rose-400 font-bold shrink-0">[ERROR]</span>
                      <span className="text-rose-200">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sleek Dark Themed Confirm Dialog */}
      <ConfirmDialog
        open={isConfirmClearOpen}
        onOpenChange={setIsConfirmClearOpen}
        title="Clear Console Logs?"
        description="Are you sure you want to clear all operational console logs for this server? This action will reset both activity and error records, and cannot be undone."
        confirmLabel="Clear Logs"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isPending}
        onConfirm={handleConfirmClear}
      />

      {/* Floating Auto-dismiss Feedback Toast */}
      {toastMessage && (
        <FeedbackBanner
          type={toastMessage.type}
          message={toastMessage.text}
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
