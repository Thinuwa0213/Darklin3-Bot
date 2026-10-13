"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import {
  Link2,
  Send,
  Save,
  Hash,
  Bot,
  History,
  Settings2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ProBadge, ModuleToggle } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import type { InvitesConfig } from "@/lib/invites-types";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";
import { saveInvitesConfigAction, sendTestInviteAlertAction } from "@/app/actions";
import { DiscordChatPreview } from "@/components/discord/discord-chat-preview";
import { cn } from "@/lib/utils";

interface InvitesViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  initialConfig: InvitesConfig;
  serverName: string;
  botName?: string | undefined;
  botAvatarUrl?: string | null | undefined;
  liveChannels: LiveDiscordChannel[];
  liveRoles: LiveDiscordRole[];
  botRuntimeStatus: string;
  isBotOnline: boolean;
}

type TabType = "settings" | "history";

export function InvitesView({
  tenantId,
  guildId,
  currentPlan = "FREE",
  initialConfig,
  serverName: _serverName,
  botName = "Darklin3 Bot",
  botAvatarUrl = null,
  liveChannels,
  liveRoles: _liveRoles,
  botRuntimeStatus: _botRuntimeStatus,
  isBotOnline = true,
}: InvitesViewProps) {
  const [config, setConfig] = useState<InvitesConfig>(initialConfig);
  const [activeTab, setActiveTab] = useState<TabType>("settings");
  const [isPending, startTransition] = useTransition();
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Clean Discord channels for SearchableSelect options
  const channelOptions: SearchableOption[] = useMemo(() => {
    return liveChannels.map((ch) => {
      const cleanName = ch.name.replace(/^#+/, "");
      return {
        value: ch.id,
        label: cleanName,
        icon: <Hash className="h-3.5 w-3.5 text-muted-foreground" />,
      };
    });
  }, [liveChannels]);

  const selectedChannelName = useMemo(() => {
    const found = liveChannels.find((c) => c.id === config.channelId);
    return found ? `#${found.name.replace(/^#+/, "")}` : config.channelName ? `#${config.channelName.replace(/^#+/, "")}` : "Not Selected";
  }, [liveChannels, config.channelId, config.channelName]);

  const handleChannelSelect = (channelId: string) => {
    const found = liveChannels.find((c) => c.id === channelId);
    setConfig((prev) => ({
      ...prev,
      channelId,
      channelName: found ? found.name.replace(/^#+/, "") : prev.channelName,
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      setFeedback(null);
      const res = await saveInvitesConfigAction(tenantId, guildId, config);
      if (res.ok && res.config) {
        setConfig(res.config);
        setFeedback({ type: "success", message: "Invite tracker configuration saved successfully!" });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to save configuration." });
      }
    });
  };

  const handleSendTest = async () => {
    if (!config.channelId) {
      setFeedback({ type: "error", message: "Please select an invite log channel before sending a test alert." });
      return;
    }
    setIsTesting(true);
    setFeedback(null);
    try {
      const res = await sendTestInviteAlertAction(tenantId, guildId, config);
      if (res.ok) {
        setFeedback({ type: "success", message: `Test invite alert successfully posted to ${selectedChannelName}!` });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to dispatch test invite alert." });
      }
    } catch {
      setFeedback({ type: "error", message: "An unexpected error occurred while sending the test alert." });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      {/* Top Header */}
      <PageHeader
        category="Community Growth & Security"
        title="Invite Tracker & Logger"
        description="Track invite origins, calculate inviter leaderboards, detect alt/fake accounts, and log member joins in real-time."
        badges={[
          currentPlan !== "FREE" ? (
            <ProBadge key="plan" label={currentPlan} />
          ) : (
            <Badge key="plan" variant="outline" className="font-mono text-[10px]">
              FREE
            </Badge>
          ),
        ].filter(Boolean)}
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <div className="flex items-center gap-2.5">
            <ModuleToggle
              enabled={config.enabled}
              onToggle={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
              activeLabel="Active"
              disabledLabel="Paused"
              disabled={!isBotOnline}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTest}
              disabled={isTesting || !config.enabled}
              className="gap-1.5 text-xs h-9 cursor-pointer"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Send Test</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              size="sm"
              className="gap-2 shadow-2xs font-semibold text-xs px-4 h-9 cursor-pointer"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>{isPending ? "Saving..." : "Save Changes"}</span>
            </Button>
          </div>
        }
      />

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Navigation Pills */}
      <div className="flex items-center gap-2 p-1 rounded-lg bg-muted/40 border border-border w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
            activeTab === "settings"
              ? "bg-background text-foreground shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span>Configuration</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
            activeTab === "history"
              ? "bg-background text-foreground shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <History className="h-3.5 w-3.5" />
          <span>Join History</span>
          {Boolean(config.recentJoins && config.recentJoins.length > 0) && (
            <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0 font-mono">
              {config.recentJoins?.length}
            </Badge>
          )}
        </button>
      </div>

      {/* TAB 1: CONFIGURATION */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Unified Configuration Surface (7 cols) */}
          <div className="xl:col-span-7 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs p-6 shadow-2xs space-y-6">
            {/* Section 1: Module Activation & Target Channel */}
            <section className="space-y-4">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-foreground">Invite Tracker Engine</span>
                <p className="text-xs text-muted-foreground">
                  Analyze member joins via Discord audit gateway to track inviters and links in real time.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="invite-channel-select" className="text-xs font-medium text-foreground">
                    Designated Logging Channel
                  </Label>
                  {config.channelId && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {selectedChannelName}
                    </Badge>
                  )}
                </div>
                <SearchableSelect
                  id="invite-channel-select"
                  options={channelOptions}
                  value={config.channelId || ""}
                  onChange={handleChannelSelect}
                  placeholder="Select channel (e.g. #invite-log, #joins)..."
                  searchPlaceholder="Search channels..."
                  emptyMessage="No text channels found"
                />
                <p className="text-[11px] text-muted-foreground">
                  Joined member notifications and Option 1 profile cards will be dispatched to this channel.
                </p>
              </div>
            </section>

            <div className="border-t border-border/60" />

            {/* Section 2: Security & Alt Account Protection Rules */}
            <section className="space-y-4">
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-foreground">Security &amp; Provenance Rules</span>
                <p className="text-xs text-muted-foreground">
                  Fine-tune anti-raid detection, bot logging, and vanity URL tracking.
                </p>
              </div>

              <div className="space-y-3">
                {/* Rule 1: Fresh Account Guard */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-foreground block">
                      Detect Suspicious Fresh Accounts
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Flag accounts created recently to mitigate raid campaigns and duplicate invite farming.
                    </p>
                    {config.protectFakes && (
                      <div className="flex items-center gap-2 pt-1.5">
                        <Label htmlFor="fake-age-input" className="text-[11px] text-muted-foreground">
                          Flag if account is younger than:
                        </Label>
                        <Input
                          id="fake-age-input"
                          type="number"
                          min={1}
                          max={90}
                          value={config.fakeAccountAgeDays || 7}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              fakeAccountAgeDays: Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 7)),
                            }))
                          }
                          className="h-7 w-18 text-center font-mono text-xs"
                        />
                        <span className="text-[11px] text-muted-foreground">Days</span>
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={config.protectFakes}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, protectFakes: checked }))}
                    className="shrink-0"
                  />
                </div>

                {/* Rule 2: Vanity Tracking */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-foreground">
                        Track Vanity URL Influx
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Distinguish between standard member invite links and the guild&apos;s custom Vanity URL.
                    </p>
                  </div>
                  <Switch
                    checked={config.trackVanity}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, trackVanity: checked }))}
                    className="shrink-0"
                  />
                </div>

                {/* Rule 3: Bot Tracking */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border/60 bg-muted/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-xs font-semibold text-foreground">
                        Log Automated Bot Additions
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Send audit notifications whenever an authorized bot application joins the server.
                    </p>
                  </div>
                  <Switch
                    checked={config.trackBots}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, trackBots: checked }))}
                    className="shrink-0"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Live Discord Option 1 Preview (5 cols) */}
          <div className="xl:col-span-5 sticky top-6 space-y-4">
            <DiscordChatPreview
              channelName={selectedChannelName || "invite-log"}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              headerRightSlot={
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
                  OPTION 1 ACTIVE
                </Badge>
              }
            >
              {/* Discord Embed Container */}
              <div className="rounded-md border-l-4 border-emerald-500 bg-[#2b2d31] p-3.5 space-y-3 text-xs relative shadow-xs">
                {/* Header + Thumbnail */}
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-bold text-white tracking-tight pt-0.5">
                    New Member Joined!
                  </h4>
                  <img
                    src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=160&auto=format&fit=crop&q=80"
                    alt="Member Avatar"
                    className="h-14 w-14 rounded-md object-cover shrink-0 ring-1 ring-white/10"
                  />
                </div>

                {/* Field 1: Joined Member's Details */}
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>👤</span>
                    <span>Joined Member&apos;s Details</span>
                  </div>
                  <div className="text-[11px] space-y-0.5 text-[#dbdee1] pl-0.5 leading-relaxed font-sans">
                    <p>
                      • <span className="text-[#949cf7] bg-[#5865f2]/15 px-1 py-0.5 rounded font-medium">@Alex_Rivers</span>
                    </p>
                    <p>
                      • Username: <code className="bg-[#1e1f22] text-[#e0e1e5] px-1 py-0.5 rounded text-[10px] font-mono">alex_rivers</code>
                    </p>
                    <p>
                      • User ID: <code className="bg-[#1e1f22] text-[#e0e1e5] px-1 py-0.5 rounded text-[10px] font-mono">982341059128471029</code>
                    </p>
                  </div>
                </div>

                {/* Field 2: Invited By */}
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>👥</span>
                    <span>Invited By</span>
                  </div>
                  <div className="text-[11px] space-y-0.5 text-[#dbdee1] pl-0.5 leading-relaxed font-sans">
                    <p>
                      • <span className="text-[#949cf7] bg-[#5865f2]/15 px-1 py-0.5 rounded font-medium">@CyberNova</span>
                    </p>
                    <p>
                      • Username: <code className="bg-[#1e1f22] text-[#e0e1e5] px-1 py-0.5 rounded text-[10px] font-mono">cybernova</code>
                    </p>
                    <p>
                      • User ID: <code className="bg-[#1e1f22] text-[#e0e1e5] px-1 py-0.5 rounded text-[10px] font-mono">731902481092847104</code>
                    </p>
                  </div>
                </div>

                {/* Field 3: Invite Link's Details */}
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>🔗</span>
                    <span>Invite Link&apos;s Details</span>
                  </div>
                  <div className="text-[11px] space-y-0.5 text-[#dbdee1] pl-0.5 leading-relaxed font-sans">
                    <p>
                      • Code: <span className="text-[#00a8fc] font-medium hover:underline cursor-pointer">CKE3p3WGPX</span>
                    </p>
                    <p>
                      • Channel: <span className="text-[#949cf7] bg-[#5865f2]/15 px-1 py-0.5 rounded font-medium">{selectedChannelName || "#logs"}</span>
                    </p>
                    <p>• Created at: October 3, 2025 5:42 AM</p>
                    <p>
                      • Expires at: <code className="bg-[#1e1f22] text-[#e0e1e5] px-1 py-0.5 rounded text-[10px] font-mono">∞</code>
                    </p>
                    <p>
                      • Uses: <code className="bg-[#1e1f22] text-[#e0e1e5] px-1 py-0.5 rounded text-[10px] font-mono">4 / ∞</code>
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-[#949ba4]">
                  <span>⚡ Alert powered by Darklin3 Bot</span>
                </div>
              </div>
            </DiscordChatPreview>
          </div>
        </div>
      )}

      {/* TAB 2: RECENT JOIN HISTORY */}
      {activeTab === "history" && (
        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Recent Join Events &amp; Audit Log
                </CardTitle>
                <CardDescription className="text-xs">
                  Last 50 member join records indexed by the Darklin3 Invite Tracker worker.
                </CardDescription>
              </div>
              <Badge variant="outline" className="w-fit text-xs font-mono font-normal">
                {config.recentJoins?.length || 0} Events Logged
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {!config.recentJoins || config.recentJoins.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground">
                  <History className="h-6 w-6" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <span className="text-xs font-semibold text-foreground block">
                    No Join Events Recorded Yet
                  </span>
                  <p className="text-xs text-muted-foreground">
                    When new members join via invite links or vanity URLs, their join provenance will appear here automatically.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground font-mono text-[10px] uppercase tracking-wider bg-muted/20">
                      <th className="py-2.5 px-3">Member</th>
                      <th className="py-2.5 px-3">Inviter</th>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Account Age</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    {config.recentJoins.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-[10px] font-bold text-foreground">
                              {item.userTag.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground block">{item.userTag}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{item.userId}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {item.inviterTag ? (
                            <span className="text-foreground font-medium">@{item.inviterTag}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Vanity / Direct</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {item.inviteCode ? (
                            <span className="font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                              {item.inviteCode}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-mono text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono text-muted-foreground">
                          {item.accountAgeDays}d old
                        </td>

                        <td className="py-3 px-3">
                          {item.isFake ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 bg-amber-500/10 font-mono">
                              Alt / Fake
                            </Badge>
                          ) : item.isBot ? (
                            <Badge variant="outline" className="text-[10px] border-purple-500/40 text-purple-400 bg-purple-500/10 font-mono">
                              Bot
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-mono">
                              Verified
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-3 text-muted-foreground font-mono text-[11px]">
                          {new Date(item.timestamp).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
