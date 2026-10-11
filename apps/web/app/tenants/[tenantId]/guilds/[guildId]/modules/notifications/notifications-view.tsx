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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Radio,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Loader2,
  Lock,
  Film,
  Users,
  Search,
  Check,
  Play,
  Pencil,
  Palette,
  Shield,
} from "lucide-react";
import { PageHeader, ProBadge, ModuleToggle } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { VariableChips } from "@/components/modules/variable-chips";
import {
  STREAM_ALERT_VARIABLES,
  VIDEO_UPLOAD_VARIABLES,
} from "@/lib/template-variables";
import { saveStreamAlertsAction } from "@/app/actions";
import type {
  StoredStreamsConfig,
  StoredStreamerAlert,
} from "@/lib/streams-storage";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";

type PlatformType = "twitch" | "youtube" | "kick" | "tiktok";
type TabType = "creators" | "templates";

interface NotificationsViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  initialConfig?: StoredStreamsConfig;
  liveChannels?: LiveDiscordChannel[];
  liveRoles?: LiveDiscordRole[];
}

const PLATFORM_CONFIG: Record<
  PlatformType,
  {
    name: string;
    icon: string;
    badgeStyle: string;
    activeBorder: string;
    color: string;
  }
> = {
  twitch: {
    name: "Twitch",
    icon: "🟣",
    badgeStyle: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    activeBorder: "border-purple-500",
    color: "#9146FF",
  },
  youtube: {
    name: "YouTube",
    icon: "🔴",
    badgeStyle: "text-rose-400 border-rose-500/30 bg-rose-500/10",
    activeBorder: "border-rose-500",
    color: "#FF0000",
  },
  kick: {
    name: "Kick",
    icon: "🟢",
    badgeStyle: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    activeBorder: "border-emerald-500",
    color: "#53FC18",
  },
  tiktok: {
    name: "TikTok",
    icon: "🎵",
    badgeStyle: "text-pink-400 border-pink-500/30 bg-pink-500/10",
    activeBorder: "border-pink-500",
    color: "#EE1D52",
  },
};

export function NotificationsView({
  tenantId,
  guildId,
  currentPlan,
  initialConfig,
  liveChannels = [],
  liveRoles = [],
}: NotificationsViewProps) {
  const isPro = currentPlan === "PRO" || currentPlan === "ENTERPRISE";

  const channels = useMemo(() => {
    if (liveChannels && liveChannels.length > 0) return liveChannels;
    return [
      { id: "default-live", name: "#live-streams", type: 0, position: 0 },
      { id: "default-announcements", name: "#announcements", type: 0, position: 1 },
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

  // Main navigation tab
  const [activeTab, setActiveTab] = useState<TabType>("creators");

  // Form states initialized from stored config
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true);
  const [streamers, setStreamers] = useState<StoredStreamerAlert[]>(
    initialConfig?.streamers ?? [],
  );

  // Platform Filter & Search
  const [selectedFilter, setSelectedFilter] = useState<"all" | PlatformType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Global message settings
  const [autoCleanup, setAutoCleanup] = useState(initialConfig?.autoCleanup ?? false);
  const [customLiveMessage, setCustomLiveMessage] = useState(
    initialConfig?.customLiveMessage ??
      "Hey {role}, **{streamer}** is now LIVE!\n{url}",
  );
  const [customUploadMessage, setCustomUploadMessage] = useState(
    initialConfig?.customUploadMessage ??
      "🎬 New video uploaded by **{streamer}**!\n**{title}**\nWatch here: {url}",
  );

  // Branding & Watermark settings (Free vs PRO)
  const [customBranding, setCustomBranding] = useState(initialConfig?.customBranding ?? false);
  const [customFooterText, setCustomFooterText] = useState(initialConfig?.customFooterText ?? "");

  // Preview embed state tab
  const [previewMode, setPreviewMode] = useState<"live" | "upload">("live");
  const [previewPlatform, setPreviewPlatform] = useState<PlatformType>(
    initialConfig?.streamers?.[0]?.platform ?? "youtube",
  );

  const handleInsertLiveToken = (token: string) => {
    setCustomLiveMessage((prev) => (prev.endsWith(" ") ? prev + token : prev + " " + token));
  };

  const handleInsertUploadToken = (token: string) => {
    setCustomUploadMessage((prev) => (prev.endsWith(" ") ? prev + token : prev + " " + token));
  };

  // Add / Edit Creator Dialog state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStreamerId, setEditingStreamerId] = useState<string | null>(null);
  const [inputUrlOrHandle, setInputUrlOrHandle] = useState("");
  const [modalPlatform, setModalPlatform] = useState<PlatformType>("twitch");
  const [autoDetected, setAutoDetected] = useState<PlatformType | null>(null);
  const [targetChannelId, setTargetChannelId] = useState(channels[0]?.id ?? "");
  const [targetRoleId, setTargetRoleId] = useState("everyone");
  const [notifyLive, setNotifyLive] = useState(true);
  const [notifyUploads, setNotifyUploads] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // UI status
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);

  // Count channels by platform
  const platformCounts = useMemo(() => {
    return {
      twitch: streamers.filter((s) => s.platform === "twitch").length,
      youtube: streamers.filter((s) => s.platform === "youtube").length,
      kick: streamers.filter((s) => s.platform === "kick").length,
      tiktok: streamers.filter((s) => s.platform === "tiktok").length,
    };
  }, [streamers]);

  // Filtered streamers list
  const filteredStreamers = useMemo(() => {
    return streamers.filter((st) => {
      const matchesFilter = selectedFilter === "all" || st.platform === selectedFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        st.channelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.discordChannelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.pingRoleName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [streamers, selectedFilter, searchQuery]);

  // Smart URL parser for Add Modal
  const handleInputChange = (val: string) => {
    setInputUrlOrHandle(val);
    setModalError(null);

    const trimmed = val.trim();
    if (!trimmed) {
      setAutoDetected(null);
      return;
    }

    if (/twitch\.tv/i.test(trimmed)) {
      setModalPlatform("twitch");
      setAutoDetected("twitch");
      setNotifyUploads(false);
      setNotifyLive(true);
      return;
    }

    if (/youtube\.com|youtu\.be/i.test(trimmed)) {
      setModalPlatform("youtube");
      setAutoDetected("youtube");
      setNotifyUploads(true);
      return;
    }

    if (/kick\.com/i.test(trimmed)) {
      setModalPlatform("kick");
      setAutoDetected("kick");
      setNotifyUploads(false);
      setNotifyLive(true);
      return;
    }

    if (/tiktok\.com/i.test(trimmed)) {
      setModalPlatform("tiktok");
      setAutoDetected("tiktok");
      setNotifyUploads(true);
      return;
    }

    setAutoDetected(null);
  };

  const handleOpenAddModal = () => {
    setEditingStreamerId(null);
    setInputUrlOrHandle("");
    setModalPlatform("twitch");
    setAutoDetected(null);
    setTargetChannelId(channels[0]?.id ?? "");
    setTargetRoleId("everyone");
    setNotifyLive(true);
    setNotifyUploads(false);
    setModalError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (st: StoredStreamerAlert) => {
    setEditingStreamerId(st.id);
    setInputUrlOrHandle(st.channelUrl || st.channelName);
    setModalPlatform(st.platform);
    setAutoDetected(null);
    setTargetChannelId(st.discordChannelId);
    setTargetRoleId(st.pingRoleId || "everyone");
    setNotifyLive(st.notifyLive ?? true);
    setNotifyUploads(st.notifyUploads ?? false);
    setModalError(null);
    setIsAddModalOpen(true);
  };

  // Add or Edit Streamer from Modal
  const handleAddStreamer = () => {
    setModalError(null);
    setQuotaWarning(null);
    setErrorMessage(null);

    const rawInput = inputUrlOrHandle.trim();
    if (!rawInput) {
      setModalError("Please enter a channel URL or username.");
      return;
    }

    let platform = modalPlatform;
    let cleanHandle = rawInput;
    let finalUrl = rawInput;

    // Parse Twitch
    const twitchMatch = rawInput.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{2,35})/i);
    if (twitchMatch && twitchMatch[1]) {
      platform = "twitch";
      cleanHandle = twitchMatch[1];
      finalUrl = `https://twitch.tv/${cleanHandle}`;
    }

    // Parse YouTube
    const ytMatch = rawInput.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|channel\/)?([a-zA-Z0-9_.-]+)/i);
    if (ytMatch && ytMatch[1] && (rawInput.includes("youtube.com") || rawInput.includes("youtu.be"))) {
      platform = "youtube";
      cleanHandle = ytMatch[1].startsWith("@") ? ytMatch[1] : `@${ytMatch[1]}`;
      finalUrl = rawInput.startsWith("http") ? rawInput : `https://${rawInput}`;
    }

    // Parse Kick
    const kickMatch = rawInput.match(/(?:https?:\/\/)?(?:www\.)?kick\.com\/([a-zA-Z0-9_-]+)/i);
    if (kickMatch && kickMatch[1]) {
      platform = "kick";
      cleanHandle = kickMatch[1];
      finalUrl = `https://kick.com/${cleanHandle}`;
    }

    // Parse TikTok
    const tiktokMatch = rawInput.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.-]+)/i);
    if (tiktokMatch && tiktokMatch[1]) {
      platform = "tiktok";
      cleanHandle = tiktokMatch[1].startsWith("@") ? tiktokMatch[1] : `@${tiktokMatch[1]}`;
      finalUrl = `https://www.tiktok.com/${cleanHandle}`;
    }

    // Clean plain handle without URL
    if (!rawInput.includes("/")) {
      if (platform === "twitch") {
        cleanHandle = rawInput.replace("@", "");
        finalUrl = `https://twitch.tv/${cleanHandle}`;
      } else if (platform === "youtube") {
        cleanHandle = rawInput.startsWith("@") ? rawInput : `@${rawInput}`;
        finalUrl = `https://youtube.com/${cleanHandle}`;
      } else if (platform === "kick") {
        cleanHandle = rawInput.replace("@", "");
        finalUrl = `https://kick.com/${cleanHandle}`;
      } else if (platform === "tiktok") {
        cleanHandle = rawInput.startsWith("@") ? rawInput : `@${rawInput}`;
        finalUrl = `https://www.tiktok.com/${cleanHandle}`;
      }
    }

    // FREE PLAN LIMIT CHECK: 1 per platform (Twitch, YouTube, Kick, TikTok)
    const currentStreamer = editingStreamerId ? streamers.find((s) => s.id === editingStreamerId) : null;
    const isPlatformChanged = currentStreamer ? currentStreamer.platform !== platform : true;
    if (!isPro && isPlatformChanged && platformCounts[platform] >= 1) {
      setModalError(
        `Free tier allows maximum 1 ${platform.toUpperCase()} creator. Upgrade to PRO to monitor multiple creators.`,
      );
      return;
    }

    if (!notifyLive && !notifyUploads) {
      setModalError("Please select at least one alert event (Live Streams or Video Uploads).");
      return;
    }

    // Duplicate check (ignore the creator currently being edited)
    const isDuplicate = streamers.some(
      (s) =>
        s.id !== editingStreamerId &&
        s.platform === platform &&
        s.channelName.toLowerCase() === cleanHandle.toLowerCase(),
    );
    if (isDuplicate) {
      setModalError(`The ${platform.toUpperCase()} creator "${cleanHandle}" is already added.`);
      return;
    }

    const selectedChanObj = channels.find((c) => c.id === targetChannelId) || channels[0];
    const selectedRoleObj = roles.find((r) => r.id === targetRoleId) || roles[0];

    if (editingStreamerId) {
      setStreamers(
        streamers.map((s) => {
          if (s.id !== editingStreamerId) return s;
          return {
            ...s,
            platform,
            channelName: cleanHandle,
            channelUrl: finalUrl,
            discordChannelId: selectedChanObj?.id || targetChannelId,
            discordChannelName: selectedChanObj?.name || "#live-streams",
            pingRoleId: selectedRoleObj?.id || targetRoleId,
            pingRoleName: selectedRoleObj?.name || "@everyone",
            notifyLive,
            notifyUploads,
          };
        }),
      );
    } else {
      const newStreamer: StoredStreamerAlert = {
        id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        platform,
        channelName: cleanHandle,
        channelUrl: finalUrl,
        discordChannelId: selectedChanObj?.id || targetChannelId,
        discordChannelName: selectedChanObj?.name || "#live-streams",
        pingRoleId: selectedRoleObj?.id || targetRoleId,
        pingRoleName: selectedRoleObj?.name || "@everyone",
        notifyLive,
        notifyUploads,
        lastStatus: "offline",
      };
      setStreamers([...streamers, newStreamer]);
    }

    setIsAddModalOpen(false);
    setEditingStreamerId(null);
  };

  const handleRemoveStreamer = (id: string) => {
    setStreamers(streamers.filter((s) => s.id !== id));
  };

  // Save changes via Server Action
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setQuotaWarning(null);

    try {
      const res = await saveStreamAlertsAction(tenantId, guildId, {
        enabled,
        autoCleanup: isPro ? autoCleanup : false,
        customLiveMessage,
        customUploadMessage,
        customBranding: isPro ? customBranding : false,
        customFooterText: isPro && customBranding ? customFooterText.trim() : undefined,
        streamers,
        communityRadar: initialConfig?.communityRadar,
      });

      if (!res.ok) {
        setErrorMessage(res.error || "Failed to save content alert settings.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Module Header Bar */}
      <PageHeader
        category="Stream & Video Alerts"
        title="Content Alerts"
        description="Instant live broadcast and video upload announcements for Twitch, YouTube, Kick, and TikTok."
        badges={[
          isPro ? (
            <ProBadge key="pro" label={currentPlan} />
          ) : (
            <Badge key="plan" variant="outline" className="font-mono text-[10px] tracking-wider">
              {currentPlan}
            </Badge>
          ),
        ]}
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <div className="flex items-center gap-2.5 shrink-0">
            <ModuleToggle
              enabled={enabled}
              onToggle={setEnabled}
              activeLabel="Active"
              disabledLabel="Paused"
            />

            <Button
              onClick={handleOpenAddModal}
              size="sm"
              className="gap-1.5 h-9 bg-primary text-primary-foreground font-medium shadow-2xs hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Creator</span>
            </Button>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="gap-1.5 h-9 font-medium shadow-2xs cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : saved ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{isSaving ? "Saving..." : saved ? "Saved" : "Save Changes"}</span>
            </Button>
          </div>
        }
      />

      {/* Save Success Alert */}
      {saved && (
        <FeedbackBanner
          type="success"
          message="All alert settings and live streamer configurations have been successfully saved and synced."
          onDismiss={() => setSaved(false)}
        />
      )}

      {/* Error Alert */}
      {errorMessage && (
        <FeedbackBanner
          type="error"
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Quota Warning */}
      {quotaWarning && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{quotaWarning}</span>
          </div>
          <Badge variant="default" className="bg-amber-600 hover:bg-amber-700 text-white text-[10px]">
            Upgrade to PRO
          </Badge>
        </div>
      )}

      {/* Segmented Pill Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/60 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("creators")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeTab === "creators"
              ? "bg-background text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Creator Whitelist</span>
          <span className="rounded-full px-1.5 py-0.2 bg-muted text-[10px] text-muted-foreground font-mono">
            {streamers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
            activeTab === "templates"
              ? "bg-background text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          <span>Embed &amp; Branding Studio</span>
        </button>
      </div>

      {/* ==================== TAB 1: CREATORS ==================== */}
      {activeTab === "creators" && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          {/* Controls Bar: Filter Pills + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Platform Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedFilter === "all"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                All ({streamers.length})
              </button>

              {(["twitch", "youtube", "kick", "tiktok"] as PlatformType[]).map((plt) => {
                const conf = PLATFORM_CONFIG[plt];
                const count = platformCounts[plt];
                const isSelected = selectedFilter === plt;
                return (
                  <button
                    key={plt}
                    type="button"
                    onClick={() => setSelectedFilter(plt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-secondary text-foreground font-semibold border border-border shadow-xs"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    }`}
                  >
                    <span>{conf.icon}</span>
                    <span>{conf.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground ml-0.5">
                      ({count}{!isPro ? "/1" : ""})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Search Input */}
            <div className="relative w-full sm:w-60 shrink-0">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search creator, channel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-card"
              />
            </div>
          </div>

          {/* Creators List Card */}
          <Card className="border-border/80">
            <CardContent className="p-0">
              {filteredStreamers.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                    <Radio className="h-5 w-5 opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {streamers.length === 0 ? "No creator alerts configured yet" : "No matching creators found"}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {streamers.length === 0
                        ? "Connect your favorite Twitch, YouTube, Kick, or TikTok creators to automatically post alerts when they go live or upload."
                        : "Try selecting a different platform filter or clearing your search term."}
                    </p>
                  </div>
                  {streamers.length === 0 && (
                    <Button
                      size="sm"
                      onClick={handleOpenAddModal}
                      className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-medium cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Your First Creator</span>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredStreamers.map((st) => {
                    const conf = PLATFORM_CONFIG[st.platform];
                    return (
                      <div
                        key={st.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/20 transition-colors"
                      >
                        {/* Creator Identity */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${conf.badgeStyle}`}
                            title={conf.name}
                          >
                            <span className="text-base">{conf.icon}</span>
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {st.channelName}
                              </span>
                              {st.channelUrl && (
                                <a
                                  href={st.channelUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                  title="Open channel"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 font-medium capitalize ${conf.badgeStyle}`}
                              >
                                {st.platform}
                              </Badge>

                              {st.notifyLive && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono text-rose-500 bg-rose-500/10">
                                  Live
                                </Badge>
                              )}
                              {st.notifyUploads && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono text-sky-500 bg-sky-500/10">
                                  Uploads
                                </Badge>
                              )}
                            </div>

                            {/* Destination Channel & Ping Target */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                              <span className="text-primary font-medium">{st.discordChannelName || "#channel"}</span>
                              <span className="text-muted-foreground/40">•</span>
                              <span>{st.pingRoleName || "@everyone"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 justify-end shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-2 py-0.5 font-mono ${
                              st.lastStatus === "live"
                                ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                                : "text-muted-foreground border-border"
                            }`}
                          >
                            {st.lastStatus === "live" ? "● LIVE" : "Offline"}
                          </Badge>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => handleOpenEditModal(st)}
                            title="Edit creator alert"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            onClick={() => handleRemoveStreamer(st.id)}
                            title="Remove creator alert"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== TAB 2: TEMPLATES & PREVIEW ==================== */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in-50 duration-150">
          {/* Templates & Branding Settings (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Message Formatting Card */}
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <span>Message Formatting</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize the announcement text sent to Discord for streams and videos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live stream template */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="live-msg" className="text-xs font-semibold flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-rose-500" />
                      <span>Live Stream Announcement</span>
                    </Label>
                  </div>
                  <textarea
                    id="live-msg"
                    rows={3}
                    value={customLiveMessage}
                    onChange={(e) => setCustomLiveMessage(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono leading-relaxed"
                  />
                  <VariableChips
                    variables={STREAM_ALERT_VARIABLES}
                    onInsert={handleInsertLiveToken}
                  />
                </div>

                <Separator className="my-2" />

                {/* Video upload template */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="upload-msg" className="text-xs font-semibold flex items-center gap-1.5">
                      <Film className="h-3.5 w-3.5 text-sky-500" />
                      <span>Video Upload Announcement</span>
                    </Label>
                  </div>
                  <textarea
                    id="upload-msg"
                    rows={3}
                    value={customUploadMessage}
                    onChange={(e) => setCustomUploadMessage(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono leading-relaxed"
                  />
                  <VariableChips
                    variables={VIDEO_UPLOAD_VARIABLES}
                    onInsert={handleInsertUploadToken}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Branding & White-Label Card */}
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span>Alert Branding &amp; Watermark</span>
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] tracking-wider ${
                      isPro ? "border-amber-500/40 text-amber-500 bg-amber-500/10" : ""
                    }`}
                  >
                    {isPro ? "PRO FEATURE" : "FREE PLAN"}
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
                      Free plan alerts display <strong className="text-foreground">⚡ Alert powered by CreatorCore • creatorcore.app</strong> in the Discord embed footer. Upgrade to PRO to enable white-labeling or use your own custom server footer.
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
                          Leave empty to post totally clean embeds with no footer text at all.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Offline Auto-Cleanup Card */}
            <Card className="border-border/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">Offline Message Auto-Cleanup</span>
                      <Badge
                        variant="default"
                        className={`text-[9px] px-1 py-0 ${isPro ? "bg-amber-600" : "bg-muted text-muted-foreground"}`}
                      >
                        PRO
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Automatically edits the announcement message to &quot;🔴 Stream Ended&quot; once the stream concludes.
                    </p>
                  </div>
                  <Switch
                    checked={autoCleanup && isPro}
                    disabled={!isPro}
                    onCheckedChange={setAutoCleanup}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Discord Embed Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border/80 sticky top-4 overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Discord Live Mockup
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Platform Selector */}
                    <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md">
                      <button
                        type="button"
                        onClick={() => setPreviewPlatform("youtube")}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                          previewPlatform === "youtube"
                            ? "bg-red-600 text-white font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        YouTube
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPlatform("twitch")}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                          previewPlatform === "twitch"
                            ? "bg-purple-600 text-white font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Twitch
                      </button>
                    </div>

                    {/* Mode Selector */}
                    <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md">
                      <button
                        type="button"
                        onClick={() => setPreviewMode("live")}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                          previewMode === "live"
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Live
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewMode("upload")}
                        className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                          previewMode === "upload"
                            ? "bg-background text-foreground shadow-xs font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3 bg-[#313338] text-white">
                {/* 1. YouTube Live Preview (Matches Image 1 YAGPDB Style Exactly) */}
                {previewPlatform === "youtube" && previewMode === "live" && (
                  <div className="space-y-2 text-xs">
                    {/* Message Text with Link */}
                    <div className="space-y-0.5">
                      <p className="text-white/95 leading-relaxed font-sans">
                        Hey <span className="text-[#5865f2] bg-[#5865f2]/10 px-1 py-0.2 rounded font-medium">@everyone</span>{" "}
                        <strong className="text-white font-semibold">
                          {streamers.find((s) => s.platform === "youtube")?.channelName || "ALWIZ 2.0"}
                        </strong>{" "}
                        is going to be live soon!
                      </p>
                      <a
                        href="#preview-link"
                        onClick={(e) => e.preventDefault()}
                        className="text-[#00a8fc] hover:underline break-all block font-sans"
                      >
                        https://www.youtube.com/watch?v=YFPbHtVi06U
                      </a>
                    </div>

                    {/* Discord Embed */}
                    <div className="rounded-md border-l-4 border-l-red-600 bg-[#2b2d31] p-3 text-white space-y-2 shadow-md">
                      {/* Author Header */}
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          ▶
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[#949ba4] font-medium leading-none">YouTube</span>
                          <span className="text-xs font-bold text-white leading-tight">
                            {streamers.find((s) => s.platform === "youtube")?.channelName || "ALWIZ 2.0"}
                          </span>
                        </div>
                      </div>

                      {/* Stream Title (Clickable Blue Link) */}
                      <p className="text-sm font-semibold text-[#00a8fc] hover:underline cursor-pointer leading-snug">
                        අද අපි බස් පදිමු | @chirathtimodh
                      </p>

                      {/* Full 16:9 Thumbnail Image */}
                      <div className="relative aspect-video w-full rounded-md overflow-hidden bg-black/60 group cursor-pointer mt-1">
                        <img
                          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1280&q=80"
                          alt="Stream Thumbnail Preview"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Branding Footer */}
                      <div className="pt-1.5 flex items-center justify-between text-[10px] text-[#949ba4] font-mono border-t border-white/5">
                        {customBranding && isPro ? (
                          <span>{customFooterText || "Custom Server Alerts"}</span>
                        ) : (
                          <span>⚡ Alert powered by CreatorCore • creatorcore.app</span>
                        )}
                        <span>Today at 10:10 AM</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Twitch Live Preview */}
                {previewPlatform === "twitch" && previewMode === "live" && (
                  <div className="space-y-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-white/95 leading-relaxed font-sans">
                        Hey <span className="text-[#5865f2] bg-[#5865f2]/10 px-1 py-0.2 rounded font-medium">@everyone</span>{" "}
                        <strong className="text-white font-semibold">
                          {streamers.find((s) => s.platform === "twitch")?.channelName || "TwitchStreamer"}
                        </strong>{" "}
                        is now LIVE playing <strong className="text-white">VALORANT</strong>!
                      </p>
                      <a
                        href="#preview-link"
                        onClick={(e) => e.preventDefault()}
                        className="text-[#00a8fc] hover:underline break-all block font-sans"
                      >
                        https://twitch.tv/{streamers.find((s) => s.platform === "twitch")?.channelName || "streamer"}
                      </a>
                    </div>

                    <div className="rounded-md border-l-4 border-l-purple-600 bg-[#2b2d31] p-3 text-white space-y-2 shadow-md">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          🟣
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[#949ba4] font-medium leading-none">Twitch</span>
                          <span className="text-xs font-bold text-white leading-tight">
                            {streamers.find((s) => s.platform === "twitch")?.channelName || "TwitchStreamer"}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-[#00a8fc] hover:underline cursor-pointer leading-snug">
                        ROAD TO RADIANT | DROPS ON !sens !crosshair
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                        <div>
                          <span className="text-[#949ba4] block text-[10px] uppercase font-bold">Category</span>
                          <span className="font-semibold text-white">VALORANT</span>
                        </div>
                        <div>
                          <span className="text-[#949ba4] block text-[10px] uppercase font-bold">Viewers</span>
                          <span className="font-semibold text-white">12,450 watching</span>
                        </div>
                      </div>

                      <div className="relative aspect-video w-full rounded-md overflow-hidden bg-black/60 group cursor-pointer mt-1">
                        <img
                          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1280&q=80"
                          alt="Stream Thumbnail Preview"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2.5 justify-between">
                          <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                          </span>
                          <span className="text-[10px] text-white/90 bg-black/70 px-1.5 py-0.5 rounded font-mono">
                            1080p60
                          </span>
                        </div>
                      </div>

                      <div className="pt-1.5 flex items-center justify-between text-[10px] text-[#949ba4] font-mono border-t border-white/5">
                        {customBranding && isPro ? (
                          <span>{customFooterText || "Custom Server Alerts"}</span>
                        ) : (
                          <span>⚡ Stream Alert powered by CreatorCore • creatorcore.app</span>
                        )}
                        <span>Today at 10:10 AM</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Video Upload Preview */}
                {previewMode === "upload" && (
                  <div className="space-y-2 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-white/95 leading-relaxed font-sans">
                        🎬 New video uploaded by{" "}
                        <strong className="text-white font-semibold">
                          {streamers.find((s) => s.platform === "youtube")?.channelName || "ALWIZ 2.0"}
                        </strong>
                        ! Check it out:
                      </p>
                      <a
                        href="#preview-link"
                        onClick={(e) => e.preventDefault()}
                        className="text-[#00a8fc] hover:underline break-all block font-sans"
                      >
                        https://www.youtube.com/watch?v=kXxZ1299abc
                      </a>
                    </div>

                    <div className="rounded-md border-l-4 border-l-red-600 bg-[#2b2d31] p-3 text-white space-y-2 shadow-md">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          ▶
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[#949ba4] font-medium leading-none">YouTube</span>
                          <span className="text-xs font-bold text-white leading-tight">
                            {streamers.find((s) => s.platform === "youtube")?.channelName || "ALWIZ 2.0"}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm font-semibold text-[#00a8fc] hover:underline cursor-pointer leading-snug">
                        Euro Truck Simulator 2 - New Real Life Sri Lanka Map Mod Review!
                      </p>

                      <div className="relative aspect-video w-full rounded-md overflow-hidden bg-black/60 group cursor-pointer mt-1">
                        <img
                          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1280&q=80"
                          alt="Video Preview Thumbnail"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="h-4 w-4 fill-current ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold">
                          18:42
                        </div>
                      </div>

                      <div className="pt-1.5 flex items-center justify-between text-[10px] text-[#949ba4] font-mono border-t border-white/5">
                        {customBranding && isPro ? (
                          <span>{customFooterText || "Custom Server Alerts"}</span>
                        ) : (
                          <span>⚡ Video Alert powered by CreatorCore • creatorcore.app</span>
                        )}
                        <span>Today at 10:10 AM</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== ADD / EDIT CREATOR MODAL DIALOG ==================== */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) setEditingStreamerId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {editingStreamerId ? (
                <>
                  <Pencil className="h-4 w-4 text-primary" />
                  <span>Edit Creator Alert</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 text-primary" />
                  <span>Add Creator Alert</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingStreamerId
                ? "Update notification channel, ping role, or alert preferences for this creator."
                : "Enter any Twitch, YouTube, Kick, or TikTok channel link or username."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Modal Error */}
            {modalError && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Platform Selection Tabs */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Platform</Label>
              <div className="grid grid-cols-4 gap-2">
                {(["twitch", "youtube", "kick", "tiktok"] as PlatformType[]).map((plt) => {
                  const conf = PLATFORM_CONFIG[plt];
                  const isSelected = modalPlatform === plt;
                  return (
                    <button
                      key={plt}
                      type="button"
                      onClick={() => {
                        setModalPlatform(plt);
                        setAutoDetected(null);
                        if (plt === "youtube" || plt === "tiktok") {
                          setNotifyUploads(true);
                        } else {
                          setNotifyUploads(false);
                          setNotifyLive(true);
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-secondary text-foreground border-primary shadow-xs font-semibold"
                          : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <span className="text-base">{conf.icon}</span>
                      <span className="mt-1 capitalize text-[11px]">{conf.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channel URL or Handle Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="modal-stream-url" className="text-xs font-semibold">
                  Channel URL or Handle
                </Label>
                {autoDetected && (
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 flex items-center gap-1 font-mono">
                    <Sparkles className="h-2.5 w-2.5" />
                    Auto: {autoDetected}
                  </Badge>
                )}
              </div>
              <Input
                id="modal-stream-url"
                placeholder={
                  modalPlatform === "twitch"
                    ? "twitch.tv/shroud or shroud"
                    : modalPlatform === "youtube"
                      ? "youtube.com/@MrBeast or @MrBeast"
                      : modalPlatform === "kick"
                        ? "kick.com/xqc or xqc"
                        : "tiktok.com/@creator or @creator"
                }
                value={inputUrlOrHandle}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddStreamer();
                  }
                }}
                className="text-xs font-mono h-9"
                autoFocus
              />
            </div>

            {/* Destination Channels (2 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Discord Channel</Label>
                <select
                  value={targetChannelId}
                  onChange={(e) => setTargetChannelId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ping Role</Label>
                <select
                  value={targetRoleId}
                  onChange={(e) => setTargetRoleId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Alert Events Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Alert Events</Label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/80 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyLive}
                    onChange={(e) => setNotifyLive(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <div className="text-xs">
                    <span className="font-semibold block text-foreground">Live Streams</span>
                    <span className="text-[10px] text-muted-foreground">Alert when going live</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-border/80 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={notifyUploads}
                    onChange={(e) => setNotifyUploads(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <div className="text-xs">
                    <span className="font-semibold block text-foreground">New Videos</span>
                    <span className="text-[10px] text-muted-foreground">Alert on new uploads</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingStreamerId(null);
              }}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddStreamer}
              className="text-xs h-8 bg-primary text-primary-foreground font-semibold"
            >
              {editingStreamerId ? "Save Changes" : "Add Creator"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
