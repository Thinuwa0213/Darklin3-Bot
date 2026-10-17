"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import {
  Save,
  MessageSquare,
  Users,
  FolderTree,
  Mic,
  Hash,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader, ModuleToggle } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import type { ActionLogsConfig } from "@/lib/action-logs-types";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";
import { saveActionLogsConfigAction } from "@/app/actions";
import { cn } from "@/lib/utils";

interface ActionLogsViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  initialConfig: ActionLogsConfig;
  serverName: string;
  liveChannels: LiveDiscordChannel[];
  liveRoles: LiveDiscordRole[];
  botRuntimeStatus: string;
  isBotOnline: boolean;
}

export function ActionLogsView({
  tenantId,
  guildId,
  currentPlan: _currentPlan,
  initialConfig,
  serverName: _serverName,
  liveChannels,
  liveRoles: _liveRoles,
  botRuntimeStatus: _botRuntimeStatus,
  isBotOnline: _isBotOnline,
}: ActionLogsViewProps) {
  const [config, setConfig] = useState<ActionLogsConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Clean Discord channels for SearchableSelect options
  const channelOptions: SearchableOption[] = useMemo(() => {
    return liveChannels.map((ch) => {
      const cleanName = ch.name.replace(/^#+/, "");
      return {
        value: ch.id,
        label: cleanName,
        icon: <Hash className="h-3.5 w-3.5 text-zinc-400" />,
      };
    });
  }, [liveChannels]);

  const defaultChannelName = useMemo(() => {
    const found = liveChannels.find((c) => c.id === config.defaultChannelId);
    return found ? `#${found.name.replace(/^#+/, "")}` : "Unset";
  }, [liveChannels, config.defaultChannelId]);

  const handleSave = () => {
    startTransition(async () => {
      setFeedback(null);
      const res = await saveActionLogsConfigAction(tenantId, guildId, config);
      if (res.ok && res.config) {
        setConfig(res.config);
        setFeedback({ type: "success", message: "Action logs configuration saved successfully." });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to save configuration." });
      }
    });
  };

  const handleEventChannelChange = (eventKey: string, channelId: string | undefined) => {
    setConfig((prev) => ({
      ...prev,
      eventChannels: {
        ...(prev.eventChannels || {}),
        [eventKey]: channelId,
      },
    }));
  };

  const toggleMessageEvent = (eventKey: keyof ActionLogsConfig["categories"]["messages"]["events"]) => {
    setConfig((prev) => {
      const cat = prev.categories.messages;
      return {
        ...prev,
        categories: {
          ...prev.categories,
          messages: {
            ...cat,
            events: {
              ...cat.events,
              [eventKey]: !cat.events[eventKey],
            },
          },
        },
      };
    });
  };

  const toggleMemberEvent = (eventKey: keyof ActionLogsConfig["categories"]["members"]["events"]) => {
    setConfig((prev) => {
      const cat = prev.categories.members;
      return {
        ...prev,
        categories: {
          ...prev.categories,
          members: {
            ...cat,
            events: {
              ...cat.events,
              [eventKey]: !cat.events[eventKey],
            },
          },
        },
      };
    });
  };

  const toggleServerEvent = (eventKey: keyof ActionLogsConfig["categories"]["channelsAndRoles"]["events"]) => {
    setConfig((prev) => {
      const cat = prev.categories.channelsAndRoles;
      return {
        ...prev,
        categories: {
          ...prev.categories,
          channelsAndRoles: {
            ...cat,
            events: {
              ...cat.events,
              [eventKey]: !cat.events[eventKey],
            },
          },
        },
      };
    });
  };

  const toggleVoiceEvent = (eventKey: keyof ActionLogsConfig["categories"]["voice"]["events"]) => {
    setConfig((prev) => {
      const cat = prev.categories.voice;
      return {
        ...prev,
        categories: {
          ...prev.categories,
          voice: {
            ...cat,
            events: {
              ...cat.events,
              [eventKey]: !cat.events[eventKey],
            },
          },
        },
      };
    });
  };

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Unified Page Header Bar */}
      <PageHeader
        category="Server Defense & Audit"
        title="Action Logs"
        description="Track server modifications with advanced filters, per-event routing, and high-fidelity embeds."
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <div className="flex items-center gap-2.5">
            <ModuleToggle
              enabled={config.enabled}
              onToggle={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
              activeLabel="Active"
              disabledLabel="Paused"
            />
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

      {/* 3 Quick Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Individual Channels */}
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 backdrop-blur-sm shadow-md flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-200">
                Individual Channels
              </span>
              <div
                className="group relative cursor-help text-zinc-500 hover:text-zinc-300"
                title="Configure custom destination channels for each event individually."
              >
                <Info className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              Override destination channel per specific action event.
            </p>
          </div>
          <Switch
            checked={Boolean(config.individualChannels)}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, individualChannels: checked }))
            }
            className="data-[state=checked]:bg-emerald-500 shrink-0"
          />
        </div>

        {/* Card 2: Show Member Avatars */}
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 backdrop-blur-sm shadow-md flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-200">
                Show Member Avatars
              </span>
              <div
                className="group relative cursor-help text-zinc-500 hover:text-zinc-300"
                title="Include member avatars as thumbnails inside join/leave and audit embeds."
              >
                <Info className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              Display avatar thumbnails in member join/leave logs.
            </p>
          </div>
          <Switch
            checked={config.showMemberAvatars !== false}
            onCheckedChange={(checked) =>
              setConfig((prev) => ({ ...prev, showMemberAvatars: checked }))
            }
            className="data-[state=checked]:bg-emerald-500 shrink-0"
          />
        </div>

        {/* Card 3: New Account Age */}
        <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 backdrop-blur-sm shadow-md flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-200">
                New Account Age (Days)
              </span>
              <div
                className="group relative cursor-help text-zinc-500 hover:text-zinc-300"
                title="Highlight accounts created fewer than this many days ago when they join."
              >
                <Info className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              Flag suspicious fresh accounts joining your guild.
            </p>
          </div>
          <div className="w-20 shrink-0">
            <Input
              type="number"
              min={1}
              max={60}
              value={config.newAccountAgeDays ?? 7}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  newAccountAgeDays: Math.max(1, Number(e.target.value) || 1),
                }))
              }
              className="h-9 text-xs font-mono text-center bg-zinc-900 border-zinc-700 text-zinc-100 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Global Log Delivery Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
              Global Log Delivery
            </h2>
            <p className="text-xs text-zinc-400">
              Primary fallback Discord channel where all audit events are delivered.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] text-zinc-400 border-zinc-800">
            Fallback Channel
          </Badge>
        </div>

        <div className="max-w-md pt-1">
          <SearchableSelect
            id="global-log-channel"
            options={channelOptions}
            value={config.defaultChannelId ?? ""}
            onChange={(val) => setConfig((prev) => ({ ...prev, defaultChannelId: val || undefined }))}
            placeholder="Select a default log channel (e.g. #mod-log)..."
            searchPlaceholder="Search channel..."
            emptyMessage="No Discord channels found"
          />
        </div>
      </div>

      {/* Message Events Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm shadow-lg space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800/60">
          <MessageSquare className="h-4 w-4 text-sky-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-200">
            Message Events
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Message Delete */}
          <EventRow
            title="Message Delete"
            enabled={config.categories.messages.events.messageDelete}
            onToggle={() => toggleMessageEvent("messageDelete")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["messages.messageDelete"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("messages.messageDelete", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          {/* Message Edit */}
          <EventRow
            title="Message Edit"
            enabled={config.categories.messages.events.messageUpdate}
            onToggle={() => toggleMessageEvent("messageUpdate")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["messages.messageUpdate"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("messages.messageUpdate", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          {/* Image Delete */}
          <EventRow
            title="Image Delete"
            enabled={config.categories.messages.events.imageDelete ?? true}
            onToggle={() => toggleMessageEvent("imageDelete")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["messages.imageDelete"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("messages.imageDelete", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          {/* Bulk Message Delete */}
          <EventRow
            title="Bulk Message Delete"
            enabled={config.categories.messages.events.bulkDelete ?? true}
            onToggle={() => toggleMessageEvent("bulkDelete")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["messages.bulkDelete"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("messages.bulkDelete", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          {/* Log Invites / Invite Info */}
          <EventRow
            title="Log Invites / Invite Info"
            enabled={config.categories.messages.events.invites ?? true}
            onToggle={() => toggleMessageEvent("invites")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["messages.invites"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("messages.invites", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          {/* Moderator Commands */}
          <EventRow
            title="Moderator Commands"
            enabled={config.categories.messages.events.modCommands ?? true}
            onToggle={() => toggleMessageEvent("modCommands")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["messages.modCommands"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("messages.modCommands", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />
        </div>
      </div>

      {/* Member Events Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm shadow-lg space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800/60">
          <Users className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-200">
            Member Events
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <EventRow
            title="Member Joined"
            enabled={config.categories.members.events.memberJoin}
            onToggle={() => toggleMemberEvent("memberJoin")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["members.memberJoin"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("members.memberJoin", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          <EventRow
            title="Member Left"
            enabled={config.categories.members.events.memberLeave}
            onToggle={() => toggleMemberEvent("memberLeave")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["members.memberLeave"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("members.memberLeave", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          <EventRow
            title="Role Updates"
            enabled={config.categories.members.events.roleUpdate}
            onToggle={() => toggleMemberEvent("roleUpdate")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["members.roleUpdate"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("members.roleUpdate", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          <EventRow
            title="Nickname Updates"
            enabled={config.categories.members.events.nicknameUpdate}
            onToggle={() => toggleMemberEvent("nicknameUpdate")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["members.nicknameUpdate"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("members.nicknameUpdate", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />
        </div>
      </div>

      {/* Server & Channels Events Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm shadow-lg space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800/60">
          <FolderTree className="h-4 w-4 text-amber-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-200">
            Server &amp; Channel Events
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <EventRow
            title="Channel Created"
            enabled={config.categories.channelsAndRoles.events.channelCreate}
            onToggle={() => toggleServerEvent("channelCreate")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["channels.channelCreate"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("channels.channelCreate", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          <EventRow
            title="Channel Deleted"
            enabled={config.categories.channelsAndRoles.events.channelDelete}
            onToggle={() => toggleServerEvent("channelDelete")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["channels.channelDelete"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("channels.channelDelete", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          <EventRow
            title="Role Created"
            enabled={config.categories.channelsAndRoles.events.roleCreate}
            onToggle={() => toggleServerEvent("roleCreate")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["roles.roleCreate"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("roles.roleCreate", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          <EventRow
            title="Role Deleted"
            enabled={config.categories.channelsAndRoles.events.roleDelete}
            onToggle={() => toggleServerEvent("roleDelete")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["roles.roleDelete"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("roles.roleDelete", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />
        </div>
      </div>

      {/* Voice Events Card */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 backdrop-blur-sm shadow-lg space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800/60">
          <Mic className="h-4 w-4 text-purple-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-200">
            Voice Events
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <EventRow
            title="Voice Join &amp; Leave"
            enabled={config.categories.voice.events.voiceJoin}
            onToggle={() => toggleVoiceEvent("voiceJoin")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["voice.voiceJoin"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("voice.voiceJoin", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />

          <EventRow
            title="Voice Channel Move"
            enabled={config.categories.voice.events.voiceMove}
            onToggle={() => toggleVoiceEvent("voiceMove")}
            individualChannels={Boolean(config.individualChannels)}
            channelValue={config.eventChannels?.["voice.voiceMove"] ?? ""}
            onChannelChange={(ch) => handleEventChannelChange("voice.voiceMove", ch)}
            channelOptions={channelOptions}
            defaultChannelName={defaultChannelName}
          />
        </div>
      </div>
    </div>
  );
}

interface EventRowProps {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  individualChannels: boolean;
  channelValue: string;
  onChannelChange: (val: string | undefined) => void;
  channelOptions: SearchableOption[];
  defaultChannelName: string;
}

function EventRow({
  title,
  enabled,
  onToggle,
  individualChannels,
  channelValue,
  onChannelChange,
  channelOptions,
  defaultChannelName,
}: EventRowProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-all flex flex-col justify-between gap-3",
        enabled
          ? "bg-zinc-900/70 border-zinc-800 text-zinc-100"
          : "bg-zinc-900/30 border-zinc-850 text-zinc-500 opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-bold tracking-wide uppercase truncate">
          {title}
        </span>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-emerald-500 scale-90 shrink-0"
        />
      </div>

      {individualChannels && enabled && (
        <div className="pt-1">
          <SearchableSelect
            options={channelOptions}
            value={channelValue}
            onChange={(val) => onChannelChange(val || undefined)}
            placeholder={`Global (${defaultChannelName})`}
            searchPlaceholder="Search event channel..."
            emptyMessage="No channels found"
            className="h-8 text-xs bg-zinc-950/80 border-zinc-800"
          />
        </div>
      )}
    </div>
  );
}
