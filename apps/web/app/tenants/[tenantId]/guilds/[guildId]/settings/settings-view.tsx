"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  Globe,
  Bell,
  ShieldAlert,
  Sparkles,
  Save,
  CheckCircle2,
  Clock,
  Hash,
  Palette,
  Pipette,
  ArrowRight,
  Radio,
  UserCheck,
  Zap,
  Check,
} from "lucide-react";
import { PageHeader, ProBadge } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import type { LiveDiscordChannel } from "../modules/welcome/welcome-types";
import type { GuildSettings } from "@/lib/settings-storage";
import { saveGuildSettingsAction } from "@/app/actions";

interface SettingsViewProps {
  tenantId: string;
  guildId: string;
  guildName: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  channels: LiveDiscordChannel[];
  initialSettings: GuildSettings;
}

const TIMEZONE_OPTIONS: SearchableOption[] = [
  { value: "Asia/Colombo", label: "Asia/Colombo (UTC+05:30)", sublabel: "Sri Lanka", icon: <Clock className="h-3 w-3" /> },
  { value: "UTC", label: "UTC (UTC+00:00)", sublabel: "Universal Coordinated", icon: <Clock className="h-3 w-3" /> },
  { value: "America/New_York", label: "America/New_York (UTC-05:00 / UTC-04:00)", sublabel: "US Eastern", icon: <Clock className="h-3 w-3" /> },
  { value: "America/Chicago", label: "America/Chicago (UTC-06:00 / UTC-05:00)", sublabel: "US Central", icon: <Clock className="h-3 w-3" /> },
  { value: "America/Denver", label: "America/Denver (UTC-07:00 / UTC-06:00)", sublabel: "US Mountain", icon: <Clock className="h-3 w-3" /> },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-08:00 / UTC-07:00)", sublabel: "US Pacific", icon: <Clock className="h-3 w-3" /> },
  { value: "America/Toronto", label: "America/Toronto (UTC-05:00)", sublabel: "Canada", icon: <Clock className="h-3 w-3" /> },
  { value: "Europe/London", label: "Europe/London (UTC+00:00 / UTC+01:00)", sublabel: "United Kingdom", icon: <Clock className="h-3 w-3" /> },
  { value: "Europe/Paris", label: "Europe/Paris (UTC+01:00 / UTC+02:00)", sublabel: "France", icon: <Clock className="h-3 w-3" /> },
  { value: "Europe/Berlin", label: "Europe/Berlin (UTC+01:00 / UTC+02:00)", sublabel: "Germany", icon: <Clock className="h-3 w-3" /> },
  { value: "Asia/Dubai", label: "Asia/Dubai (UTC+04:00)", sublabel: "UAE / Gulf", icon: <Clock className="h-3 w-3" /> },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (UTC+05:30)", sublabel: "India", icon: <Clock className="h-3 w-3" /> },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (UTC+06:00)", sublabel: "Bangladesh", icon: <Clock className="h-3 w-3" /> },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (UTC+07:00)", sublabel: "Thailand", icon: <Clock className="h-3 w-3" /> },
  { value: "Asia/Singapore", label: "Asia/Singapore (UTC+08:00)", sublabel: "Singapore", icon: <Clock className="h-3 w-3" /> },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+09:00)", sublabel: "Japan", icon: <Clock className="h-3 w-3" /> },
  { value: "Asia/Seoul", label: "Asia/Seoul (UTC+09:00)", sublabel: "South Korea", icon: <Clock className="h-3 w-3" /> },
  { value: "Australia/Sydney", label: "Australia/Sydney (UTC+10:00 / UTC+11:00)", sublabel: "Sydney", icon: <Clock className="h-3 w-3" /> },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (UTC+12:00 / UTC+13:00)", sublabel: "New Zealand", icon: <Clock className="h-3 w-3" /> },
];

const PRESET_COLORS = [
  { label: "Blurple", hex: "#5865F2" },
  { label: "Emerald", hex: "#57F287" },
  { label: "Gold", hex: "#FEE75C" },
  { label: "Crimson", hex: "#ED4245" },
  { label: "Fuchsia", hex: "#EB459E" },
  { label: "Cyan", hex: "#00B0F4" },
  { label: "Dark Slate", hex: "#2B2D31" },
];

export function SettingsView({
  tenantId,
  guildId,
  guildName,
  currentPlan,
  channels,
  initialSettings,
}: SettingsViewProps) {
  const isPro = currentPlan === "PRO" || currentPlan === "ENTERPRISE";

  // General settings state
  const [timezone, setTimezone] = useState(initialSettings.timezone || "Asia/Colombo");
  const locale = "en"; // English is the sole supported language for now

  // Notification channels state
  const [systemAlertChannelId, setSystemAlertChannelId] = useState(
    initialSettings.systemAlertChannelId || "",
  );
  const [notificationChannelId, setNotificationChannelId] = useState(
    initialSettings.notificationChannelId || "",
  );

  // Branding state
  const [customBrandingEnabled, setCustomBrandingEnabled] = useState(
    isPro ? (initialSettings.branding?.customBrandingEnabled ?? false) : false,
  );
  const [defaultFooterText, setDefaultFooterText] = useState(
    initialSettings.branding?.defaultFooterText &&
      !initialSettings.branding.defaultFooterText.includes("CreatorCore")
      ? initialSettings.branding.defaultFooterText
      : "⚡ Alert powered by Darklin3 Bot",
  );
  const [defaultFooterIconUrl, setDefaultFooterIconUrl] = useState(
    initialSettings.branding?.defaultFooterIconUrl || "",
  );
  const [defaultEmbedColor, setDefaultEmbedColor] = useState(
    initialSettings.branding?.defaultEmbedColor || "#5865F2",
  );
  const [showTimestampDefault, setShowTimestampDefault] = useState(
    initialSettings.branding?.showTimestampDefault ?? true,
  );

  // Preview interactive event mode
  const [previewEvent, setPreviewEvent] = useState<"stream" | "error" | "welcome">("stream");

  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Clean Discord channels for SearchableSelect options (fixes double ## bug)
  const channelOptions: SearchableOption[] = useMemo(() => {
    return channels.map((ch) => {
      const cleanName = ch.name.startsWith("#") ? ch.name.slice(1) : ch.name;
      return {
        value: ch.id,
        label: cleanName,
        sublabel: ch.id,
        icon: <Hash className="h-3.5 w-3.5" />,
      };
    });
  }, [channels]);

  // Live formatted current time in selected timezone
  const formattedLocalTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(new Date());
    } catch {
      return "7:30 PM";
    }
  }, [timezone]);

  const activeFooterText = useMemo(() => {
    if (isPro && customBrandingEnabled) {
      return defaultFooterText || "Custom Community Footer";
    }
    return "⚡ Alert powered by Darklin3 Bot";
  }, [isPro, customBrandingEnabled, defaultFooterText]);

  const selectedAlertChannelName = useMemo(() => {
    if (!systemAlertChannelId) return "Not Configured";
    const found = channels.find((c) => c.id === systemAlertChannelId);
    if (!found) return `#channel-${systemAlertChannelId.slice(-4)}`;
    const clean = found.name.startsWith("#") ? found.name.slice(1) : found.name;
    return `#${clean}`;
  }, [systemAlertChannelId, channels]);

  const selectedNotificationChannelName = useMemo(() => {
    if (!notificationChannelId) return "Default Fallback";
    const found = channels.find((c) => c.id === notificationChannelId);
    if (!found) return `#channel-${notificationChannelId.slice(-4)}`;
    const clean = found.name.startsWith("#") ? found.name.slice(1) : found.name;
    return `#${clean}`;
  }, [notificationChannelId, channels]);

  const handleSave = () => {
    setSaveError(null);
    startTransition(async () => {
      const payload: GuildSettings = {
        timezone,
        locale,
        systemAlertChannelId,
        notificationChannelId,
        branding: {
          customBrandingEnabled: isPro ? customBrandingEnabled : false,
          defaultFooterText: isPro && customBrandingEnabled ? defaultFooterText : "⚡ Alert powered by Darklin3 Bot",
          defaultFooterIconUrl: isPro && customBrandingEnabled ? defaultFooterIconUrl : "",
          defaultEmbedColor,
          showTimestampDefault,
        },
      };

      const res = await saveGuildSettingsAction(tenantId, guildId, payload);
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setSaveError(res.error || "Failed to save settings");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      <PageHeader
        category="Server Control Plane"
        title="Server Settings & Operations"
        description={`Configure system notification routing, timezone localization, and global Darklin3 Bot branding across ${guildName}.`}
        badge={
          isPro ? (
            <ProBadge label="PRO" />
          ) : (
            <Badge variant="outline" className="font-mono text-[10px]">
              FREE
            </Badge>
          )
        }
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="gap-2 shadow-2xs font-semibold text-xs px-4 h-9 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isPending ? "Applying Changes..." : "Save Settings"}</span>
          </Button>
        }
      />

      {saveSuccess && (
        <FeedbackBanner
          type="success"
          message="Server settings synchronized! All embeds and alert modules are now using these defaults."
          onDismiss={() => setSaveSuccess(false)}
        />
      )}

      {saveError && (
        <FeedbackBanner
          type="error"
          message={saveError}
          onDismiss={() => setSaveError(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: General & Localization */}
          <Card className="relative z-30 border-border/80 bg-card shadow-2xs transition-all">
            <CardHeader className="pb-3.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <Globe className="h-4 w-4" />
                  </div>
                  <span>General &amp; Localization</span>
                </CardTitle>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/60 border border-border/60 text-[10px] font-mono text-muted-foreground">
                  <Clock className="h-3 w-3 text-primary" />
                  <span>{formattedLocalTime}</span>
                </div>
              </div>
              <CardDescription className="text-xs">
                Timezone and regional formats used for daily leaderboard resets, stream alerts, and embeds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {/* Searchable Timezone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="timezone-select" className="text-xs font-semibold text-foreground/90">
                    Server Timezone
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-mono">IANA: {timezone}</span>
                </div>

                <SearchableSelect
                  id="timezone-select"
                  options={TIMEZONE_OPTIONS}
                  value={timezone}
                  onChange={(val) => setTimezone(val)}
                  placeholder="Search and select timezone (e.g. Colombo, UTC, New York)..."
                  searchPlaceholder="Type timezone or city name..."
                  emptyMessage="No matching timezones found"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Scheduled notifications and event resets are aligned with this timezone.
                </p>
              </div>

              <Separator className="opacity-60" />

              {/* Bot Language (English Only) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground/90">
                    Bot Language / Locale
                  </Label>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
                    ENGLISH ONLY
                  </Badge>
                </div>
                <div className="p-2.5 rounded-lg border border-border/70 bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">English (US)</span>
                    <span className="text-[11px] text-muted-foreground">— Official Bot Language</span>
                  </div>
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  English is currently the supported bot language across commands, automated alerts, and announcements.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Notification & Error Channels */}
          <Card className="relative z-20 border-border/70 bg-card/50 backdrop-blur-md shadow-xs hover:border-border transition-all">
            <CardHeader className="pb-3.5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Bell className="h-4 w-4" />
                </div>
                <span>Notification &amp; System Log Channels</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Designate target channels for staff error dispatches and automated announcements.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {/* Error Alert Channel (Searchable) */}
              <div className="space-y-1.5 relative z-20">
                <div className="flex items-center justify-between">
                  <Label htmlFor="error-channel" className="text-xs font-semibold flex items-center gap-1.5 text-foreground/90">
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                    <span>Error &amp; Staff Alert Channel</span>
                  </Label>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    Private Staff
                  </Badge>
                </div>

                {channels.length > 0 ? (
                  <SearchableSelect
                    id="error-channel"
                    options={channelOptions}
                    value={systemAlertChannelId}
                    onChange={(val) => setSystemAlertChannelId(val)}
                    placeholder="Search staff log channel by name or ID..."
                    searchPlaceholder="Type channel name (e.g. logs, staff)..."
                    emptyMessage="No Discord channels match your search"
                  />
                ) : (
                  <Input
                    id="error-channel"
                    placeholder="Enter Channel ID (e.g. 1092837465910)"
                    value={systemAlertChannelId}
                    onChange={(e) => setSystemAlertChannelId(e.target.value)}
                    className="text-xs font-mono h-9 rounded-lg"
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Bot crash logs, missing channel permissions, and stream API errors will be dispatched here.
                </p>
              </div>

              <Separator className="opacity-60" />

              {/* Default Announcement Channel (Searchable) */}
              <div className="space-y-1.5 relative z-10">
                <Label htmlFor="notification-channel" className="text-xs font-semibold flex items-center gap-1.5 text-foreground/90">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  <span>Default Notification / Fallback Channel</span>
                </Label>

                {channels.length > 0 ? (
                  <SearchableSelect
                    id="notification-channel"
                    options={channelOptions}
                    value={notificationChannelId}
                    onChange={(val) => setNotificationChannelId(val)}
                    placeholder="Search fallback channel by name or ID..."
                    searchPlaceholder="Type channel name (e.g. general, announcements)..."
                    emptyMessage="No Discord channels match your search"
                  />
                ) : (
                  <Input
                    id="notification-channel"
                    placeholder="Enter Channel ID (e.g. 1092837465910)"
                    value={notificationChannelId}
                    onChange={(e) => setNotificationChannelId(e.target.value)}
                    className="text-xs font-mono h-9 rounded-lg"
                  />
                )}
                <p className="text-[11px] text-muted-foreground">
                  Fallback target when module-specific channels are deleted or unspecified.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Global Branding & White-Label */}
          <Card className="relative z-10 border-border/70 bg-card/50 backdrop-blur-md shadow-xs hover:border-border transition-all">
            <CardHeader className="pb-3.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span>Darklin3 Bot Global Branding &amp; Appearance</span>
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] tracking-wider ${
                    isPro ? "border-amber-500/40 text-amber-500 bg-amber-500/10" : ""
                  }`}
                >
                  {isPro ? "PRO WHITE-LABEL" : "FREE PLAN"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Set server theme color, custom footers, and white-labeling across all Darklin3 Bot embeds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {/* Default Theme Color */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground/90">
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Default Embed Accent Color</span>
                  </Label>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">{defaultEmbedColor}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <label
                    className="relative h-9 w-12 rounded-lg border border-border shadow-xs shrink-0 transition-all hover:scale-105 active:scale-95 overflow-hidden cursor-pointer flex items-center justify-center group focus-within:ring-2 focus-within:ring-primary/40"
                    style={{ backgroundColor: defaultEmbedColor }}
                    title="Click to open color picker"
                  >
                    <input
                      type="color"
                      value={
                        /^#[0-9A-Fa-f]{6}$/.test(defaultEmbedColor)
                          ? defaultEmbedColor
                          : "#5865F2"
                      }
                      onChange={(e) => setDefaultEmbedColor(e.target.value.toUpperCase())}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      aria-label="Pick default embed accent color"
                    />
                    <Pipette className="h-3.5 w-3.5 text-white/90 drop-shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </label>
                  <Input
                    value={defaultEmbedColor}
                    onChange={(e) => setDefaultEmbedColor(e.target.value)}
                    placeholder="#5865F2"
                    maxLength={7}
                    className="text-xs font-mono max-w-[130px] uppercase h-9 rounded-lg"
                  />
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    Click color box to pick custom color
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_COLORS.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setDefaultEmbedColor(p.hex)}
                      className={`h-6 px-2.5 text-[10px] rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                        defaultEmbedColor.toLowerCase() === p.hex.toLowerCase()
                          ? "border-primary bg-primary/15 text-primary font-bold shadow-xs scale-105"
                          : "border-border/60 hover:border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.hex }} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator className="opacity-60" />

              {/* White-Label Toggle */}
              {!isPro ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-600 dark:text-amber-400 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>White-Labeling Requires PRO Plan</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Free servers display <strong className="text-foreground">⚡ Alert powered by Darklin3 Bot</strong> in all embed footers. Upgrade to Pro to customize footer text, set custom icons, or remove watermarks globally.
                  </p>
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold" asChild>
                    <a href={`/tenants/${tenantId}/billing`}>
                      <span>Upgrade to PRO</span>
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold">Custom White-Label Footer</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Replace default Darklin3 Bot watermark with your custom community branding.
                      </p>
                    </div>
                    <Switch
                      checked={customBrandingEnabled}
                      onCheckedChange={setCustomBrandingEnabled}
                    />
                  </div>

                  {customBrandingEnabled && (
                    <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in">
                      <div className="space-y-1.5">
                        <Label htmlFor="footer-text" className="text-xs font-semibold">
                          Global Footer Text
                        </Label>
                        <Input
                          id="footer-text"
                          value={defaultFooterText}
                          onChange={(e) => setDefaultFooterText(e.target.value)}
                          placeholder="e.g. Dreamscape Esports • Official Server"
                          className="text-xs font-mono h-9 rounded-lg"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          This footer text automatically applies to all alerts, welcome messages, and embed builder announcements.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="footer-icon" className="text-xs font-semibold">
                          Global Footer Icon URL (Optional)
                        </Label>
                        <Input
                          id="footer-icon"
                          value={defaultFooterIconUrl}
                          onChange={(e) => setDefaultFooterIconUrl(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="text-xs font-mono h-9 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator className="opacity-60" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground">Include Live Timestamp by Default</span>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically append viewer-relative timestamp to embeds.
                  </p>
                </div>
                <Switch
                  checked={showTimestampDefault}
                  onCheckedChange={setShowTimestampDefault}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Live Preview Column (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <Card className="border-border/80 shadow-md bg-card/60 backdrop-blur-xl overflow-hidden">
            {/* Discord Window Bar Mockup */}
            <div className="bg-[#1e1f22] px-3.5 py-2.5 border-b border-black/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-[#80848e]" />
                <span className="text-xs font-bold text-white tracking-wide">
                  {previewEvent === "error" ? selectedAlertChannelName.replace("#", "") : "announcements"}
                </span>
                <span className="text-[10px] text-[#80848e] hidden sm:inline">| Darklin3 Live Preview</span>
              </div>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono bg-[#2b2d31] text-[#949ba4] border border-[#35373c]">
                DISCORD CLIENT
              </Badge>
            </div>

            {/* Event Selector Tabs (With fixed Discord colors) */}
            <div className="p-3 bg-[#2b2d31]/80 border-b border-[#383a40] flex items-center justify-between gap-1.5">
              <span className="text-[10px] uppercase font-bold text-[#949ba4] tracking-wider">Preview Event:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewEvent("stream")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    previewEvent === "stream"
                      ? "bg-[#5865F2] text-white shadow-xs font-bold ring-1 ring-[#5865F2]/50"
                      : "text-[#949ba4] hover:text-white hover:bg-[#35373c]"
                  }`}
                >
                  <Radio className="h-3 w-3" />
                  <span>Stream</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewEvent("error")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    previewEvent === "error"
                      ? "bg-rose-600 text-white shadow-xs font-bold ring-1 ring-rose-500/50"
                      : "text-[#949ba4] hover:text-white hover:bg-[#35373c]"
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  <span>Error</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewEvent("welcome")}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    previewEvent === "welcome"
                      ? "bg-emerald-600 text-white shadow-xs font-bold ring-1 ring-emerald-500/50"
                      : "text-[#949ba4] hover:text-white hover:bg-[#35373c]"
                  }`}
                >
                  <UserCheck className="h-3 w-3" />
                  <span>Welcome</span>
                </button>
              </div>
            </div>

            <CardContent className="p-4 bg-[#313338] space-y-3 font-sans">
              {/* Bot Message Header */}
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className="h-9 w-9 rounded-full bg-linear-to-br from-indigo-500 via-primary to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    D
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#313338]" />
                </div>
                <div className="space-y-1 w-full min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                      Darklin3 Bot
                    </span>
                    <span className="inline-flex items-center rounded px-1 py-0 text-[9px] font-bold bg-[#5865F2] text-white leading-tight">
                      APP
                    </span>
                    <span className="text-[10px] text-[#949ba4] font-mono">Today at {formattedLocalTime}</span>
                  </div>

                  {/* Embed Box */}
                  <div
                    className="rounded-lg border-l-4 bg-[#2b2d31] p-3.5 space-y-2.5 text-xs transition-all shadow-xs"
                    style={{ borderLeftColor: defaultEmbedColor }}
                  >
                    {previewEvent === "stream" && (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-semibold text-[#b5bac1] block">
                            {guildName} • Stream Notification
                          </span>
                          <h3 className="text-sm font-bold text-white leading-snug">
                            🔴 Streamer is now LIVE on Twitch!
                          </h3>
                        </div>
                        <p className="text-[#dbdee1] text-xs leading-relaxed">
                          Playing <strong className="text-white">Valorant</strong> with subscribers! Come say hi in chat.
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#35373c] text-[11px]">
                          <div>
                            <span className="font-semibold text-[#b5bac1] block text-[10px] uppercase">Timezone</span>
                            <span className="text-[#dbdee1] font-mono text-[10px]">{timezone}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-[#b5bac1] block text-[10px] uppercase">Alert Channel</span>
                            <span className="text-[#dbdee1] font-mono text-[10px]">{selectedNotificationChannelName}</span>
                          </div>
                        </div>
                      </>
                    )}

                    {previewEvent === "error" && (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-semibold text-rose-400 block flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            <span>System Warning Dispatch</span>
                          </span>
                          <h3 className="text-sm font-bold text-white leading-snug">
                            ⚠️ Permission Check / Webhook Event
                          </h3>
                        </div>
                        <p className="text-[#dbdee1] text-xs leading-relaxed">
                          Automated alert delivered to staff log channel. Bot permissions verified across guild.
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#35373c] text-[11px]">
                          <div>
                            <span className="font-semibold text-[#b5bac1] block text-[10px] uppercase">Staff Channel</span>
                            <span className="text-[#dbdee1] font-mono text-[10px]">{selectedAlertChannelName}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-[#b5bac1] block text-[10px] uppercase">Severity</span>
                            <span className="text-amber-400 font-mono text-[10px]">OPERATIONAL</span>
                          </div>
                        </div>
                      </>
                    )}

                    {previewEvent === "welcome" && (
                      <>
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-semibold text-emerald-400 block flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            <span>Community Arrival</span>
                          </span>
                          <h3 className="text-sm font-bold text-white leading-snug">
                            🎉 Welcome to {guildName}!
                          </h3>
                        </div>
                        <p className="text-[#dbdee1] text-xs leading-relaxed">
                          Thanks for joining our server. Please review the rules in #rules to get your role.
                        </p>
                      </>
                    )}

                    {/* Footer Display */}
                    <div className="flex items-center gap-2 pt-2 text-[10px] text-[#949ba4] font-mono border-t border-[#35373c]">
                      {isPro && customBrandingEnabled && defaultFooterIconUrl ? (
                        <img
                          src={defaultFooterIconUrl}
                          alt="footer icon"
                          className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
                        />
                      ) : null}
                      <span className="truncate">{activeFooterText}</span>
                      {showTimestampDefault && <span>•</span>}
                      {showTimestampDefault && <span>Today at {formattedLocalTime}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Automatic inheritance reassurance card */}
              <div className="p-3 rounded-lg bg-[#2b2d31] border border-[#383a40] text-xs space-y-1">
                <div className="font-semibold text-white flex items-center gap-1.5 text-[11px]">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Darklin3 Bot Centralized Sync</span>
                </div>
                <p className="text-[10px] text-[#949ba4] leading-relaxed">
                  Every alert, welcome message, and visual embed builder card automatically inherits this theme color and footer branding.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
