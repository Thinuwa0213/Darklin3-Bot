"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import {
  Save,
  Send,
  Image as ImageIcon,
  Mail,
  Hash,
  Loader2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ModuleToggle } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import type { BoosterConfig } from "@/lib/booster-storage";
import type { GuildSettings } from "@/lib/settings-storage";
import type { LiveDiscordChannel } from "../welcome/welcome-types";
import { saveBoosterConfigAction, sendTestBoostAlertAction } from "@/app/actions";
import { DiscordChatPreview } from "@/components/discord/discord-chat-preview";

interface BoosterViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  initialConfig: BoosterConfig;
  globalSettings?: GuildSettings | undefined;
  botName: string;
  botAvatarUrl: string | null;
  serverName: string;
  liveChannels: LiveDiscordChannel[];
  botRuntimeStatus: string;
  isBotOnline: boolean;
}

const PRESET_COLORS = [
  { label: "Nitro Rose", hex: "#F43F5E" },
  { label: "Neon Fuchsia", hex: "#EC4899" },
  { label: "Deep Purple", hex: "#A855F7" },
  { label: "Blurple", hex: "#5865F2" },
  { label: "Cyber Emerald", hex: "#10B981" },
  { label: "Golden Boost", hex: "#F59E0B" },
];

export function BoosterView({
  tenantId,
  guildId,
  currentPlan,
  initialConfig,
  globalSettings,
  botName,
  botAvatarUrl,
  serverName,
  liveChannels,
  botRuntimeStatus: _botRuntimeStatus,
  isBotOnline: _isBotOnline,
}: BoosterViewProps) {
  const isPro = currentPlan === "PRO" || currentPlan === "ENTERPRISE";
  const [config, setConfig] = useState<BoosterConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testSending, setTestSending] = useState(false);

  const isWhiteLabelActive = Boolean(isPro && config.customBranding);
  const resolvedFooterText = isWhiteLabelActive
    ? (config.customFooterText !== undefined && config.customFooterText.trim() !== ""
        ? config.customFooterText
        : `${serverName} • Server Booster Event`)
    : "⚡ Alert powered by Darklin3 Bot";

  const resolvedFooterIcon = isWhiteLabelActive
    ? (config.customFooterIconUrl !== undefined && config.customFooterIconUrl.trim() !== ""
        ? config.customFooterIconUrl
        : (globalSettings?.branding?.defaultFooterIconUrl || undefined))
    : undefined;

  // Clean Discord channels for SearchableSelect options (fixes double ## bug)
  const channelOptions: SearchableOption[] = useMemo(() => {
    return liveChannels.map((ch) => {
      const cleanName = ch.name.replace(/^#+/, "");
      return {
        value: ch.id,
        label: cleanName,
        icon: <Hash className="h-3.5 w-3.5" />,
      };
    });
  }, [liveChannels]);

  const handleSave = () => {
    if (!isPro) {
      setFeedback({ type: "error", message: "Server Booster announcements require an active PRO subscription." });
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const res = await saveBoosterConfigAction(tenantId, guildId, config);
      if (res.ok && res.config) {
        setConfig(res.config);
        setFeedback({ type: "success", message: "Server booster configuration saved successfully." });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to save configuration." });
      }
    });
  };

  const handleSendTestAlert = async () => {
    if (!isPro) {
      setFeedback({ type: "error", message: "Server Booster announcements require an active PRO subscription." });
      return;
    }

    if (!config.channelId) {
      setFeedback({ type: "error", message: "Please select an announcement channel first." });
      return;
    }
    setTestSending(true);
    setFeedback(null);
    try {
      const res = await sendTestBoostAlertAction(tenantId, guildId, { ...config, serverName } as any);
      if (res.ok) {
        setFeedback({ type: "success", message: "Test boost alert successfully published to Discord!" });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to send test alert to Discord." });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error sending test alert." });
    } finally {
      setTestSending(false);
    }
  };

  const insertVariable = (varName: string) => {
    setConfig((prev) => ({
      ...prev,
      message: `${prev.message} ${varName}`,
    }));
  };

  // Preview formatted message
  const previewFormattedMessage = (config.message || "")
    .replaceAll("{user}", "@BoosterChampion")
    .replaceAll("{username}", "BoosterChampion")
    .replaceAll("{server}", serverName)
    .replaceAll("{boost_count}", "7")
    .replaceAll("{count}", "7");

  const previewFormattedTitle = (config.title || "")
    .replaceAll("{user}", "@BoosterChampion")
    .replaceAll("{server}", serverName)
    .replaceAll("{boost_count}", "7")
    .replaceAll("{count}", "7");

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      <PageHeader
        category="Community Engagement"
        title="Server Booster Announcements"
        description="Celebrate members when they boost your server with dynamic Nitro embeds, pings, and DM appreciation."
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <div className="flex items-center gap-2.5">
            <ModuleToggle
              enabled={config.enabled && isPro}
              onToggle={(checked) => {
                if (!isPro) return;
                setConfig((prev) => ({ ...prev, enabled: checked }));
              }}
              activeLabel="Active"
              disabledLabel="Paused"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendTestAlert}
              disabled={!isPro || testSending || !config.channelId}
              className="gap-2 shadow-2xs h-9 cursor-pointer text-xs"
            >
              <Send className="h-3.5 w-3.5 text-pink-500" />
              <span>{testSending ? "Sending..." : "Test Alert"}</span>
            </Button>
            {isPro ? (
              <Button
                onClick={handleSave}
                disabled={isPending}
                size="sm"
                className="gap-2 shadow-2xs h-9 bg-pink-600 hover:bg-pink-700 text-white cursor-pointer font-semibold text-xs px-4"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{isPending ? "Saving..." : "Save Changes"}</span>
              </Button>
            ) : (
              <Button
                size="sm"
                asChild
                className="gap-1.5 shadow-2xs h-9 bg-pink-600 hover:bg-pink-700 text-white cursor-pointer font-semibold text-xs px-3"
              >
                <a href={`/tenants/${tenantId}/guilds/${guildId}/billing`}>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Upgrade to Pro</span>
                </a>
              </Button>
            )}
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

      {/* Pro Locked Callout Banner for Free Tier */}
      {!isPro && (
        <Card className="border-pink-500/30 bg-pink-500/5 shadow-2xs">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>Server Booster Announcements is a PRO Feature</span>
                  <Badge variant="outline" className="text-[10px] border-pink-500/40 text-pink-500 font-mono">
                    PRO
                  </Badge>
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Upgrade your server to Creator Pro to celebrate Nitro boosts with automated embeds, thank-you DMs, and custom role rewards.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              asChild
              className="bg-pink-600 hover:bg-pink-700 text-white font-semibold text-xs h-8 shrink-0 shadow-xs cursor-pointer"
            >
              <a href={`/tenants/${tenantId}/guilds/${guildId}/billing`}>
                <span>Upgrade to Pro</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Grid: Settings & Live Mockup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (7 cols) - Dimmed & non-interactive for Free tier */}
        <div className={`lg:col-span-7 space-y-6 ${!isPro ? "opacity-50 pointer-events-none select-none cursor-not-allowed" : ""}`}>
          {/* Master Configuration Card */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Booster Alert System</CardTitle>
                <CardDescription className="text-xs">
                  Automatically detect server boosts and announce them in Discord.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="booster-channel" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Announcement Channel
                </Label>
                {liveChannels.length > 0 ? (
                  <SearchableSelect
                    id="booster-channel"
                    options={channelOptions}
                    value={config.channelId ?? ""}
                    onChange={(val) => setConfig((prev) => ({ ...prev, channelId: val || undefined }))}
                    placeholder="Search channel by name or ID..."
                    searchPlaceholder="Type channel name (e.g. general, announcements)..."
                    emptyMessage="No Discord channels match your search"
                  />
                ) : (
                  <Input
                    id="booster-channel"
                    placeholder="Enter Channel ID (e.g. 1092837465910)"
                    value={config.channelId ?? ""}
                    onChange={(e) => setConfig((prev) => ({ ...prev, channelId: e.target.value || undefined }))}
                    className="text-xs font-mono h-9 rounded-lg"
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  The bot will post the congratulatory message in this channel when someone boosts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Use Rich Embed</Label>
                    <p className="text-[10px] text-muted-foreground">Stylish Nitro card vs plain text</p>
                  </div>
                  <Switch
                    checked={config.useEmbed}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, useEmbed: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium text-foreground">Mention Booster</Label>
                    <p className="text-[10px] text-muted-foreground">Ping the user in the channel</p>
                  </div>
                  <Switch
                    checked={config.pingUser}
                    onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, pingUser: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual Styling Card */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3">
              <div className="text-sm font-semibold">
                Message &amp; Visual Customization
              </div>
              <CardDescription className="text-xs">
                Personalize your server's appreciation message, brand colors, and banner imagery.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="embed-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Embed Title
                </Label>
                <Input
                  id="embed-title"
                  value={config.title}
                  onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="🚀 NEW SERVER BOOST!"
                  className="font-medium"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="embed-message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Announcement Message
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Insert:</span>
                    {["{user}", "{server}", "{boost_count}"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertVariable(tag)}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 border border-pink-500/20 cursor-pointer transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  id="embed-message"
                  rows={3}
                  value={config.message}
                  onChange={(e) => setConfig((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full p-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-pink-500/30 text-foreground resize-none font-normal leading-relaxed"
                  placeholder="A massive thank you to {user} for boosting {server}! We have reached {boost_count} boosts!"
                />
              </div>

              {/* Accent Color Picker */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Accent Color
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.accentColor || "#F43F5E"}
                    onChange={(e) => setConfig((prev) => ({ ...prev, accentColor: e.target.value }))}
                    className="h-9 w-12 rounded border border-border bg-background cursor-pointer p-0.5"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, accentColor: preset.hex }))}
                        className={`px-2 py-1 text-[11px] rounded-md font-medium border transition-all cursor-pointer ${
                          config.accentColor.toLowerCase() === preset.hex.toLowerCase()
                            ? "border-pink-500 bg-pink-500/20 text-foreground font-semibold"
                            : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                          style={{ backgroundColor: preset.hex }}
                        />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Banner Image URL */}
              <div className="space-y-2 pt-1">
                <Label htmlFor="banner-url" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Banner Image URL (Optional)
                </Label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="banner-url"
                    value={config.bannerUrl ?? ""}
                    onChange={(e) => setConfig((prev) => ({ ...prev, bannerUrl: e.target.value || undefined }))}
                    placeholder="https://example.com/banner.png"
                    className="pl-9 text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Supports animated GIFs, PNGs, and JPEGs displayed across the bottom of the embed.
                </p>
              </div>

              {/* Embed Footer Branding */}
              <div className="space-y-3 pt-3 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="white-label-switch" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Custom White-Label Footer
                      </Label>
                      {!isPro ? (
                        <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-500 bg-amber-500/10">
                          PRO ONLY
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                          PRO
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Remove official Darklin3 Bot watermark and use your own community branding.
                    </p>
                  </div>
                  {isPro && (
                    <Switch
                      id="white-label-switch"
                      checked={config.customBranding ?? false}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, customBranding: checked }))
                      }
                    />
                  )}
                </div>

                {!isPro ? (
                  <div className="space-y-1.5 pt-1">
                    <Input
                      id="custom-footer"
                      disabled
                      value="⚡ Alert powered by Darklin3 Bot"
                      className="text-xs bg-muted/40 cursor-not-allowed opacity-80"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Free tier servers display the official Darklin3 Bot watermark in embed footers. Upgrade to PRO to enable white-labeling.
                    </p>
                  </div>
                ) : config.customBranding ? (
                  <div className="space-y-2.5 pt-1 rounded-lg border border-border/60 bg-muted/20 p-3">
                    <div className="space-y-1">
                      <Label htmlFor="custom-footer-text" className="text-[11px] font-medium text-foreground">
                        Custom Footer Text
                      </Label>
                      <Input
                        id="custom-footer-text"
                        value={config.customFooterText ?? ""}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, customFooterText: e.target.value || undefined }))
                        }
                        placeholder={`e.g. VIP Booster Alert (leave blank for ${serverName} • Server Booster Event)`}
                        className="text-xs bg-background"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="custom-footer-icon" className="text-[11px] font-medium text-foreground">
                        Custom Footer Icon URL (Optional)
                      </Label>
                      <Input
                        id="custom-footer-icon"
                        value={config.customFooterIconUrl ?? ""}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, customFooterIconUrl: e.target.value || undefined }))
                        }
                        placeholder="https://example.com/icon.png (leave blank for Server Icon)"
                        className="text-xs bg-background"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Defaults to <span className="font-mono text-foreground/80">{serverName} • Server Booster Event</span> with server icon when left blank.
                    </p>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-md border border-border/40">
                    White-labeling is currently <span className="font-medium text-foreground">OFF</span>. Footer displays <span className="font-mono text-foreground">⚡ Alert powered by Darklin3 Bot</span>. Toggle the switch to customize.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Thank You DM Appreciation Card */}
          <Card className="border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-pink-500" />
                  <div>
                    <CardTitle className="text-sm font-semibold">Direct Message Appreciation (DM)</CardTitle>
                    <CardDescription className="text-xs">
                      Send a private thank-you message to the user's DMs upon boosting.
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={config.thankYouDm}
                  onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, thankYouDm: checked }))}
                />
              </div>
            </CardHeader>

            {config.thankYouDm && (
              <CardContent className="space-y-2 pt-1">
                <Label htmlFor="thank-you-dm-message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  DM Message Text
                </Label>
                <textarea
                  id="thank-you-dm-message"
                  rows={2}
                  value={config.thankYouDmMessage ?? ""}
                  onChange={(e) => setConfig((prev) => ({ ...prev, thankYouDmMessage: e.target.value }))}
                  className="w-full p-3 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-pink-500/30 text-foreground resize-none font-normal leading-relaxed"
                  placeholder="Thank you for boosting {server}! Your support unlocks higher audio quality and custom emojis!"
                />
              </CardContent>
            )}
          </Card>
        </div>

        {/* Right Column: Live Discord Interactive Mockup (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6 space-y-3">
            <DiscordChatPreview
              channelName={(liveChannels.find((c) => c.id === config.channelId)?.name || "announcements")}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              mention={config.pingUser ? "@BoosterChampion" : undefined}
              headerRightSlot={
                <Badge variant="outline" className="text-[10px] font-mono border-pink-500/30 text-pink-400 bg-pink-500/10">
                  REAL-TIME
                </Badge>
              }
            >
              {/* Rich Embed vs Plain Text */}
              {config.useEmbed ? (
                <div
                  className="mt-2 rounded-md bg-[#2b2d31] p-3 border-l-4 text-xs space-y-2 max-w-sm"
                  style={{ borderLeftColor: config.accentColor || "#F43F5E" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-sm leading-tight">
                        {previewFormattedTitle}
                      </h4>
                      <p className="text-[#dbdee1] text-xs leading-relaxed whitespace-pre-wrap">
                        {previewFormattedMessage}
                      </p>
                    </div>
                    {/* Booster Avatar Thumbnail */}
                    <div className="w-10 h-10 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center shrink-0 text-pink-400 font-bold text-xs">
                      💎
                    </div>
                  </div>

                  {/* Banner Image Preview */}
                  {config.bannerUrl && (
                    <div className="mt-2 rounded overflow-hidden max-h-40 border border-white/5">
                      <img
                        src={config.bannerUrl}
                        alt="Banner Preview"
                        className="w-full h-auto object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Embed Footer */}
                  <div className="flex items-center gap-1.5 pt-1 text-[10px] text-[#949ba4]">
                    {resolvedFooterIcon ? (
                      <img
                        src={resolvedFooterIcon}
                        alt="Footer Icon"
                        className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                      />
                    ) : null}
                    <span>{resolvedFooterText}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#dbdee1] mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {previewFormattedMessage}
                </p>
              )}
            </DiscordChatPreview>
          </div>
        </div>
      </div>
    </div>
  );
}
