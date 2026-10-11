"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Radar,
  Plus,
  Save,
  Loader2,
  Lock,
  Tag,
  Shield,
  MessageSquare,
  Clock,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import { VariableChips } from "@/components/modules/variable-chips";
import { RADAR_VARIABLES } from "@/lib/template-variables";
import { saveCommunityRadarAction } from "@/app/actions";
import { PageHeader, ProBadge, ModuleToggle } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import type { CommunityRadarConfig } from "@/lib/streams-storage";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";

interface CommunityRadarViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  initialRadar?: CommunityRadarConfig | undefined;
  liveChannels?: LiveDiscordChannel[] | undefined;
  liveRoles?: LiveDiscordRole[] | undefined;
}

export function CommunityRadarView({
  tenantId,
  guildId,
  currentPlan,
  initialRadar,
  liveChannels = [],
  liveRoles = [],
}: CommunityRadarViewProps) {
  const isPro = currentPlan === "PRO" || currentPlan === "ENTERPRISE";

  const channels = useMemo(() => {
    if (liveChannels && liveChannels.length > 0) return liveChannels;
    return [
      { id: "default-radar", name: "#community-streams", type: 0, position: 0 },
      { id: "default-general", name: "#general", type: 0, position: 1 },
    ];
  }, [liveChannels]);

  const roles = useMemo(() => {
    const list = [
      { id: "everyone", name: "@everyone", color: "#99AAB5" },
      { id: "here", name: "@here", color: "#99AAB5" },
      { id: "none", name: "No Ping (Silent)", color: "#71717A" },
    ];
    if (liveRoles && liveRoles.length > 0) {
      for (const r of liveRoles) {
        list.push({
          id: r.id,
          name: r.name.startsWith("@") ? r.name : `@${r.name}`,
          color: r.color || "#A1A1AA",
        });
      }
    }
    return list;
  }, [liveRoles]);

  // Form states
  const [enabled, setEnabled] = useState(initialRadar?.enabled ?? false);
  const [keywords, setKeywords] = useState<string[]>(
    initialRadar?.keywords ?? ["[SLRP]"],
  );
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [gameFilter, setGameFilter] = useState(initialRadar?.gameFilter ?? "");
  const [requiredRoleId, setRequiredRoleId] = useState(
    initialRadar?.requiredRoleId ?? "none",
  );
  const [liveRoleId, setLiveRoleId] = useState(initialRadar?.liveRoleId ?? "");
  const [discordChannelId, setDiscordChannelId] = useState(
    initialRadar?.discordChannelId || (channels[0]?.id ?? "none"),
  );
  const [pingRoleId, setPingRoleId] = useState(
    initialRadar?.pingRoleId ?? "none",
  );
  const [customMessage, setCustomMessage] = useState(
    initialRadar?.customMessage ??
      "🎮 **{member}** is streaming **{game}** with **{keyword}**!\nCome hang out: {url}",
  );
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(
    initialRadar?.cooldownMinutes ?? 360,
  );

  // Branding & Watermark settings (Free vs PRO)
  const [customBranding, setCustomBranding] = useState(
    initialRadar?.customBranding ?? false,
  );
  const [customFooterText, setCustomFooterText] = useState(
    initialRadar?.customFooterText ?? "",
  );

  // Status states
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddKeyword = () => {
    const trimmed = newKeywordInput.trim();
    if (!trimmed) return;
    if (!keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) {
      setKeywords([...keywords, trimmed]);
    }
    setNewKeywordInput("");
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setKeywords(keywords.filter((k) => k !== kwToRemove));
  };

  const handleInsertToken = (token: string) => {
    setCustomMessage((prev) => (prev.endsWith(" ") ? prev + token : prev + " " + token));
  };

  const handleSave = async () => {
    if (!isPro) {
      setErrorMessage("Community Stream Radar requires an active PRO subscription.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const payload: CommunityRadarConfig = {
      enabled,
      keywords,
      gameFilter: gameFilter.trim() || undefined,
      requiredRoleId: requiredRoleId !== "none" ? requiredRoleId : undefined,
      requiredRoleName:
        requiredRoleId !== "none" ? roles.find((r) => r.id === requiredRoleId)?.name : undefined,
      liveRoleId: liveRoleId || undefined,
      liveRoleName: liveRoleId ? roles.find((r) => r.id === liveRoleId)?.name : undefined,
      discordChannelId: discordChannelId !== "none" ? discordChannelId : undefined,
      discordChannelName:
        discordChannelId !== "none" ? channels.find((c) => c.id === discordChannelId)?.name : undefined,
      pingRoleId,
      pingRoleName: roles.find((r) => r.id === pingRoleId)?.name,
      customMessage: customMessage.trim(),
      cooldownMinutes,
      customBranding: isPro ? customBranding : false,
      customFooterText: isPro && customBranding ? customFooterText.trim() || undefined : undefined,
    };

    try {
      const res = await saveCommunityRadarAction(tenantId, guildId, payload);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setErrorMessage(res.error ?? "Failed to save Community Radar configuration.");
      }
    } catch (err) {
      setErrorMessage((err as Error)?.message ?? "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Top Header Card */}
      <PageHeader
        category="Community Stream Discovery"
        title="Community Stream Radar"
        description="Automatically detect and announce server members streaming on Twitch, YouTube, or Kick when their stream title contains your server keyword or tag."
        badge={<ProBadge />}
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <div className="flex items-center gap-2.5 shrink-0">
            <ModuleToggle
              enabled={enabled}
              onToggle={setEnabled}
              activeLabel="Active"
              disabledLabel="Paused"
              disabled={!isPro}
            />

            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="gap-1.5 h-9 font-medium shadow-2xs cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{isSaving ? "Saving..." : saved ? "Saved" : "Save Changes"}</span>
            </Button>
          </div>
        }
      />

      {/* Status Notifications */}
      {saved && (
        <FeedbackBanner
          type="success"
          message="Community Stream Radar settings saved successfully."
          onDismiss={() => setSaved(false)}
        />
      )}

      {errorMessage && (
        <FeedbackBanner
          type="error"
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {!isPro && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground">Community Radar is a PRO Feature</h4>
                <p className="text-[11px] text-muted-foreground">
                  Upgrade your server subscription to automatically monitor community members streaming with your server tags.
                </p>
              </div>
            </div>
            <Badge variant="default" className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0 font-medium">
              Upgrade to PRO
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Left Controls (7 cols) + Right Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column Controls */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Keywords & Title Detection */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <span>Title Keywords &amp; Tags</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Radar scans Discord streaming presences for any of these tags in the stream title.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="e.g. [SLRP], #SLRP, or CeylonRP"
                  value={newKeywordInput}
                  onChange={(e) => setNewKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  className="text-xs font-mono h-8.5"
                  disabled={!isPro}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddKeyword}
                  disabled={!isPro || !newKeywordInput.trim()}
                  className="h-8.5 text-xs shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>Add Tag</span>
                </Button>
              </div>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {keywords.length === 0 ? (
                  <span className="text-[11px] text-amber-500/80 italic">
                    No keywords added yet. Add at least one tag.
                  </span>
                ) : (
                  keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-muted/60 text-foreground border border-border/80"
                    >
                      <Tag className="h-3 w-3 text-amber-500" />
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        disabled={!isPro}
                        className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer ml-0.5"
                        aria-label={`Remove tag ${kw}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              <Separator className="bg-border/50" />

              {/* Game Category Filter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="game-filter" className="text-xs font-semibold">
                    Game Category Filter (Optional)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">Leave empty for any game</span>
                </div>
                <Input
                  id="game-filter"
                  placeholder="e.g. Grand Theft Auto V or FiveM"
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className="text-xs h-8.5"
                  disabled={!isPro}
                />
                <p className="text-[10px] text-muted-foreground">
                  Only alert if the user is playing this specific game.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Roles & Permissions */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-400" />
                <span>Member Roles &amp; Live Auto-Role</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Control who is allowed to trigger the radar and assign a temporary live role.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Required Member Role (Anti-Spam Whitelist)</Label>
                <select
                  value={requiredRoleId}
                  onChange={(e) => setRequiredRoleId(e.target.value)}
                  disabled={!isPro}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs shadow-xs font-medium"
                >
                  <option value="none">Anyone with Discord Streaming Status (No role required)</option>
                  {roles
                    .filter((r) => r.id !== "everyone" && r.id !== "here" && r.id !== "none")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Only members with this role)
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Protects your server against fresh spam accounts.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Community Live Role (Auto-Assigned)</Label>
                <select
                  value={liveRoleId}
                  onChange={(e) => setLiveRoleId(e.target.value)}
                  disabled={!isPro}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs shadow-xs font-medium"
                >
                  <option value="">Disabled (Do not assign role)</option>
                  {roles
                    .filter((r) => r.id !== "everyone" && r.id !== "here" && r.id !== "none")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Bot assigns this role when member starts streaming with your tag, and strips it when they go offline.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Announcement Channel & Message Template */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-400" />
                <span>Channel, Ping &amp; Template</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Configure where radar alerts are posted and format the notification text.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Announcement Channel</Label>
                  <select
                    value={discordChannelId}
                    onChange={(e) => setDiscordChannelId(e.target.value)}
                    disabled={!isPro}
                    className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs shadow-xs font-medium"
                  >
                    <option value="none">Select channel...</option>
                    {channels.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name.startsWith("#") ? ch.name : `#${ch.name}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ping Role</Label>
                  <select
                    value={pingRoleId}
                    onChange={(e) => setPingRoleId(e.target.value)}
                    disabled={!isPro}
                    className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs shadow-xs font-medium"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Notification Cooldown</span>
                  </Label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {Math.round(cooldownMinutes / 60)} Hours ({cooldownMinutes} min)
                  </span>
                </div>
                <select
                  value={cooldownMinutes}
                  onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                  disabled={!isPro}
                  className="w-full h-8.5 rounded-md border border-input bg-background px-3 text-xs shadow-xs font-medium"
                >
                  <option value={60}>1 Hour</option>
                  <option value={120}>2 Hours</option>
                  <option value={360}>6 Hours (Recommended)</option>
                  <option value={720}>12 Hours</option>
                  <option value={1440}>24 Hours</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Prevents alert spam if a member restarts their stream repeatedly.
                </p>
              </div>

              <Separator className="bg-border/50" />

              {/* Message Template & Variable Chips */}
              <div className="space-y-2">
                <Label htmlFor="radar-custom-msg" className="text-xs font-semibold">
                  Custom Message Template
                </Label>
                <textarea
                  id="radar-custom-msg"
                  rows={3}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  disabled={!isPro}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono leading-relaxed"
                />
                <VariableChips
                  variables={RADAR_VARIABLES}
                  onInsert={handleInsertToken}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Alert Branding & Watermark */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Alert Branding &amp; Watermark</span>
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-[9px] font-mono px-1.5 py-0 ${
                    isPro ? "text-amber-500 border-amber-500/30 bg-amber-500/10" : "text-muted-foreground"
                  }`}
                >
                  {isPro ? "PRO White-Label" : "Free Plan Watermark"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Control embed footer watermarking and customer white-labeling.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isPro ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-600 dark:text-amber-400 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>CreatorCore Branding Active</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Free plan alerts display <strong className="text-foreground">⚡ Community Radar powered by CreatorCore • creatorcore.app</strong> in the Discord embed footer. Upgrade to PRO to enable white-labeling or use your own custom server footer.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold">Custom Branding / White-Label</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Remove default CreatorCore branding from alert embeds.
                      </p>
                    </div>
                    <Switch
                      checked={customBranding}
                      onCheckedChange={setCustomBranding}
                    />
                  </div>

                  {customBranding && (
                    <div className="space-y-1.5 pt-2 border-t border-border/50 animate-in fade-in">
                      <Label htmlFor="custom-footer" className="text-xs font-semibold">
                        Custom Footer Text (Optional)
                      </Label>
                      <Input
                        id="custom-footer"
                        placeholder="e.g. My Server Alerts (leave empty to hide footer)"
                        value={customFooterText}
                        onChange={(e) => setCustomFooterText(e.target.value)}
                        className="text-xs font-mono h-8.5"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Leave empty to post clean embeds with no footer text.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Discord Radar Mockup */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/80 sticky top-4 overflow-hidden shadow-sm">
            <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Radar className="h-3.5 w-3.5 text-amber-500" />
                  <span>Discord Radar Preview</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                  {channels.find((c) => c.id === discordChannelId)?.name ?? "#community-streams"}
                </Badge>
              </div>
              <CardDescription className="text-[11px]">
                Clean, native Discord embed simulation reflecting live stream detection.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-3 bg-[#313338] text-white">
              {/* Message Ping & Description */}
              <div className="space-y-1 text-xs">
                <div className="text-white/95 leading-relaxed font-sans">
                  {pingRoleId === "everyone" ? (
                    <span className="text-[#5865f2] bg-[#5865f2]/10 px-1 py-0.5 rounded font-medium">@everyone</span>
                  ) : pingRoleId === "here" ? (
                    <span className="text-[#5865f2] bg-[#5865f2]/10 px-1 py-0.5 rounded font-medium">@here</span>
                  ) : pingRoleId !== "none" ? (
                    <span className="text-[#5865f2] bg-[#5865f2]/10 px-1 py-0.5 rounded font-medium">
                      {roles.find((r) => r.id === pingRoleId)?.name || "@Streamers"}
                    </span>
                  ) : null}
                  {" "}
                  <span>
                    {customMessage
                      .replace(/{member}/g, "Kasun_SLRP")
                      .replace(/{game}/g, gameFilter || "Grand Theft Auto V")
                      .replace(/{keyword}/g, keywords[0] || "[SLRP]")
                      .replace(/{url}/g, "")}
                  </span>
                </div>
                <a
                  href="#preview-link"
                  onClick={(e) => e.preventDefault()}
                  className="text-[#00a8fc] hover:underline break-all block font-sans"
                >
                  https://twitch.tv/kasun_slrp
                </a>
              </div>

              {/* Native Discord Embed */}
              <div className="rounded-md border-l-4 border-l-[#5865f2] bg-[#2b2d31] p-3 text-white space-y-2.5 shadow-md">
                {/* Author Header */}
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    K
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-[#949ba4] font-medium leading-none">Twitch</span>
                    <span className="text-xs font-bold text-white leading-tight">
                      Kasun_SLRP is live with {keywords[0] || "[SLRP]"} tag!
                    </span>
                  </div>
                </div>

                {/* Clickable Blue Stream Title */}
                <p className="text-sm font-semibold text-[#00a8fc] hover:underline cursor-pointer leading-snug">
                  Police Patrol Duty! {keywords[0] || "[SLRP]"} Sri Lanka Server #1
                </p>

                {/* 16:9 Thumbnail Banner */}
                <div className="rounded-md overflow-hidden bg-black/50 border border-white/5 relative aspect-video flex items-center justify-center">
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white font-black text-[9px] tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>LIVE</span>
                  </div>
                  <div className="text-center p-3">
                    <p className="text-xs font-bold text-white/90">Kasun_SLRP</p>
                    <p className="text-[11px] text-white/60">{gameFilter || "Grand Theft Auto V"}</p>
                  </div>
                </div>

                {/* Branding Footer */}
                <div className="pt-1.5 flex items-center justify-between text-[10px] text-[#949ba4] font-mono border-t border-white/5">
                  {customBranding && isPro ? (
                    <span>{customFooterText || "Custom Server Alerts"}</span>
                  ) : (
                    <span>⚡ Community Radar powered by CreatorCore • creatorcore.app</span>
                  )}
                  <span>Today at 10:10 AM</span>
                </div>
              </div>

              {/* Sub-info Badges */}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-[#2b2d31]/60 px-3 py-2 rounded-lg border border-white/5 font-mono">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-purple-400" />
                  <span>Role: {roles.find((r) => r.id === liveRoleId)?.name || "None"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span>Cooldown: {Math.round(cooldownMinutes / 60)}h</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
