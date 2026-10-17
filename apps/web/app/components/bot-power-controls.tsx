"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  Pause,
  Play,
  KeyRound,
  AlertTriangle,
  Loader2,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  restartBotAction,
  pauseBotAction,
  resumeBotAction,
  getBotRuntimeStatusAction,
} from "../actions";

interface BotPowerControlsProps {
  tenantId: string;
  guildId: string;
  initialStatus: string;
  botApplicationId: string | null;
}

export function BotPowerControls({
  tenantId,
  guildId,
  initialStatus,
  botApplicationId,
}: BotPowerControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(initialStatus);
  const [cooldown, setCooldown] = useState<number>(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep local status updated if initialStatus prop changes from server
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Auto-poll on mount if bot is in a connecting/transitional state (e.g. fresh onboarding or worker claim)
  useEffect(() => {
    const isTransitional =
      initialStatus === "UNASSIGNED" ||
      initialStatus === "ACTIVE_ASSIGNMENT" ||
      initialStatus === "RESTARTING" ||
      initialStatus === "STARTING";

    if (!isTransitional || !botApplicationId) return;

    let attempts = 0;
    const maxAttempts = 15; // 30s max
    setFeedback("Connecting to Discord Gateway...");

    const pollTimer = setInterval(async () => {
      attempts++;
      const poll = await getBotRuntimeStatusAction(tenantId, guildId);
      if (poll.ok && poll.status === "ONLINE") {
        clearInterval(pollTimer);
        setStatus("ONLINE");
        setFeedback("🎉 Bot connected to Discord Gateway successfully!");
        router.refresh();
        setTimeout(() => setFeedback(null), 4000);
      } else if (poll.ok && poll.status && poll.status !== "UNASSIGNED" && poll.status !== "ACTIVE_ASSIGNMENT") {
        setStatus(poll.status);
        if (poll.status === "DEGRADED" || poll.status === "STOPPED") {
          clearInterval(pollTimer);
          setFeedback(null);
          router.refresh();
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(pollTimer);
        setFeedback(null);
        router.refresh();
      }
    }, 2000);

    return () => clearInterval(pollTimer);
  }, [initialStatus, tenantId, guildId, botApplicationId, router]);

  // Countdown timer effect for restart rate-limit cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Handle Bot Restart with polling until Gateway Ready
  const handleRestart = async () => {
    if (cooldown > 0 || isPending || !botApplicationId) return;

    setError(null);
    setFeedback("Restart signal sent. Reconnecting Discord Gateway...");
    setStatus("RESTARTING");
    setCooldown(20);

    startTransition(async () => {
      const res = await restartBotAction(tenantId, guildId);
      if (!res.ok) {
        setError(res.error ?? "Failed to restart bot instance.");
        setFeedback(null);
        setStatus(initialStatus);
        return;
      }

      // Poll every 2 seconds for up to 20 seconds to confirm ONLINE state
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        const poll = await getBotRuntimeStatusAction(tenantId, guildId);
        if (poll.ok && poll.status === "ONLINE") {
          clearInterval(pollTimer);
          setStatus("ONLINE");
          setFeedback("Bot reconnected successfully!");
          router.refresh();
          setTimeout(() => setFeedback(null), 3000);
        } else if (attempts >= 10) {
          clearInterval(pollTimer);
          if (poll.ok && poll.status) {
            setStatus(poll.status);
          }
          setFeedback(null);
          router.refresh();
        }
      }, 2000);
    });
  };

  // Handle Pause / Stop Bot
  const handlePause = async () => {
    if (isPending || !botApplicationId) return;

    setError(null);
    setFeedback(null);

    startTransition(async () => {
      const res = await pauseBotAction(tenantId, guildId);
      if (!res.ok) {
        setError(res.error ?? "Failed to pause bot instance.");
        return;
      }
      setStatus("STOPPED");
      setFeedback("Bot instance paused.");
      router.refresh();
      setTimeout(() => setFeedback(null), 3000);
    });
  };

  // Handle Resume / Start Bot
  const handleResume = async () => {
    if (isPending || !botApplicationId) return;

    setError(null);
    setFeedback("Starting bot instance...");
    setStatus("STARTING");

    startTransition(async () => {
      const res = await resumeBotAction(tenantId, guildId);
      if (!res.ok) {
        setError(res.error ?? "Failed to start bot instance.");
        setStatus("STOPPED");
        setFeedback(null);
        return;
      }

      // Poll until ONLINE
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        const poll = await getBotRuntimeStatusAction(tenantId, guildId);
        if (poll.ok && poll.status === "ONLINE") {
          clearInterval(pollTimer);
          setStatus("ONLINE");
          setFeedback("Bot started and online!");
          router.refresh();
          setTimeout(() => setFeedback(null), 3000);
        } else if (attempts >= 10) {
          clearInterval(pollTimer);
          if (poll.ok && poll.status) {
            setStatus(poll.status);
          }
          setFeedback(null);
          router.refresh();
        }
      }, 2000);
    });
  };

  const getStatusBadge = () => {
    switch (status) {
      case "ONLINE":
        return (
          <Badge variant="success" className="text-[10px] font-semibold px-2 py-0.5">
            ONLINE
          </Badge>
        );
      case "RESTARTING":
      case "STARTING":
        return (
          <Badge className="text-[10px] font-semibold px-2 py-0.5 bg-sky-500/15 text-sky-500 border-sky-500/30 animate-pulse">
            {status}
          </Badge>
        );
      case "STOPPED":
        return (
          <Badge className="text-[10px] font-semibold px-2 py-0.5 bg-zinc-500/20 text-zinc-400 border-zinc-500/30">
            PAUSED
          </Badge>
        );
      case "ACTIVE_ASSIGNMENT":
        return (
          <Badge variant="default" className="text-[10px] font-semibold px-2 py-0.5">
            ACTIVE
          </Badge>
        );
      case "UNASSIGNED":
        return (
          <Badge className="text-[10px] font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-500 border-amber-500/30 animate-pulse flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            <span>UNASSIGNED</span>
          </Badge>
        );
      case "DEGRADED":
        return (
          <Badge variant="destructive" className="text-[10px] font-semibold px-2 py-0.5">
            DEGRADED
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5">
            {status}
          </Badge>
        );
    }
  };

  const getStatusDescription = () => {
    if (status === "ONLINE") {
      return "Bot worker active and connected to Discord Gateway.";
    }
    if (status === "UNASSIGNED") {
      return "Establishing Discord Gateway session. Worker is claiming assignment...";
    }
    if (status === "STOPPED") {
      return "Bot instance has been paused by administrator. Gateway connection closed.";
    }
    if (status === "RESTARTING" || status === "STARTING") {
      return "Re-establishing Discord Gateway session. Awaiting READY heartbeat...";
    }
    if (status === "ACTIVE_ASSIGNMENT") {
      return "Assigned to an active bot worker replica.";
    }
    if (status === "DEGRADED") {
      return "Discord rejected credentials. Token rotation required.";
    }
    return "Bot credentials required to activate this server.";
  };

  return (
    <div className="space-y-3">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          <span>Gateway Runtime</span>
        </div>
        <div id="overview-runtime-status-badge">{getStatusBadge()}</div>
      </div>

      {/* Status Description */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {getStatusDescription()}
      </p>

      {/* Inline Feedback or Error Message */}
      {feedback && (
        <div className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md animate-in fade-in duration-200 ${
          feedback.includes("🎉")
            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
            : "text-sky-400 bg-sky-500/10 border border-sky-500/20"
        }`}>
          {!feedback.includes("🎉") && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
          <span>{feedback}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive font-medium bg-destructive/10 border border-destructive/20 px-2.5 py-1 rounded-md">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Actions Rail */}
      <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
        {/* Left side: Power Controls */}
        <div className="flex items-center gap-1.5">
          {status === "STOPPED" ? (
            <Button
              id="resume-bot-instance-btn"
              type="button"
              size="sm"
              variant="outline"
              onClick={handleResume}
              disabled={isPending}
              className="h-7 text-xs font-medium gap-1 px-2.5 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
              title="Start Discord bot gateway connection"
            >
              <Play className="h-3 w-3 fill-emerald-500 text-emerald-500" />
              <span>Start Bot</span>
            </Button>
          ) : (
            <Button
              id="pause-bot-instance-btn"
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePause}
              disabled={isPending || status === "RESTARTING" || status === "STARTING"}
              className="h-7 text-xs font-medium gap-1 px-2.5 text-muted-foreground hover:text-amber-500 hover:border-amber-500/40"
              title="Temporarily pause and disconnect bot"
            >
              <Pause className="h-3 w-3" />
              <span>Pause</span>
            </Button>
          )}

          <Button
            id="restart-bot-instance-btn"
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRestart}
            disabled={isPending || cooldown > 0 || status === "STOPPED"}
            className="h-7 text-xs font-medium gap-1 px-2.5 text-muted-foreground hover:text-foreground"
            title={
              cooldown > 0
                ? `Restart cooldown active: wait ${cooldown}s`
                : "Restart bot and refresh Discord Gateway session"
            }
          >
            <RotateCcw
              className={`h-3 w-3 ${status === "RESTARTING" ? "animate-spin text-primary" : ""}`}
            />
            <span>{cooldown > 0 ? `Restart (${cooldown}s)` : "Restart"}</span>
          </Button>
        </div>

        {/* Right side: Credentials button */}
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
        >
          <a href={`/tenants/${tenantId}/guilds/${guildId}/setup`}>
            <KeyRound className="h-3 w-3" />
            <span>Credentials</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
