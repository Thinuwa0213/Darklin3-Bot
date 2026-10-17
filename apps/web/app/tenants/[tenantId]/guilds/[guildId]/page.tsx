import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../../lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { readStoredSettings } from "@/lib/settings-storage";
import { readStoredConsoleLogs } from "@/lib/console-logs-storage";
import { GuildLiveConsole } from "./guild-live-console";
import { BotPowerControls } from "@/app/components/bot-power-controls";
import {
  ShieldAlert,
  Bot,
  Activity,
  Server,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Users,
  MessageSquareText,
  Radio,
  Lock,
  HardDrive,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    tenantId: string;
    guildId: string;
  }>;
}

export default async function GuildOverviewPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId, guildId } = await params;

  const [res, settings, initialLogs, brandingRes] = await Promise.all([
    callApiServer<{
      status:
        | "NOT_CONFIGURED"
        | "PENDING_CREDENTIAL"
        | "UNASSIGNED"
        | "ACTIVE_ASSIGNMENT"
        | "ONLINE"
        | "DEGRADED"
        | "OFFLINE"
        | "STOPPED";
      botApplicationId: string | null;
      botName?: string | null;
      botPublic?: boolean | null;
    }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/runtime-status`,
    ),
    readStoredSettings(tenantId, guildId),
    readStoredConsoleLogs(tenantId, guildId),
    callApiServer<{
      plan: "FREE" | "PRO" | "ENTERPRISE";
      maxStorageBytes: number;
      usedStorageBytes: number;
    }>(
      `/app/tenants/${encodeURIComponent(tenantId)}/guilds/${encodeURIComponent(guildId)}/branding`,
    ),
  ]);

  if (!res.ok || !res.data) {
    return (
      <div
        id="access-denied-container"
        className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 shadow-sm max-w-lg mx-auto"
      >
        <div className="flex items-center gap-2.5 text-destructive mb-2">
          <ShieldAlert className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Access Denied</h1>
        </div>
        <p id="access-denied-message" className="text-sm text-destructive leading-relaxed">
          {res.error ?? "You do not have access to this guild or tenant."}
        </p>
        <div className="mt-6 pt-4 border-t border-destructive/15">
          <Button variant="outline" size="sm" asChild>
            <a href="/guilds">&larr; Back to Guild Selection</a>
          </Button>
        </div>
      </div>
    );
  }

  const { status, botApplicationId, botName, botPublic } = res.data;

  const brandingData = brandingRes.ok && brandingRes.data ? brandingRes.data : null;
  const currentPlan = brandingData?.plan ?? "FREE";
  const maxStorageBytes = brandingData?.maxStorageBytes ?? 30 * 1024 * 1024;
  const usedStorageBytes = brandingData?.usedStorageBytes ?? 0;
  const usedMb = (usedStorageBytes / (1024 * 1024)).toFixed(1);
  const maxMb = Math.round(maxStorageBytes / (1024 * 1024));
  const storagePercent =
    maxStorageBytes > 0
      ? Math.min(100, Math.round((usedStorageBytes / maxStorageBytes) * 100))
      : 0;

  const getBadgeVariant = (
    st: string,
  ): "success" | "default" | "warning" | "secondary" | "destructive" => {
    switch (st) {
      case "ONLINE":
        return "success";
      case "ACTIVE_ASSIGNMENT":
        return "default";
      case "UNASSIGNED":
        return "warning";
      case "NOT_CONFIGURED":
      case "STOPPED":
        return "secondary";
      case "DEGRADED":
      case "OFFLINE":
      default:
        return "destructive";
    }
  };

  const badgeVariant = getBadgeVariant(status);
  const isBotConfigured = Boolean(botApplicationId);
  const isIntentsActive = status === "ONLINE" || status === "ACTIVE_ASSIGNMENT";

  return (
    <div className="space-y-6">
      <PageHeader
        category="Server Control Plane"
        title="Guild Overview"
        description="Operational status and bot application configuration for this server."
        badge={
          <Badge
            variant={badgeVariant}
            className={`text-xs ${
              status === "UNASSIGNED" || status === "ACTIVE_ASSIGNMENT"
                ? "animate-pulse"
                : ""
            }`}
          >
            {status}
          </Badge>
        }
        backHref="/guilds"
        backLabel="All Servers"
      />

      {/* High-visibility Warning Banner if runtime degraded (e.g. token reset) */}
      {status === "DEGRADED" && (
        <div
          id="degraded-runtime-warning"
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive space-y-3"
        >
          <div className="flex items-center gap-2.5 font-semibold text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <span>Discord Authentication Failed (Bot Token Invalidated)</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Discord rejected your bot credentials or the Gateway session was invalidated.
            If you reset or regenerated your bot token in the Discord Developer Portal, the
            running bot cannot connect until you rotate the credentials.
          </p>
          <div className="pt-1">
            <Button
              size="sm"
              variant="destructive"
              asChild
              className="gap-2 text-xs font-semibold"
            >
              <a href={`/tenants/${tenantId}/guilds/${guildId}/setup`}>
                <KeyRound className="h-3.5 w-3.5" />
                <span>Rotate &amp; Reconnect Bot Token</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Public Bot Security Warning Banner */}
      {botPublic === true && (
        <div
          id="public-bot-warning-banner"
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-700 dark:text-amber-400 animate-in fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                <span>Security Notice: Public Bot is Enabled in Discord</span>
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 font-mono text-[9px]">
                  ACTION RECOMMENDED
                </Badge>
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your bot can currently be invited to unauthorized servers by anyone who has your Client ID, which can deplete your rate limits. To enforce dedicated 1-server isolation, turn off <strong>PUBLIC BOT</strong> in the Discord Developer Portal.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            asChild
            className="h-8 text-xs font-semibold shrink-0 bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
          >
            <a
              href={
                botApplicationId
                  ? `https://discord.com/developers/applications/${botApplicationId}/bot`
                  : "https://discord.com/developers/applications"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <span>Disable Public Bot</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}

      {/* Control Plane Status Rail */}
      <div
        id="guild-overview-card"
        className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs divide-y md:divide-y-0 md:divide-x divide-border/60 grid grid-cols-1 md:grid-cols-3"
      >
        {/* Cell 1: Server Identity */}
        <div className="p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Server className="h-3.5 w-3.5" />
            <span>Server Identity</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Discord Guild ID</span>
              <span id="overview-guild-id" className="font-mono text-foreground font-semibold">
                {guildId}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Tenant ID</span>
              <code
                id="overview-tenant-id"
                className="font-mono text-[11px] text-foreground bg-muted px-1.5 py-0.5 rounded"
              >
                {tenantId}
              </code>
            </div>
          </div>
        </div>

        {/* Cell 2: Bot Application */}
        <div className="p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            <span>Bot Application</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Application</span>
              <span id="overview-bot-app-status" className="font-medium text-foreground truncate block">
                {botApplicationId
                  ? botName
                    ? `${botName} • Configured (${botApplicationId})`
                    : `Configured (${botApplicationId})`
                  : "Not Configured"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Credential Security</span>
              <span id="overview-credential-status" className="font-medium text-foreground">
                {status === "NOT_CONFIGURED" ? "None" : "Stored & Encrypted"}
              </span>
            </div>
          </div>
        </div>

        {/* Cell 3: Runtime & Operations */}
        <div className="p-5 space-y-2.5 flex flex-col justify-between">
          {status === "NOT_CONFIGURED" ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Activity className="h-3.5 w-3.5" />
                    <span>Gateway Runtime</span>
                  </div>
                  <Badge
                    id="overview-runtime-status-badge"
                    data-status={status}
                    variant={badgeVariant}
                    className="text-[10px] font-semibold px-2 py-0.5"
                  >
                    {status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Bot credentials required to activate this server.
                </p>
              </div>

              <div id="setup-action-container" className="pt-2">
                <Button id="setup-bot-link" asChild size="sm" className="w-full text-xs font-semibold">
                  <a
                    href={`/tenants/${tenantId}/guilds/${guildId}/setup`}
                    className="flex items-center justify-center gap-2"
                  >
                    <span>Configure Discord Bot</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <BotPowerControls
              tenantId={tenantId}
              guildId={guildId}
              initialStatus={status}
              botApplicationId={botApplicationId}
            />
          )}
        </div>
      </div>

      {/* Storage & Resource Quota Rail */}
      <div
        id="overview-storage-quota-card"
        className="rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <HardDrive className="h-5 w-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Branding &amp; Media Storage</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono px-2 py-0 uppercase ${
                  currentPlan === "ENTERPRISE"
                    ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                    : currentPlan === "PRO"
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-primary/30 text-primary bg-primary/10"
                }`}
              >
                {currentPlan} Plan
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Avatars, welcome banners, dynamic canvas graphics &amp; bot assets
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
          <div className="space-y-1.5 min-w-[200px] sm:min-w-[240px]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Storage Used</span>
              <span className="text-foreground font-mono font-medium">
                {usedMb} MB / {maxMb} MB{" "}
                <span className="text-muted-foreground font-normal">({storagePercent}%)</span>
              </span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  storagePercent > 90
                    ? "bg-destructive"
                    : storagePercent > 70
                      ? "bg-amber-500"
                      : "bg-primary"
                }`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 text-xs font-medium cursor-pointer"
            >
              <a href={`/tenants/${tenantId}/guilds/${guildId}/modules/branding`}>
                <span>Manage Assets</span>
              </a>
            </Button>
            {currentPlan === "FREE" && (
              <Button
                size="sm"
                asChild
                className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                <a href={`/tenants/${tenantId}/guilds/${guildId}/billing`}>
                  <span>Upgrade to Pro</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Privileged Gateway Intents Panel */}
      <div className="rounded-xl border border-border/80 bg-card/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Privileged Gateway Intents</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Discord Gateway requires these three privileged intents enabled in the Developer Portal for real-time bot operations.
            </p>
          </div>
          <a
            href={
              botApplicationId
                ? `https://discord.com/developers/applications/${botApplicationId}/bot`
                : "https://discord.com/developers/applications"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium shrink-0"
          >
            <span>Discord Developer Portal</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Server Members Intent */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-foreground">Server Members</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono flex items-center gap-1 ${
                  isIntentsActive
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : isBotConfigured
                      ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                      : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                }`}
              >
                {isIntentsActive ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>ACTIVE</span>
                  </>
                ) : isBotConfigured ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>CONFIGURED</span>
                  </>
                ) : (
                  <span>REQUIRED</span>
                )}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Required for welcome greetings, dynamic canvas cards, auto-roles, and member join tracking.
            </p>
          </div>

          {/* Message Content Intent */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-semibold text-foreground">Message Content</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono flex items-center gap-1 ${
                  isIntentsActive
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : isBotConfigured
                      ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                      : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                }`}
              >
                {isIntentsActive ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>ACTIVE</span>
                  </>
                ) : isBotConfigured ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>CONFIGURED</span>
                  </>
                ) : (
                  <span>REQUIRED</span>
                )}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Required for auto-moderation bad word filters, custom message triggers, and bot prefix commands.
            </p>
          </div>

          {/* Presence Intent */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-foreground">Presence Intent</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono flex items-center gap-1 ${
                  isIntentsActive
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : "border-cyan-500/30 text-cyan-400 bg-cyan-500/10"
                }`}
              >
                {isIntentsActive ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>ACTIVE</span>
                  </>
                ) : (
                  <span>OPTIONAL</span>
                )}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Required for dynamic bot presence cycling, live activity tracking, and online member counters.
            </p>
          </div>

          {/* Public Bot Isolation Setting */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className={`h-3.5 w-3.5 ${botPublic === false ? "text-emerald-500" : "text-amber-500"}`} />
                <span className="text-xs font-semibold text-foreground">Public Bot Toggle</span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono flex items-center gap-1 ${
                  botPublic === false
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : botPublic === true
                      ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                      : "border-border text-muted-foreground"
                }`}
              >
                {botPublic === false ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>PRIVATE (OFF)</span>
                  </>
                ) : botPublic === true ? (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    <span>PUBLIC (ON)</span>
                  </>
                ) : (
                  <span>RECOMMENDED OFF</span>
                )}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {botPublic === false
                ? "Turned OFF. Bot is strictly private and cannot be added to unauthorized external servers."
                : "Should be turned OFF in Developer Portal to guarantee dedicated 1-server rate limits."}
            </p>
          </div>
        </div>

        {/* Module Setup Notice when Bot is NOT Configured */}
        {!isBotConfigured && (
          <div
            id="modules-locked-alert"
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-500"
          >
            <div className="flex items-center gap-2.5">
              <Lock className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                <strong>Setup Required:</strong> Bot application is not configured. Gateway Intents must be enabled in the Discord Developer Portal before modules can be activated.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="shrink-0 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-semibold"
            >
              <a href={`/tenants/${tenantId}/guilds/${guildId}/setup`} className="flex items-center gap-1.5">
                <span>Configure Bot &amp; Intents</span>
                <ArrowRight className="h-3 w-3" />
              </a>
            </Button>
          </div>
        )}
      </div>

      {/* Live Server Console */}
      <GuildLiveConsole
        tenantId={tenantId}
        guildId={guildId}
        guildTimezone={settings.timezone}
        initialLogs={initialLogs}
      />
    </div>
  );
}
