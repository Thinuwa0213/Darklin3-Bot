"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Send,
  Plus,
  Trash2,
  Globe,
  Sparkles,
  Lock,
  Hash,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, ProBadge } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import type { GuildSettings } from "@/lib/settings-storage";
import type { LiveDiscordChannel } from "../welcome/welcome-types";
import { publishEmbedToDiscordAction } from "@/app/actions";

interface EmbedsViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  globalSettings?: GuildSettings;
  liveChannels?: LiveDiscordChannel[];
}

interface EmbedField {
  id: string;
  name: string;
  value: string;
  inline: boolean;
}

const PRESET_COLORS = [
  { label: "Blurple", hex: "#5865F2" },
  { label: "Emerald", hex: "#57F287" },
  { label: "Gold", hex: "#FEE75C" },
  { label: "Crimson", hex: "#ED4245" },
  { label: "Fuchsia", hex: "#EB459E" },
  { label: "Dark Slate", hex: "#2B2D31" },
];

export function EmbedsView({ tenantId, guildId, currentPlan, globalSettings, liveChannels = [] }: EmbedsViewProps) {
  const isPro = currentPlan === "PRO" || currentPlan === "ENTERPRISE";

  const [channelId, setChannelId] = useState(liveChannels[0]?.id || "");
  const [publishing, setPublishing] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
  const [authorName, setAuthorName] = useState("Darklin3 Bot Operations");
  const [title, setTitle] = useState("🚨 Community Update & Tournament Schedule");
  const [description, setDescription] = useState(
    "Welcome to the official monthly championship! Check the schedule below and ensure your squads are checked in before Friday 6 PM EST.",
  );
  const [color, setColor] = useState(globalSettings?.branding?.defaultEmbedColor || "#5865F2");

  // Footer configuration mode: 'global' | 'custom' | 'none'
  const [footerMode, setFooterMode] = useState<"global" | "custom" | "none">("global");
  const [customFooterText, setCustomFooterText] = useState("Event Operations • Darklin3 Bot");
  const [customFooterIcon, setCustomFooterIcon] = useState("");
  const [includeTimestamp, setIncludeTimestamp] = useState(
    globalSettings?.branding?.showTimestampDefault ?? true,
  );

  const globalFooterText =
    isPro && globalSettings?.branding?.customBrandingEnabled
      ? globalSettings?.branding?.defaultFooterText
      : "⚡ Alert powered by Darklin3 Bot";
  const globalFooterIcon =
    isPro && globalSettings?.branding?.customBrandingEnabled
      ? globalSettings?.branding?.defaultFooterIconUrl
      : "";

  const resolvedFooterText = !isPro
    ? "⚡ Alert powered by Darklin3 Bot"
    : footerMode === "none"
      ? ""
      : footerMode === "custom"
        ? (customFooterText.trim() || "⚡ Alert powered by Darklin3 Bot")
        : (globalFooterText || "⚡ Alert powered by Darklin3 Bot");

  const resolvedFooterIcon = !isPro
    ? ""
    : footerMode === "none"
      ? ""
      : footerMode === "custom"
        ? customFooterIcon
        : globalFooterIcon;

  const [fields, setFields] = useState<EmbedField[]>([
    { id: "1", name: "🏆 Prize Pool", value: "$1,000 USD", inline: true },
    { id: "2", name: "📅 Date & Time", value: "Oct 24th, 6 PM EST", inline: true },
  ]);

  const handleAddField = () => {
    setFields([
      ...fields,
      {
        id: Date.now().toString(),
        name: "New Field",
        value: "Field content",
        inline: true,
      },
    ]);
  };

  const handleSend = async () => {
    if (!channelId) {
      setPublishFeedback({ type: "error", message: "Please select a destination channel." });
      return;
    }
    setPublishing(true);
    setPublishFeedback(null);

    let hexInt = 0x5865f2;
    if (color) {
      const parsed = Number.parseInt(color.replace("#", ""), 16);
      if (!Number.isNaN(parsed)) hexInt = parsed;
    }

    const embedPayload: any = {
      title,
      description,
      color: hexInt,
      fields: fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
      timestamp: new Date().toISOString(),
    };

    if (authorName.trim()) {
      embedPayload.author = { name: authorName };
    }

    if (!isPro) {
      // Free plan embeds MUST strictly display the mandatory Darklin3 watermark
      embedPayload.footer = { text: "⚡ Alert powered by Darklin3 Bot" };
    } else {
      if (footerMode === "custom" && customFooterText.trim()) {
        embedPayload.footer = { text: customFooterText, icon_url: customFooterIcon || undefined };
      } else if (footerMode === "global") {
        const text = globalSettings?.branding?.customBrandingEnabled && globalSettings?.branding?.defaultFooterText
          ? globalSettings.branding.defaultFooterText
          : "⚡ Alert powered by Darklin3 Bot";
        const icon = globalSettings?.branding?.customBrandingEnabled && globalSettings?.branding?.defaultFooterIconUrl
          ? globalSettings.branding.defaultFooterIconUrl
          : undefined;
        embedPayload.footer = { text, icon_url: icon };
      }
      // If footerMode === "none" on PRO, embedPayload.footer is completely omitted
    }

    try {
      const res = await publishEmbedToDiscordAction(tenantId, guildId, channelId, embedPayload);
      if (res.ok) {
        setPublishFeedback({ type: "success", message: "Embed published directly to Discord successfully!" });
      } else {
        setPublishFeedback({ type: "error", message: res.error || "Failed to publish embed to Discord." });
      }
    } catch {
      setPublishFeedback({ type: "error", message: "Network error publishing embed." });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-12">
      <PageHeader
        category="Visual Messaging"
        title="Visual Embed Builder"
        description="Craft rich Discord announcement embeds with formatted fields, custom brand colors, and instant previews."
        badge={
          currentPlan !== "FREE" ? (
            <ProBadge label={currentPlan} />
          ) : (
            <Badge variant="outline" className="font-mono text-[10px]">
              FREE
            </Badge>
          )
        }
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <Button onClick={handleSend} disabled={publishing} size="sm" className="gap-2 shadow-2xs h-9 cursor-pointer">
            <Send className="h-4 w-4" />
            <span>{publishing ? "Publishing..." : "Publish to Discord"}</span>
          </Button>
        }
      />

      {publishFeedback && (
        <FeedbackBanner
          type={publishFeedback.type}
          message={publishFeedback.message}
          onDismiss={() => setPublishFeedback(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Form Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-border/80 shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Embed Content Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destination Channel</Label>
                {liveChannels.length > 0 ? (
                  <SearchableSelect
                    options={channelOptions}
                    value={channelId}
                    onChange={(val) => setChannelId(val)}
                    placeholder="Select a destination channel..."
                    searchPlaceholder="Search channel (e.g. announcements)..."
                    emptyMessage="No Discord channels match your search"
                  />
                ) : (
                  <Input
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="Enter channel ID..."
                    className="text-xs font-mono"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Author Header</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Organization or Event Name"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Embed Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Main Headline"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description (Markdown Supported)</Label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Color Preset Palette */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Embed Border Color</Label>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setColor(c.hex)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                        color === c.hex ? "ring-2 ring-primary border-transparent" : "border-border"
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-24 h-7 text-xs font-mono"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fields Configuration */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Dynamic Fields</CardTitle>
                <Button size="sm" variant="outline" onClick={handleAddField} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  <span>Add Field</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((f, i) => (
                <div
                  key={f.id}
                  className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                      Field #{i + 1}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setFields(fields.filter((item) => item.id !== f.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Field Title"
                      value={f.name}
                      onChange={(e) =>
                        setFields(fields.map((item) => (item.id === f.id ? { ...item, name: e.target.value } : item)))
                      }
                      className="text-xs"
                    />
                    <Input
                      placeholder="Field Value"
                      value={f.value}
                      onChange={(e) =>
                        setFields(fields.map((item) => (item.id === f.id ? { ...item, value: e.target.value } : item)))
                      }
                      className="text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">Inline Layout (Side-by-side)</span>
                    <Switch
                      checked={f.inline}
                      onCheckedChange={(val) =>
                        setFields(fields.map((item) => (item.id === f.id ? { ...item, inline: val } : item)))
                      }
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Footer Configuration */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <span>Footer &amp; Timestamp</span>
                  {footerMode === "global" && (
                    <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary bg-primary/10">
                      GLOBAL INHERITED
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Footer Mode Switcher */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Footer Branding Source</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFooterMode("global")}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all flex flex-col gap-1 cursor-pointer ${
                      footerMode === "global"
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border/80 text-muted-foreground hover:text-foreground bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5" />
                      <span>Global Default</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Server Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFooterMode("custom")}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all flex flex-col gap-1 cursor-pointer ${
                      footerMode === "custom"
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border/80 text-muted-foreground hover:text-foreground bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Custom Footer</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-500 bg-amber-500/10 px-1 py-0 h-4">
                        PRO
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Per-Embed Override</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFooterMode("none")}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all flex flex-col gap-1 cursor-pointer ${
                      footerMode === "none"
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border/80 text-muted-foreground hover:text-foreground bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>No Footer</span>
                      <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-500 bg-amber-500/10 px-1 py-0 h-4">
                        PRO
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Clean / Minimal</span>
                  </button>
                </div>
              </div>

              {/* Mode: Global Default */}
              {footerMode === "global" && (
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-semibold">Active Server Footer:</span>
                    {isPro ? (
                      <Link
                        href={`/tenants/${tenantId}/guilds/${guildId}/settings`}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1"
                      >
                        <span>Edit in Server Settings</span>
                      </Link>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground">
                        FREE TIER
                      </Badge>
                    )}
                  </div>
                  <div className="p-2 rounded-md bg-background border border-border/60 font-mono text-[11px] text-foreground truncate">
                    {resolvedFooterText}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isPro
                      ? "Modifying your Server Settings updates this footer across all your bot's embeds automatically."
                      : "Free tier embeds automatically feature the official Darklin3 watermark. Upgrade to PRO to enable white-labeling."}
                  </p>
                </div>
              )}

              {/* Mode: Custom Footer */}
              {footerMode === "custom" && (
                <>
                  {!isPro ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-3">
                      <div className="flex items-center gap-2 font-semibold text-amber-500">
                        <Lock className="h-4 w-4 shrink-0 text-amber-500" />
                        <span>Custom Footer Locked (PRO Only)</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Customizing per-embed footer text or adding custom brand logos requires an active <strong>Darklin3 PRO</strong> subscription. Free embeds retain the official Darklin3 watermark.
                      </p>
                      <Button
                        size="sm"
                        className="w-full text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-xs cursor-pointer"
                        asChild
                      >
                        <Link href={`/tenants/${tenantId}/billing`}>Upgrade to Darklin3 PRO &rarr;</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="custom-footer-text" className="text-xs font-semibold">
                          Custom Footer Text
                        </Label>
                        <Input
                          id="custom-footer-text"
                          value={customFooterText}
                          onChange={(e) => setCustomFooterText(e.target.value)}
                          placeholder="Specific footer for this announcement"
                          className="text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="custom-footer-icon" className="text-xs font-semibold">
                          Custom Footer Icon URL (Optional)
                        </Label>
                        <Input
                          id="custom-footer-icon"
                          value={customFooterIcon}
                          onChange={(e) => setCustomFooterIcon(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Mode: None */}
              {footerMode === "none" && (
                <>
                  {!isPro ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs space-y-3">
                      <div className="flex items-center gap-2 font-semibold text-amber-500">
                        <Lock className="h-4 w-4 shrink-0 text-amber-500" />
                        <span>Watermark Removal Locked (PRO Only)</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Complete watermark removal is exclusive to <strong>Darklin3 PRO</strong>. On the Free tier, embeds will continue to show the standard Darklin3 watermark.
                      </p>
                      <Button
                        size="sm"
                        className="w-full text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-xs cursor-pointer"
                        asChild
                      >
                        <Link href={`/tenants/${tenantId}/billing`}>Upgrade to Darklin3 PRO &rarr;</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground">
                      <span>Footer is completely disabled for this embed. The output on Discord will be clean and minimal.</span>
                    </div>
                  )}
                </>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Include Live Timestamp</span>
                <Switch checked={includeTimestamp} onCheckedChange={setIncludeTimestamp} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Discord Embed Preview Column (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <Card className="border-border shadow-md bg-card/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Live Discord Message Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {/* Message Container */}
              <div className="rounded-xl border border-border/80 bg-background/95 p-4 space-y-3 font-sans">
                {/* Bot Header */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-linear-to-br from-indigo-500 to-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                    D
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">Darklin3 Bot</span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 font-bold bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]/30">
                        APP
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">Today at 12:00 PM</span>
                    </div>
                  </div>
                </div>

                {/* Discord Embed Element */}
                <div
                  className="rounded-md border-l-4 bg-muted/30 p-3.5 space-y-2.5 text-xs"
                  style={{ borderLeftColor: color }}
                >
                  {authorName && (
                    <span className="text-[11px] font-semibold text-foreground/80 block">
                      {authorName}
                    </span>
                  )}

                  {title && (
                    <h3 className="text-sm font-bold text-foreground leading-snug">
                      {title}
                    </h3>
                  )}

                  {description && (
                    <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {description}
                    </p>
                  )}

                  {/* Embed Fields Grid */}
                  {fields.length > 0 && (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      {fields.map((f) => (
                        <div key={f.id} className={f.inline ? "col-span-1" : "col-span-2"}>
                          <span className="text-[11px] font-bold text-foreground block">{f.name}</span>
                          <span className="text-muted-foreground">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  {(resolvedFooterText || includeTimestamp) && (
                    <div className="flex items-center gap-1.5 pt-2 text-[10px] text-muted-foreground font-mono border-t border-border/50">
                      {resolvedFooterIcon && (
                        <img
                          src={resolvedFooterIcon}
                          alt="footer icon"
                          className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
                        />
                      )}
                      {resolvedFooterText && <span>{resolvedFooterText}</span>}
                      {resolvedFooterText && includeTimestamp && <span>•</span>}
                      {includeTimestamp && <span>Today at 12:00 PM</span>}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
