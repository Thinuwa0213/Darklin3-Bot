"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import {
  Save,
  Plus,
  X,
  Hash,
  Search,
  Settings,
  Pencil,
  Trash2,
  Mail,
  AlertTriangle,
  Clock,
  AtSign,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, ModuleToggle, ProBadge } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ModerationConfig, CustomAutoModRule } from "@/lib/moderation-types";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";
import { saveModerationConfigAction } from "@/app/actions";
import { cn } from "@/lib/utils";

interface ModerationViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  initialConfig: ModerationConfig;
  serverName: string;
  liveChannels: LiveDiscordChannel[];
  liveRoles: LiveDiscordRole[];
}

export function ModerationView({
  tenantId,
  guildId,
  currentPlan,
  initialConfig,
  serverName: _serverName,
  liveChannels,
  liveRoles,
}: ModerationViewProps) {
  const [config, setConfig] = useState<ModerationConfig>(initialConfig);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Dialog States
  const [isGeneralSettingsOpen, setIsGeneralSettingsOpen] = useState(false);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [editingRuleKey, setEditingRuleKey] = useState<string | null>(null);

  // New Rule Temporary State
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const [newRulePatterns, setNewRulePatterns] = useState("");
  const [newRuleAction, setNewRuleAction] = useState<"DELETE" | "TIMEOUT" | "WARN">("DELETE");
  const [newRuleTimeout, setNewRuleTimeout] = useState<number>(300);
  const [newRuleSendAlert, setNewRuleSendAlert] = useState(true);
  const [newRuleSendDm, setNewRuleSendDm] = useState(false);

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

  const roleOptions: SearchableOption[] = useMemo(() => {
    return liveRoles.map((r) => ({
      value: r.id,
      label: r.name,
      icon: <AtSign className="h-3.5 w-3.5 text-zinc-400" />,
    }));
  }, [liveRoles]);

  const handleSave = () => {
    startTransition(async () => {
      setFeedback(null);
      const res = await saveModerationConfigAction(tenantId, guildId, config);
      if (res.ok && res.config) {
        setConfig(res.config);
        setFeedback({ type: "success", message: "Auto-moderation defense rules saved successfully." });
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to save configuration." });
      }
    });
  };

  const handleCreateRule = () => {
    if (!newRuleName.trim()) return;
    const patterns = newRulePatterns
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    const newRule: CustomAutoModRule = {
      id: `custom_${Date.now()}`,
      name: newRuleName.trim(),
      description: newRuleDescription.trim() || "Custom user-defined moderation filter rule.",
      enabled: true,
      type: "CUSTOM_WORD",
      patterns: patterns.length > 0 ? patterns : [newRuleName.trim().toLowerCase()],
      action: newRuleAction,
      timeoutSeconds: newRuleTimeout,
      sendAlert: newRuleSendAlert,
      sendDm: newRuleSendDm,
    };

    setConfig((prev) => ({
      ...prev,
      customRules: [...(prev.customRules || []), newRule],
    }));

    setNewRuleName("");
    setNewRuleDescription("");
    setNewRulePatterns("");
    setIsCreateRuleOpen(false);
    setFeedback({ type: "success", message: `Rule "${newRule.name}" created. Click "Save Changes" to apply.` });
  };

  const handleDeleteCustomRule = (ruleId: string) => {
    setConfig((prev) => ({
      ...prev,
      customRules: (prev.customRules || []).filter((r) => r.id !== ruleId),
    }));
  };

  // Rule definitions list for search & rendering
  const standardRules = [
    {
      key: "antiSpam",
      name: "FAST MESSAGE SPAM",
      typeLabel: "RULE: FAST MESSAGE SPAM",
      description: "Detects when a user sends multiple messages rapidly in a short time frame.",
      enabled: config.antiSpam.enabled,
      action: config.antiSpam.action,
      timeoutSeconds: config.antiSpam.timeoutSeconds,
      sendAlert: config.antiSpam.sendAlert ?? true,
      sendDm: config.antiSpam.sendDm ?? false,
      onToggle: (checked: boolean) =>
        setConfig((prev) => ({ ...prev, antiSpam: { ...prev.antiSpam, enabled: checked } })),
    },
    {
      key: "imageSpam",
      name: "IMAGES SPAM",
      typeLabel: "RULE: IMAGE SPAM",
      description: "Detects multiple images, attachments, or media files sent at once.",
      enabled: config.imageSpam?.enabled ?? true,
      action: config.imageSpam?.action ?? "DELETE",
      timeoutSeconds: config.imageSpam?.timeoutSeconds ?? 300,
      sendAlert: config.imageSpam?.sendAlert ?? true,
      sendDm: config.imageSpam?.sendDm ?? false,
      onToggle: (checked: boolean) =>
        setConfig((prev) => ({
          ...prev,
          imageSpam: {
            ...(prev.imageSpam || {
              maxImages: 3,
              timeSpan: 5,
              action: "DELETE",
              timeoutSeconds: 300,
              sendAlert: true,
              sendDm: false,
            }),
            enabled: checked,
          },
        })),
    },
    {
      key: "antiInvites",
      name: "LINKS (INVITES)",
      typeLabel: "RULE: INVITE LINKS",
      description: "Detects and purges unauthorized discord.gg or external server invite links.",
      enabled: config.antiInvites.enabled,
      action: config.antiInvites.action,
      timeoutSeconds: config.antiInvites.timeoutSeconds,
      sendAlert: config.antiInvites.sendAlert ?? true,
      sendDm: config.antiInvites.sendDm ?? false,
      onToggle: (checked: boolean) =>
        setConfig((prev) => ({ ...prev, antiInvites: { ...prev.antiInvites, enabled: checked } })),
    },
    {
      key: "massMentions",
      name: "MENTION SPAM",
      typeLabel: "RULE: MENTION SPAM",
      description: "Detects messages pinging excessive users or server roles at once.",
      enabled: config.massMentions.enabled,
      action: config.massMentions.action,
      timeoutSeconds: config.massMentions.timeoutSeconds,
      sendAlert: config.massMentions.sendAlert ?? true,
      sendDm: config.massMentions.sendDm ?? false,
      onToggle: (checked: boolean) =>
        setConfig((prev) => ({ ...prev, massMentions: { ...prev.massMentions, enabled: checked } })),
    },
    {
      key: "badWords",
      name: "BAD WORDS",
      typeLabel: "RULE: BANNED WORDS",
      description: "Filters disallowed vocabulary, toxic slurs, phishing links, and scam phrases.",
      enabled: config.badWords.enabled,
      action: config.badWords.action,
      timeoutSeconds: config.badWords.timeoutSeconds,
      sendAlert: config.badWords.sendAlert ?? true,
      sendDm: config.badWords.sendDm ?? false,
      onToggle: (checked: boolean) =>
        setConfig((prev) => ({ ...prev, badWords: { ...prev.badWords, enabled: checked } })),
    },
    {
      key: "capsLimit",
      name: "CAPS LOCK SPAM",
      typeLabel: "RULE: CAPS LIMIT",
      description: "Prevents excessive uppercase messages and shouting in chat channels.",
      enabled: config.capsLimit.enabled,
      action: config.capsLimit.action ?? "DELETE",
      timeoutSeconds: 60,
      sendAlert: config.capsLimit.sendAlert ?? false,
      sendDm: config.capsLimit.sendDm ?? false,
      onToggle: (checked: boolean) =>
        setConfig((prev) => ({ ...prev, capsLimit: { ...prev.capsLimit, enabled: checked } })),
    },
  ];

  // Combined rule list
  const allRules = [
    ...standardRules,
    ...(config.customRules || []).map((cr) => ({
      key: cr.id,
      name: cr.name,
      typeLabel: `RULE: ${cr.type}`,
      description: cr.description,
      enabled: cr.enabled,
      action: cr.action,
      timeoutSeconds: cr.timeoutSeconds,
      sendAlert: cr.sendAlert ?? true,
      sendDm: cr.sendDm ?? false,
      isCustom: true,
      onToggle: (checked: boolean) => {
        setConfig((prev) => ({
          ...prev,
          customRules: (prev.customRules || []).map((r) =>
            r.id === cr.id ? { ...r, enabled: checked } : r,
          ),
        }));
      },
    })),
  ];

  // Filtered by search query
  const filteredRules = allRules.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {/* Unified Page Header Bar */}
      <PageHeader
        category="Server Security & Defense"
        title="Auto Moderation"
        description="Keep your server safe with automated filters, spam protection, and real-time rule enforcement."
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
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateRuleOpen(true)}
              className="gap-1.5 text-xs h-9 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Rule</span>
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

      {/* Search & General Settings Bar */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 backdrop-blur-sm shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-zinc-900/80 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 rounded-xl text-xs font-mono"
          />
        </div>

        <Button
          onClick={() => setIsGeneralSettingsOpen(true)}
          variant="outline"
          className="gap-2 h-10 px-4 bg-zinc-900/60 hover:bg-zinc-800 border-zinc-800 text-zinc-300 font-mono text-xs tracking-wider uppercase rounded-xl shrink-0 cursor-pointer"
        >
          <Settings className="h-4 w-4 text-zinc-400" />
          <span>General Settings</span>
        </Button>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRules.map((rule) => {
          return (
            <div
              key={rule.key}
              className={cn(
                "rounded-2xl border p-5 transition-all flex flex-col justify-between backdrop-blur-sm shadow-md",
                rule.enabled
                  ? "bg-zinc-950/70 border-zinc-800/90 text-zinc-100"
                  : "bg-zinc-950/30 border-zinc-900 text-zinc-500 opacity-65",
              )}
            >
              <div className="space-y-3">
                {/* Header: Title + Switch */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-mono font-black tracking-wider uppercase text-zinc-100">
                      {rule.name}
                    </h3>
                    <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-400">
                      {rule.typeLabel}
                    </p>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={rule.onToggle}
                    className="data-[state=checked]:bg-emerald-500 shrink-0"
                  />
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-400 leading-relaxed min-h-[36px]">
                  {rule.description}
                </p>

                {/* Action Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {rule.sendDm && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      <Mail className="h-3 w-3" /> DM
                    </span>
                  )}
                  {rule.sendAlert && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="h-3 w-3" /> ALERT
                    </span>
                  )}
                  {(rule.action === "DELETE" || rule.action === "TIMEOUT") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <Trash2 className="h-3 w-3" /> DELETE
                    </span>
                  )}
                  {rule.action === "TIMEOUT" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Clock className="h-3 w-3" /> TIMEOUT ({Math.round(rule.timeoutSeconds / 60)}m)
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Buttons: Edit & Delete/Reset */}
              <div className="grid grid-cols-2 gap-2 pt-5 border-t border-zinc-800/60 mt-4">
                <Button
                  onClick={() => setEditingRuleKey(rule.key)}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-[11px] font-mono font-semibold tracking-wider uppercase bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-300 rounded-lg cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Edit</span>
                </Button>

                {(rule as any).isCustom ? (
                  <Button
                    onClick={() => handleDeleteCustomRule(rule.key)}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-[11px] font-mono font-semibold tracking-wider uppercase bg-rose-950/20 hover:bg-rose-950/40 border-rose-900/40 text-rose-400 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </Button>
                ) : (
                  <Button
                    onClick={() => rule.onToggle(false)}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-[11px] font-mono font-semibold tracking-wider uppercase bg-zinc-900/40 hover:bg-zinc-800/60 border-zinc-800 text-zinc-400 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Disable</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* General Settings Dialog */}
      <Dialog open={isGeneralSettingsOpen} onOpenChange={setIsGeneralSettingsOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100 flex items-center gap-2">
              <Settings className="h-4 w-4 text-emerald-400" />
              General Moderation Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Configure global destination channels and immune bypass filters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Violation Log Channel */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                Violation Log Channel
              </Label>
              <SearchableSelect
                options={channelOptions}
                value={config.logChannelId ?? ""}
                onChange={(val) => setConfig((prev) => ({ ...prev, logChannelId: val || undefined }))}
                placeholder="Select log channel (e.g. #mod-logs)..."
                searchPlaceholder="Search log channel..."
                emptyMessage="No Discord channels found"
              />
              <p className="text-[11px] text-zinc-500">
                Audit embeds detailing violators and purged content are sent here.
              </p>
            </div>

            {/* Ignored Channels */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                Immune / Ignored Channels
              </Label>
              <SearchableSelect
                options={channelOptions}
                value=""
                onChange={(val) => {
                  if (val && !config.ignoredChannels.includes(val)) {
                    setConfig((prev) => ({ ...prev, ignoredChannels: [...prev.ignoredChannels, val] }));
                  }
                }}
                placeholder="Add channel to immune whitelist..."
                searchPlaceholder="Search channel..."
                emptyMessage="No channels found"
              />
              <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                {config.ignoredChannels.map((chId) => {
                  const ch = liveChannels.find((c) => c.id === chId);
                  return (
                    <span
                      key={chId}
                      className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800"
                    >
                      #{ch?.name.replace(/^#+/, "") || chId}
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            ignoredChannels: prev.ignoredChannels.filter((id) => id !== chId),
                          }))
                        }
                        className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Ignored Roles */}
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                Immune / Ignored Roles
              </Label>
              <SearchableSelect
                options={roleOptions}
                value=""
                onChange={(val) => {
                  if (val && !config.ignoredRoles.includes(val)) {
                    setConfig((prev) => ({ ...prev, ignoredRoles: [...prev.ignoredRoles, val] }));
                  }
                }}
                placeholder="Add role to immune whitelist..."
                searchPlaceholder="Search role..."
                emptyMessage="No roles found"
              />
              <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                {config.ignoredRoles.map((roleId) => {
                  const r = liveRoles.find((rl) => rl.id === roleId);
                  return (
                    <span
                      key={roleId}
                      className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800"
                    >
                      @{r?.name || roleId}
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            ignoredRoles: prev.ignoredRoles.filter((id) => id !== roleId),
                          }))
                        }
                        className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setIsGeneralSettingsOpen(false);
                handleSave();
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold rounded-xl"
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      {editingRuleKey && (
        <EditRuleDialog
          ruleKey={editingRuleKey}
          config={config}
          setConfig={setConfig}
          onClose={() => setEditingRuleKey(null)}
          onSave={() => {
            setEditingRuleKey(null);
            handleSave();
          }}
        />
      )}

      {/* Create Rule Dialog */}
      <Dialog open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100 flex items-center gap-2">
              <Plus className="h-4 w-4 text-rose-500" />
              Create Custom Defense Rule
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Add a custom keyword or pattern-based filter to the auto-moderation engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                Rule Name
              </Label>
              <Input
                placeholder="e.g. Nitro Scam Filter"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                className="h-9 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                Description
              </Label>
              <Input
                placeholder="e.g. Purges phishing links offering free Discord Nitro"
                value={newRuleDescription}
                onChange={(e) => setNewRuleDescription(e.target.value)}
                className="h-9 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-zinc-300">
                Keywords / Patterns (Comma-separated)
              </Label>
              <Input
                placeholder="e.g. free nitro, steam-giveaway, claim now"
                value={newRulePatterns}
                onChange={(e) => setNewRulePatterns(e.target.value)}
                className="h-9 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Enforcement Action</Label>
                <select
                  value={newRuleAction}
                  onChange={(e) => setNewRuleAction(e.target.value as any)}
                  className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  <option value="DELETE">Delete Message</option>
                  <option value="TIMEOUT">Delete &amp; Timeout User</option>
                  <option value="WARN">Warn Only</option>
                </select>
              </div>

              {newRuleAction === "TIMEOUT" && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Timeout Duration</Label>
                  <select
                    value={String(newRuleTimeout)}
                    onChange={(e) => setNewRuleTimeout(Number(e.target.value))}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                  >
                    <option value="60">1 Minute</option>
                    <option value="300">5 Minutes</option>
                    <option value="600">10 Minutes</option>
                    <option value="3600">1 Hour</option>
                    <option value="86400">24 Hours</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-850 bg-zinc-900/60">
                <span className="text-xs text-zinc-300">Send Alert in Chat</span>
                <Switch
                  checked={newRuleSendAlert}
                  onCheckedChange={setNewRuleSendAlert}
                  className="data-[state=checked]:bg-emerald-500 scale-90"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-850 bg-zinc-900/60">
                <span className="text-xs text-zinc-300">Send DM Warning</span>
                <Switch
                  checked={newRuleSendDm}
                  onCheckedChange={setNewRuleSendDm}
                  className="data-[state=checked]:bg-emerald-500 scale-90"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleCreateRule}
              disabled={!newRuleName.trim()}
              className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-semibold rounded-xl"
            >
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Edit Rule Dialog Sub-component
interface EditRuleDialogProps {
  ruleKey: string;
  config: ModerationConfig;
  setConfig: React.Dispatch<React.SetStateAction<ModerationConfig>>;
  onClose: () => void;
  onSave: () => void;
}

function EditRuleDialog({ ruleKey, config, setConfig, onClose, onSave }: EditRuleDialogProps) {
  const [tagInput, setTagInput] = useState("");

  if (ruleKey === "antiSpam") {
    const rule = config.antiSpam;
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100">
              Configure Fast Message Spam
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Detects and halts message flooding across text channels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Message Threshold</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={2}
                    max={20}
                    value={rule.threshold}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        antiSpam: { ...prev.antiSpam, threshold: Number(e.target.value) || 5 },
                      }))
                    }
                    className="h-9 bg-zinc-900 border-zinc-800 text-xs font-mono text-zinc-100"
                  />
                  <span className="text-[11px] text-zinc-400">msgs</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Time Window</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    value={rule.timeSpan}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        antiSpam: { ...prev.antiSpam, timeSpan: Number(e.target.value) || 5 },
                      }))
                    }
                    className="h-9 bg-zinc-900 border-zinc-800 text-xs font-mono text-zinc-100"
                  />
                  <span className="text-[11px] text-zinc-400">sec</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Enforcement Action</Label>
                <select
                  value={rule.action}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      antiSpam: { ...prev.antiSpam, action: e.target.value as any },
                    }))
                  }
                  className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  <option value="TIMEOUT">Timeout Member</option>
                  <option value="DELETE">Delete Messages Only</option>
                  <option value="WARN">Warn Only</option>
                </select>
              </div>

              {rule.action === "TIMEOUT" && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Timeout Length</Label>
                  <select
                    value={String(rule.timeoutSeconds)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        antiSpam: { ...prev.antiSpam, timeoutSeconds: Number(e.target.value) },
                      }))
                    }
                    className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                  >
                    <option value="60">1 Minute</option>
                    <option value="300">5 Minutes</option>
                    <option value="600">10 Minutes</option>
                    <option value="3600">1 Hour</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-850 bg-zinc-900/60">
                <span className="text-xs text-zinc-300">Send Alert</span>
                <Switch
                  checked={rule.sendAlert ?? true}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({
                      ...prev,
                      antiSpam: { ...prev.antiSpam, sendAlert: checked },
                    }))
                  }
                  className="data-[state=checked]:bg-emerald-500 scale-90"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-850 bg-zinc-900/60">
                <span className="text-xs text-zinc-300">Send DM</span>
                <Switch
                  checked={rule.sendDm ?? false}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({
                      ...prev,
                      antiSpam: { ...prev.antiSpam, sendDm: checked },
                    }))
                  }
                  className="data-[state=checked]:bg-emerald-500 scale-90"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-xl">
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (ruleKey === "imageSpam") {
    const rule = config.imageSpam || {
      enabled: true,
      maxImages: 3,
      timeSpan: 5,
      action: "DELETE",
      timeoutSeconds: 300,
      sendAlert: true,
      sendDm: false,
    };
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100">
              Configure Image Spam
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Limits rapid uploading of images and file attachments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Max Images</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={rule.maxImages}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      imageSpam: {
                        ...(prev.imageSpam || rule),
                        maxImages: Number(e.target.value) || 3,
                      },
                    }))
                  }
                  className="h-9 bg-zinc-900 border-zinc-800 text-xs font-mono text-zinc-100"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Time Window (sec)</Label>
                <Input
                  type="number"
                  min={2}
                  max={30}
                  value={rule.timeSpan}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      imageSpam: {
                        ...(prev.imageSpam || rule),
                        timeSpan: Number(e.target.value) || 5,
                      },
                    }))
                  }
                  className="h-9 bg-zinc-900 border-zinc-800 text-xs font-mono text-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Action</Label>
                <select
                  value={rule.action}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      imageSpam: {
                        ...(prev.imageSpam || rule),
                        action: e.target.value as any,
                      },
                    }))
                  }
                  className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  <option value="DELETE">Delete Messages</option>
                  <option value="TIMEOUT">Timeout Member</option>
                </select>
              </div>

              {rule.action === "TIMEOUT" && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Timeout Length</Label>
                  <select
                    value={String(rule.timeoutSeconds)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        imageSpam: {
                          ...(prev.imageSpam || rule),
                          timeoutSeconds: Number(e.target.value),
                        },
                      }))
                    }
                    className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                  >
                    <option value="60">1 Minute</option>
                    <option value="300">5 Minutes</option>
                    <option value="600">10 Minutes</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-xl">
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (ruleKey === "antiInvites") {
    const rule = config.antiInvites;
    const addWhitelist = () => {
      const trimmed = tagInput.trim().toLowerCase();
      if (!trimmed) return;
      if (!rule.allowedInvites.includes(trimmed)) {
        setConfig((prev) => ({
          ...prev,
          antiInvites: {
            ...prev.antiInvites,
            allowedInvites: [...prev.antiInvites.allowedInvites, trimmed],
          },
        }));
      }
      setTagInput("");
    };

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100">
              Configure Anti-Invite Links
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Blocks unauthorized discord.gg / discord.com invite links.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Allowed Server Whitelist</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addWhitelist()}
                  placeholder="e.g. partner-server-code"
                  className="h-8 bg-zinc-900 border-zinc-800 text-xs"
                />
                <Button size="sm" type="button" onClick={addWhitelist} className="h-8 px-2.5">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                {rule.allowedInvites.map((inv) => (
                  <span
                    key={inv}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-300 border border-zinc-800"
                  >
                    {inv}
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          antiInvites: {
                            ...prev.antiInvites,
                            allowedInvites: prev.antiInvites.allowedInvites.filter((i) => i !== inv),
                          },
                        }))
                      }
                      className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Action</Label>
                <select
                  value={rule.action}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      antiInvites: { ...prev.antiInvites, action: e.target.value as any },
                    }))
                  }
                  className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  <option value="DELETE">Delete Message</option>
                  <option value="TIMEOUT">Delete &amp; Timeout</option>
                  <option value="WARN">Warn Only</option>
                </select>
              </div>

              {rule.action === "TIMEOUT" && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Timeout Length</Label>
                  <select
                    value={String(rule.timeoutSeconds)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        antiInvites: { ...prev.antiInvites, timeoutSeconds: Number(e.target.value) },
                      }))
                    }
                    className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                  >
                    <option value="300">5 Minutes</option>
                    <option value="600">10 Minutes</option>
                    <option value="3600">1 Hour</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-xl">
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (ruleKey === "badWords") {
    const rule = config.badWords;
    const addWord = () => {
      const trimmed = tagInput.trim().toLowerCase();
      if (!trimmed) return;
      if (!rule.words.includes(trimmed)) {
        setConfig((prev) => ({
          ...prev,
          badWords: { ...prev.badWords, words: [...prev.badWords.words, trimmed] },
        }));
      }
      setTagInput("");
    };

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100">
              Configure Banned Words &amp; Slurs
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Filters disallowed words, toxic language, and scam phrasing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Banned Words List</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addWord()}
                  placeholder="Type word and press Enter..."
                  className="h-8 bg-zinc-900 border-zinc-800 text-xs"
                />
                <Button size="sm" type="button" onClick={addWord} className="h-8 px-2.5">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                {rule.words.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  >
                    {w}
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          badWords: {
                            ...prev.badWords,
                            words: prev.badWords.words.filter((word) => word !== w),
                          },
                        }))
                      }
                      className="text-zinc-500 hover:text-rose-300 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Action</Label>
                <select
                  value={rule.action}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      badWords: { ...prev.badWords, action: e.target.value as any },
                    }))
                  }
                  className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  <option value="DELETE">Delete Message</option>
                  <option value="TIMEOUT">Delete &amp; Timeout</option>
                  <option value="WARN">Warn Only</option>
                </select>
              </div>

              {rule.action === "TIMEOUT" && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Timeout Length</Label>
                  <select
                    value={String(rule.timeoutSeconds)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        badWords: { ...prev.badWords, timeoutSeconds: Number(e.target.value) },
                      }))
                    }
                    className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                  >
                    <option value="300">5 Minutes</option>
                    <option value="600">10 Minutes</option>
                    <option value="3600">1 Hour</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-xl">
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (ruleKey === "massMentions") {
    const rule = config.massMentions;
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100">
              Configure Mention Spam
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Prevents mass user and role pings in a single message.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Max Mentions Allowed</Label>
              <Input
                type="number"
                min={2}
                max={20}
                value={rule.maxMentions}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    massMentions: { ...prev.massMentions, maxMentions: Number(e.target.value) || 4 },
                  }))
                }
                className="h-9 bg-zinc-900 border-zinc-800 text-xs font-mono text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Action</Label>
                <select
                  value={rule.action}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      massMentions: { ...prev.massMentions, action: e.target.value as any },
                    }))
                  }
                  className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                >
                  <option value="TIMEOUT">Timeout Member</option>
                  <option value="DELETE">Delete Message</option>
                </select>
              </div>

              {rule.action === "TIMEOUT" && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Timeout Length</Label>
                  <select
                    value={String(rule.timeoutSeconds)}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        massMentions: { ...prev.massMentions, timeoutSeconds: Number(e.target.value) },
                      }))
                    }
                    className="w-full h-9 px-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100"
                  >
                    <option value="300">5 Minutes</option>
                    <option value="600">10 Minutes</option>
                    <option value="3600">1 Hour</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-xl">
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Fallback for custom rule or caps
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-mono font-bold tracking-wider uppercase text-zinc-100">
            Configure Rule
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Update parameters and enforcement action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-zinc-400">
            This rule is active and enforcing server chat safety policies.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs rounded-xl">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
