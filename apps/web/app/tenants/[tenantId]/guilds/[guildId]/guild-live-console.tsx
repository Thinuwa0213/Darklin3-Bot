"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import {
  Terminal,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Play,
  Pause,
  Clock,
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
  appendGuildConsoleLogAction,
} from "@/app/actions";

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
  const [activeTimezoneMode, setActiveTimezoneMode] = useState<"guild" | "browser" | "utc">("guild");
  const [browserTimezone, setBrowserTimezone] = useState<string>("UTC");
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isErrorLogOpen, setIsErrorLogOpen] = useState(true);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Detect browser local timezone on mount
  useEffect(() => {
    try {
      const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (resolved) {
        setBrowserTimezone(resolved);
      }
    } catch {
      setBrowserTimezone("UTC");
    }
  }, []);

  // Determine current active timezone string
  const currentTimezone = useMemo(() => {
    if (activeTimezoneMode === "guild") return guildTimezone || "Asia/Colombo";
    if (activeTimezoneMode === "browser") return browserTimezone;
    return "UTC";
  }, [activeTimezoneMode, guildTimezone, browserTimezone]);

  // Fetch latest logs
  const refreshLogs = async () => {
    startTransition(async () => {
      const res = await getGuildConsoleLogsAction(tenantId, guildId, guildTimezone);
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
  }, [isAutoRefresh, tenantId, guildId, guildTimezone]);

  // Handle Clear Console
  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to clear console logs for this server?")) {
      return;
    }
    startTransition(async () => {
      const res = await clearGuildConsoleLogsAction(tenantId, guildId);
      if (res.ok) {
        setLogs([]);
      }
    });
  };

  // Handle Copy to Clipboard
  const handleCopy = () => {
    const text = logs
      .map(
        (log) =>
          `[${formatConsoleTimestamp(log.timestamp, currentTimezone)}] [${log.level}] [${log.category}] ${log.message}`,
      )
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulate test log (for instant admin verification)
  const handleSimulateTestLog = (level: "INFO" | "ERROR") => {
    startTransition(async () => {
      const message =
        level === "INFO"
          ? `[Test Activity] Simulated Discord Gateway heartbeat ack (Ping: 22ms)`
          : `[Test Error] Discord API 403: Bot missing permissions to manage channel #test-logs`;

      const res = await appendGuildConsoleLogAction(tenantId, guildId, {
        level,
        category: level === "INFO" ? "GATEWAY" : "SECURITY",
        message,
      });

      if (res.ok && res.log) {
        setLogs((prev) => [...prev, res.log!]);
        setLastUpdated(new Date());
      }
    });
  };

  // Split logs into General/Activity Logs vs Error-Logs
  const activityLogs = useMemo(
    () => logs.filter((l) => l.level !== "ERROR"),
    [logs],
  );

  const errorLogs = useMemo(
    () => logs.filter((l) => l.level === "ERROR"),
    [logs],
  );

  return (
    <div className="space-y-4 pt-2">
      {/* Console Top Toolbar */}
      <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-100 border border-zinc-700">
                <Terminal className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Live Server Console</h2>
              <Badge
                variant="outline"
                className="font-mono text-[10px] text-zinc-400 border-zinc-700 bg-zinc-900/60"
              >
                {logs.length} Total Entries
              </Badge>
              {isAutoRefresh && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live Feed
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Isolated operational logs and diagnostic error traces for this Discord server.
            </p>
          </div>

          {/* Timezone & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Timezone Switcher */}
            <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTimezoneMode("guild")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeTimezoneMode === "guild"
                    ? "bg-zinc-800 text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={`Guild Timezone: ${guildTimezone}`}
              >
                Guild ({guildTimezone.split("/")[1] || guildTimezone})
              </button>
              <button
                type="button"
                onClick={() => setActiveTimezoneMode("browser")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeTimezoneMode === "browser"
                    ? "bg-zinc-800 text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={`Browser Local Time: ${browserTimezone}`}
              >
                Local ({browserTimezone.split("/")[1] || browserTimezone})
              </button>
              <button
                type="button"
                onClick={() => setActiveTimezoneMode("utc")}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeTimezoneMode === "utc"
                    ? "bg-zinc-800 text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Universal Coordinated Time (UTC)"
              >
                UTC
              </button>
            </div>

            {/* Auto-Refresh Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className="h-8 text-xs gap-1.5"
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
            >
              <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>

            {/* Copy Logs */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-8 text-xs gap-1.5"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>

            {/* Clear Console */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClear()}
              disabled={isPending || logs.length === 0}
              className="h-8 text-xs gap-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/20"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </Button>
          </div>
        </div>

        {/* Timezone Note Banner */}
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span>
              Timestamps rendered in{" "}
              <strong className="text-foreground font-mono">{currentTimezone}</strong>
              {activeTimezoneMode === "guild" && " (Configured in Guild Settings)"}
              {activeTimezoneMode === "browser" && " (Your Client Local Clock)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px]">Test Diagnostics:</span>
            <button
              type="button"
              onClick={() => handleSimulateTestLog("INFO")}
              className="text-[10px] text-zinc-400 hover:text-foreground underline decoration-dotted transition-colors"
            >
              + Test Activity
            </button>
            <span className="text-zinc-600">•</span>
            <button
              type="button"
              onClick={() => handleSimulateTestLog("ERROR")}
              className="text-[10px] text-rose-400 hover:text-rose-300 underline decoration-dotted transition-colors"
            >
              + Test Error
            </button>
          </div>
        </div>
      </div>

      {/* Panel 1: Activity Log (Collapsible) */}
      <div className="rounded-xl border border-zinc-800 bg-[#0d1117] overflow-hidden shadow-md">
        <button
          type="button"
          onClick={() => setIsLogOpen(!isLogOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#161b22] hover:bg-[#1c2128] transition-colors text-left border-b border-zinc-800/80"
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
          <span className="text-[11px] text-zinc-400 font-mono">
            Updated: {formatConsoleTimestamp(lastUpdated.toISOString(), currentTimezone, false)}
          </span>
        </button>

        {isLogOpen && (
          <div className="p-4 space-y-3">
            {/* Exact Warning / Notice Banner from reference screenshot */}
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-semibold text-amber-300">Notice: </span>
                <span>
                  Starting v3 there&apos;s no need to check your logs manually. You can find all issues
                  and their solution below. Please do not contact our staff about issues in your log,
                  only share them when asked.
                </span>
              </div>
            </div>

            {/* Monospace Log Lines */}
            <div className="bg-[#090d13] border border-zinc-800/80 rounded-lg p-3.5 max-h-72 overflow-y-auto font-mono text-[11px] leading-relaxed text-zinc-300 space-y-1 select-text">
              {activityLogs.length === 0 ? (
                <div className="text-zinc-500 italic py-2">No activity records found.</div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 font-mono whitespace-pre-wrap hover:bg-zinc-800/30 px-1 py-0.5 rounded transition-colors">
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
          className="w-full flex items-center justify-between px-4 py-3 bg-[#161b22] hover:bg-[#1c2128] transition-colors text-left border-b border-zinc-800/80"
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
          <div className="p-4 space-y-3">
            {/* Exact Warning / Notice Banner from reference screenshot */}
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-semibold text-amber-300">Notice: </span>
                <span>
                  Starting v3 there&apos;s no need to check your logs manually. You can find all issues
                  and their solution below. Please do not contact our staff about issues in your log,
                  only share them when asked.
                </span>
              </div>
            </div>

            {/* Error Monospace Lines or "No data found" */}
            <div className="bg-[#090d13] border border-zinc-800/80 rounded-lg p-3.5 max-h-60 overflow-y-auto font-mono text-[11px] leading-relaxed select-text">
              {errorLogs.length === 0 ? (
                <div className="text-zinc-400 font-mono py-1">No data found</div>
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
    </div>
  );
}
