"use client";

import * as React from "react";
import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Save,
  MousePointerClick,
  Send,
  Sparkles,
  Sliders,
  ChevronDown,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Hash,
  AtSign,
  Pencil,
  Check,
  ArrowLeft,
  Smile,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, ProBadge, ModuleToggle } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { EmojiPicker, parseDiscordCustomEmoji } from "@/components/ui/emoji-picker";
import { DiscordChatPreview } from "@/components/discord/discord-chat-preview";
import { cn } from "@/lib/utils";
import type { LiveDiscordChannel, LiveDiscordRole, LiveDiscordEmoji } from "../welcome/welcome-types";
import type {
  RolePanel,
  RolePanelOption,
  RolePanelsConfig,
  RoleButtonStyle,
} from "@/lib/roles-types";
import {
  saveRolePanelsAction,
  publishRolePanelAction,
  deleteRolePanelAction,
} from "@/app/actions";

interface RolesViewProps {
  tenantId: string;
  guildId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  channels: LiveDiscordChannel[];
  roles: LiveDiscordRole[];
  emojis?: LiveDiscordEmoji[];
  botName: string;
  botAvatarUrl: string | null;
  initialConfig: RolePanelsConfig;
}

const PLAN_PANEL_LIMITS: Record<"FREE" | "PRO" | "ENTERPRISE", number> = {
  FREE: 2,
  PRO: 10,
  ENTERPRISE: 100,
};

const PRESET_COLORS = [
  { label: "Blurple", value: "#5865F2" },
  { label: "Emerald", value: "#22C55E" },
  { label: "Ruby", value: "#EF4444" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Sky", value: "#3B82F6" },
  { label: "Midnight", value: "#1E1F22" },
];

export function RolesView({
  tenantId,
  guildId,
  currentPlan = "FREE",
  channels,
  roles: discordRoles,
  emojis = [],
  botName,
  botAvatarUrl,
  initialConfig,
}: RolesViewProps) {
  const [config, setConfig] = useState<RolePanelsConfig>(initialConfig);

  const [selectedPanelId, setSelectedPanelId] = useState<string>(
    initialConfig.panels[0]?.id || "",
  );
  const [viewMode, setViewMode] = useState<"LIST" | "EDIT">("LIST");

  const [isPending, startTransition] = useTransition();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  // Helper to render either Discord custom emoji or Unicode emoji
  const renderEmoji = (emojiStr?: string) => {
    if (!emojiStr) return null;
    const custom = parseDiscordCustomEmoji(emojiStr);
    if (custom) {
      return (
        <img
          src={`https://cdn.discordapp.com/emojis/${custom.id}.${custom.animated ? "gif" : "png"}?size=32`}
          alt={custom.name}
          className="h-4 w-4 inline-block object-contain align-middle"
        />
      );
    }
    return <span>{emojiStr}</span>;
  };

  // New Role Form State (inside panel builder)
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [newRoleId, setNewRoleId] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newEmoji, setNewEmoji] = useState<string>("");
  const [newStyle, setNewStyle] = useState<RoleButtonStyle>("primary");
  const [newDescription, setNewDescription] = useState<string>("");

  const activePanel = config.panels.find((p) => p.id === selectedPanelId) || config.panels[0];

  const maxPanels = PLAN_PANEL_LIMITS[currentPlan] ?? 2;
  const isLimitReached = config.panels.length >= maxPanels;

  // Clean Discord channels for SearchableSelect options (fixes double ## bug)
  const channelOptions: SearchableOption[] = useMemo(() => {
    return channels.map((ch) => {
      const cleanName = ch.name.replace(/^#+/, "");
      return {
        value: ch.id,
        label: cleanName,
        icon: <Hash className="h-3.5 w-3.5" />,
      };
    });
  }, [channels]);

  // Clean Discord roles for SearchableSelect options (preventing duplicate role selections)
  const roleOptions: SearchableOption[] = useMemo(() => {
    const configuredRoleIds = new Set(
      activePanel?.options
        .filter((o) => o.id !== editingOptionId)
        .map((o) => o.roleId) || [],
    );
    return discordRoles.map((r) => {
      const isAlreadyAdded = configuredRoleIds.has(r.id);
      return {
        value: r.id,
        label: isAlreadyAdded ? `${r.name} (Already in panel)` : r.name,
        icon: <AtSign className="h-3.5 w-3.5" style={{ color: r.color }} />,
      };
    });
  }, [discordRoles, activePanel?.options, editingOptionId]);

  // Helper to update active panel fields
  const updateActivePanel = (updater: (prev: RolePanel) => RolePanel) => {
    if (!activePanel) return;
    const updated = updater(activePanel);
    setConfig((prev) => ({
      ...prev,
      panels: prev.panels.map((p) => (p.id === activePanel.id ? updated : p)),
    }));
  };

  const handleCreatePanel = () => {
    if (isLimitReached) {
      setBanner({
        type: "error",
        message: `Plan limit reached: The ${currentPlan === "FREE" ? "Free" : currentPlan} plan allows up to ${maxPanels} role panels. Please upgrade to unlock more panels.`,
      });
      return;
    }

    const newId = `panel-${Date.now()}`;
    const newPanel: RolePanel = {
      id: newId,
      name: `Role Panel #${config.panels.length + 1}`,
      description: "Members can self-assign roles",
      channelId: channels[0]?.id || "",
      channelName: channels[0]?.name ? channels[0].name.replace(/^#+/, "") : "",
      type: "BUTTON",
      mode: "MULTI",
      embed: {
        title: "Server Roles",
        description: "Select the roles you wish to claim from the options below.",
        color: "#5865F2",
        footerText: "⚡ Darklin3 Bot",
        showTimestamp: true,
      },
      options: [],
      status: "DRAFT",
    };

    setConfig((prev) => ({
      ...prev,
      panels: [...prev.panels, newPanel],
    }));
    setSelectedPanelId(newId);
    setViewMode("EDIT");
  };

  // Custom Delete Confirmation Modal State
  const [panelToDelete, setPanelToDelete] = useState<RolePanel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePanel = (panelId: string) => {
    const target = config.panels.find((p) => p.id === panelId);
    if (!target) return;
    setPanelToDelete(target);
  };

  const handleConfirmDelete = async () => {
    if (!panelToDelete) return;
    setIsDeleting(true);
    const targetId = panelToDelete.id;
    const hasLiveDiscordMessage = Boolean(panelToDelete.messageId && panelToDelete.channelId);

    const res = await deleteRolePanelAction(
      tenantId,
      guildId,
      targetId,
      panelToDelete.channelId,
      panelToDelete.messageId,
    );

    setIsDeleting(false);
    setPanelToDelete(null);

    if (res.ok) {
      setConfig((prev) => {
        const remaining = prev.panels.filter((p) => p.id !== targetId);
        return { ...prev, panels: remaining };
      });
      const remaining = config.panels.filter((p) => p.id !== targetId);
      setSelectedPanelId(remaining[0]?.id || "");
      setViewMode("LIST");
      setBanner({
        type: "success",
        message: hasLiveDiscordMessage
          ? `Role panel "${panelToDelete.name || "Panel"}" and its live Discord message were removed successfully!`
          : `Role panel "${panelToDelete.name || "Panel"}" deleted successfully!`,
      });
    } else {
      setBanner({ type: "error", message: res.error || "Failed to delete panel" });
    }
  };

  const handleSaveOption = () => {
    if (!activePanel) return;
    if (!editingOptionId && activePanel.options.length >= 25) {
      setBanner({ type: "error", message: "Discord limits maximum 25 roles per panel." });
      return;
    }

    const selectedRole = discordRoles.find((r) => r.id === newRoleId);
    if (!selectedRole && !newRoleId) {
      setBanner({ type: "error", message: "Please select a Discord role." });
      return;
    }

    const targetRoleId = selectedRole?.id || newRoleId;
    const roleName = selectedRole?.name || newRoleId;

    // Duplicate check: Prevent adding the same role twice in the same panel
    const alreadyExists = activePanel.options.some(
      (o) => o.roleId === targetRoleId && o.id !== editingOptionId,
    );
    if (alreadyExists) {
      setBanner({
        type: "error",
        message: `The role "${roleName}" is already added to this panel. You cannot add the same role twice.`,
      });
      return;
    }

    const label = newLabel.trim();
    const emoji = newEmoji.trim();

    // Validation: A button must have at least a label OR an emoji
    if (!label && !emoji) {
      setBanner({
        type: "error",
        message: "Please enter a Button Label or select an Emoji. A button cannot be completely blank.",
      });
      return;
    }

    if (editingOptionId) {
      // UPDATE existing option
      updateActivePanel((prev) => ({
        ...prev,
        options: prev.options.map((o) =>
          o.id === editingOptionId
            ? {
                ...o,
                roleId: targetRoleId,
                roleName,
                roleColor: selectedRole?.color,
                label,
                emoji: emoji || undefined,
                style: newStyle,
                description: newDescription.trim() || undefined,
              }
            : o,
        ),
      }));
      setEditingOptionId(null);
      setBanner({ type: "success", message: `Updated "${label || roleName}" option successfully!` });
    } else {
      // ADD new option
      const newOption: RolePanelOption = {
        id: `opt-${Date.now()}`,
        roleId: targetRoleId,
        roleName,
        roleColor: selectedRole?.color,
        label,
        emoji: emoji || undefined,
        style: newStyle,
        description: newDescription.trim() || undefined,
      };

      updateActivePanel((prev) => ({
        ...prev,
        options: [...prev.options, newOption],
      }));
    }

    // Reset form fields
    setNewRoleId("");
    setNewLabel("");
    setNewEmoji("");
    setNewDescription("");
  };

  const handleStartEdit = (option: RolePanelOption) => {
    setEditingOptionId(option.id);
    setNewRoleId(option.roleId);
    setNewLabel(option.label);
    setNewEmoji(option.emoji || "");
    setNewStyle(option.style);
    setNewDescription(option.description || "");
    setBanner(null);
  };

  const handleCancelEdit = () => {
    setEditingOptionId(null);
    setNewRoleId("");
    setNewLabel("");
    setNewEmoji("");
    setNewDescription("");
  };

  const handleRemoveRoleOption = (optionId: string) => {
    if (editingOptionId === optionId) {
      handleCancelEdit();
    }
    updateActivePanel((prev) => ({
      ...prev,
      options: prev.options.filter((o) => o.id !== optionId),
    }));
  };

  const handleSaveConfig = () => {
    startTransition(async () => {
      const res = await saveRolePanelsAction(tenantId, guildId, config);
      if (res.ok) {
        setBanner({ type: "success", message: "Role panels configuration saved successfully!" });
      } else {
        setBanner({ type: "error", message: res.error || "Failed to save configuration" });
      }
    });
  };

  const handlePublishPanel = (panelId: string) => {
    const targetPanel = config.panels.find((p) => p.id === panelId);
    if (!targetPanel) return;

    if (!targetPanel.channelId) {
      setBanner({
        type: "error",
        message: `Please select a destination Discord channel for "${targetPanel.name}" before publishing.`,
      });
      return;
    }

    if (targetPanel.options.length === 0) {
      setBanner({
        type: "error",
        message: `Please add at least one role button or menu option to "${targetPanel.name}" before publishing.`,
      });
      return;
    }

    setPublishingId(panelId);
    startTransition(async () => {
      // 1. Save config first
      await saveRolePanelsAction(tenantId, guildId, config);

      // 2. Publish to Discord
      const res = await publishRolePanelAction(tenantId, guildId, panelId);
      setPublishingId(null);

      if (res.ok) {
        setConfig((prev) => ({
          ...prev,
          panels: prev.panels.map((p) =>
            p.id === panelId
              ? {
                  ...p,
                  status: "PUBLISHED",
                  publishedAt: new Date().toISOString(),
                  messageId: res.messageId,
                  lastError: undefined,
                }
              : p,
          ),
        }));
        setBanner({
          type: "success",
          message: `Role panel "${targetPanel.name}" published to Discord channel successfully!`,
        });
      } else {
        setConfig((prev) => ({
          ...prev,
          panels: prev.panels.map((p) =>
            p.id === panelId
              ? {
                  ...p,
                  status: "ERROR",
                  lastError: res.error,
                }
              : p,
          ),
        }));
        setBanner({
          type: "error",
          message: res.error || "Failed to publish panel to Discord channel.",
        });
      }
    });
  };

  const totalRoles = config.panels.reduce((acc, p) => acc + p.options.length, 0);

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      {banner && (
        <FeedbackBanner
          type={banner.type}
          message={banner.message}
          onDismiss={() => setBanner(null)}
        />
      )}

      {viewMode === "LIST" ? (
        /* ========================================================================= */
        /* VIEW 1: PANELS OVERVIEW (CLEAN MASTER LIST)                               */
        /* ========================================================================= */
        <>
          <PageHeader
            category="Interactive Menus"
            title="Reaction & Button Roles"
            description="Create self-assignable role panels using interactive Discord buttons, emoji reactions, or dropdown select menus."
            badges={[
              <Badge key="count" variant="default" className="text-xs">
                {config.panels.length} / {currentPlan === "ENTERPRISE" ? "∞" : maxPanels} Panels
              </Badge>,
              <Badge key="roles" variant="outline" className="text-xs">
                {totalRoles} Configured Roles
              </Badge>,
              currentPlan !== "FREE" ? (
                <ProBadge key="plan" label={currentPlan} />
              ) : (
                <Badge key="plan" variant="outline" className="font-mono text-[10px]">
                  FREE
                </Badge>
              ),
            ].filter(Boolean)}
            actions={
              <div className="flex items-center gap-2.5">
                <ModuleToggle
                  enabled={config.enabled ?? true}
                  onToggle={(checked) => {
                    setConfig((prev) => ({ ...prev, enabled: checked }));
                    startTransition(async () => {
                      const res = await saveRolePanelsAction(tenantId, guildId, {
                        ...config,
                        enabled: checked,
                      });
                      if (res.ok) {
                        setBanner({
                          type: "success",
                          message: checked
                            ? "Role Selection module activated!"
                            : "Role Selection module paused.",
                        });
                      }
                    });
                  }}
                  activeLabel="Active"
                  disabledLabel="Paused"
                />
                <Button
                  onClick={handleCreatePanel}
                  disabled={isLimitReached}
                  size="sm"
                  className="gap-1.5 shadow-2xs h-9 cursor-pointer bg-primary text-primary-foreground font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Panel</span>
                </Button>
              </div>
            }
          />

          {/* Plan Limit Upgrade Notice */}
          {isLimitReached && currentPlan !== "ENTERPRISE" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-500 shadow-xs">
              <div className="flex items-center gap-2.5 text-xs">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  You have reached your <strong>{currentPlan}</strong> plan limit ({config.panels.length}/{maxPanels} panels). Upgrade to {currentPlan === "FREE" ? "Creator Pro (10 panels)" : "Enterprise (Unlimited)"} for expanded capacity.
                </span>
              </div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-500/40 text-amber-500 hover:bg-amber-500/10 cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <Link href={`/tenants/${tenantId}/billing`}>
                  Upgrade Plan &rarr;
                </Link>
              </Button>
            </div>
          )}

          {/* When no panels exist: Clean Empty State */}
          {config.panels.length === 0 ? (
            <Card className="border-dashed border-border bg-muted/10 py-12 text-center">
              <CardContent className="space-y-4 max-w-md mx-auto">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Layers className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-foreground">No Role Panels Configured</h3>
                  <p className="text-xs text-muted-foreground">
                    Create an interactive button or dropdown menu panel to let server members self-assign roles directly inside Discord.
                  </p>
                </div>
                <Button onClick={handleCreatePanel} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Your First Panel</span>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">
                    Configured Role Panels ({config.panels.length} / {currentPlan === "ENTERPRISE" ? "∞" : maxPanels})
                  </h2>
                </div>
              </div>

              <div className="space-y-2">
                {config.panels.map((panel, idx) => {
                  const targetChannel = channels.find((c) => c.id === panel.channelId);
                  const cleanChannelName = targetChannel
                    ? targetChannel.name.replace(/^#+/, "")
                    : panel.channelName
                      ? panel.channelName.replace(/^#+/, "")
                      : null;

                  return (
                    <div
                      key={panel.id}
                      onClick={() => {
                        setSelectedPanelId(panel.id);
                        setViewMode("EDIT");
                      }}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer"
                    >
                      {/* Left: Icon, Name, Type, Channel, Roles count */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-2xs">
                          {panel.type === "BUTTON" ? (
                            <MousePointerClick className="h-4 w-4" />
                          ) : panel.type === "REACTION" ? (
                            <Smile className="h-4 w-4" />
                          ) : (
                            <Sliders className="h-4 w-4" />
                          )}
                        </div>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {panel.name || `Panel #${idx + 1}`}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 h-4.5 font-mono">
                              {panel.type === "BUTTON" ? "Buttons" : panel.type === "REACTION" ? "Reactions" : "Dropdown"}
                            </Badge>
                            <span className="text-muted-foreground text-xs">•</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {panel.options.length} {panel.options.length === 1 ? "role" : "roles"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {cleanChannelName ? (
                              <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                                <Hash className="h-3 w-3 text-muted-foreground/70" />
                                <span>{cleanChannelName}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 font-mono text-[11px] text-amber-500">
                                <Hash className="h-3 w-3 text-amber-500/70" />
                                <span>No channel selected</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Status badge & Actions */}
                      <div
                        className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {panel.status === "PUBLISHED" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-500 border-emerald-500/30 gap-1.5 py-0.5 h-6 font-medium"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live on Discord
                          </Badge>
                        ) : panel.status === "ERROR" ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-rose-500 border-rose-500/30 gap-1 py-0.5 h-6 font-medium"
                          >
                            Error
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[10px] text-muted-foreground py-0.5 h-6 font-medium"
                          >
                            Draft (Unpublished)
                          </Badge>
                        )}

                        <Button
                          onClick={() => handlePublishPanel(panel.id)}
                          disabled={isPending || publishingId === panel.id}
                          size="sm"
                          className="h-8 text-xs gap-1.5 px-2.5 shadow-2xs cursor-pointer bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 transition-colors"
                          title="Publish or update this panel on Discord"
                        >
                          <Send className={cn("h-3 w-3", publishingId === panel.id && "animate-spin")} />
                          <span>
                            {publishingId === panel.id
                              ? "Publishing..."
                              : panel.status === "PUBLISHED"
                                ? "Update"
                                : "Publish"}
                          </span>
                        </Button>

                        <Button
                          onClick={() => {
                            setSelectedPanelId(panel.id);
                            setViewMode("EDIT");
                          }}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5 px-3 shadow-2xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Configure</span>
                        </Button>

                        <Button
                          onClick={() => handleDeletePanel(panel.id)}
                          disabled={isPending}
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          title="Delete this panel"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : activePanel ? (
        /* ========================================================================= */
        /* VIEW 2: DEDICATED PANEL EDITOR (FOCUSED DETAIL VIEW)                      */
        /* ========================================================================= */
        <>
          <PageHeader
            category="Panel Configuration"
            title={activePanel.name}
            badges={[
              <Badge key="type" variant="outline" className="text-xs font-mono">
                {activePanel.type === "BUTTON" ? "Buttons" : activePanel.type === "REACTION" ? "Reactions" : "Dropdown"}
              </Badge>,
              <Badge key="roles" variant="outline" className="text-xs">
                {activePanel.options.length} {activePanel.options.length === 1 ? "Role" : "Roles"}
              </Badge>,
              activePanel.status === "PUBLISHED" ? (
                <Badge
                  key="status"
                  variant="outline"
                  className="text-xs text-emerald-500 border-emerald-500/30 gap-1.5"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live on Discord
                </Badge>
              ) : (
                <Badge key="status" variant="secondary" className="text-xs text-muted-foreground">
                  Draft
                </Badge>
              ),
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode("LIST")}
                  className="gap-1.5 text-xs h-9 cursor-pointer border-border hover:bg-muted font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Panels</span>
                </Button>

                <Button
                  onClick={handleSaveConfig}
                  disabled={isPending}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shadow-2xs h-9 cursor-pointer border-border hover:bg-muted font-medium text-xs"
                >
                  <Save className="h-4 w-4" />
                  <span>Save Draft</span>
                </Button>

                <Button
                  onClick={() => handlePublishPanel(activePanel.id)}
                  disabled={isPending || publishingId === activePanel.id}
                  size="sm"
                  className="gap-1.5 shadow-2xs h-9 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs"
                >
                  <Send className={cn("h-4 w-4", publishingId === activePanel.id && "animate-spin")} />
                  <span>
                    {publishingId === activePanel.id
                      ? "Publishing..."
                      : activePanel.status === "PUBLISHED"
                        ? "Update on Discord"
                        : "Publish to Discord"}
                  </span>
                </Button>

                <Button
                  onClick={() => handleDeletePanel(activePanel.id)}
                  disabled={isPending}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shadow-2xs h-9 cursor-pointer border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-medium text-xs"
                  title="Delete this panel and remove its published message from Discord"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Panel</span>
                </Button>
              </div>
            }
          />

          {/* Active Role Panel Builder */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Panel Configuration Form (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* 1. Panel Settings */}
              <Card className="border-border/80 shadow-2xs">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Panel Setup &amp; Target Destination
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Configure which channel this role panel targets and how it behaves.
                    </CardDescription>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePanel(activePanel.id)}
                    className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 text-xs gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Panel</span>
                  </Button>
                </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Panel Name</Label>
                    <Input
                      value={activePanel.name}
                      onChange={(e) =>
                        updateActivePanel((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Gaming Roles"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Destination Discord Channel</Label>
                    <SearchableSelect
                      options={channelOptions}
                      value={activePanel.channelId}
                      onChange={(val) => {
                        const ch = channels.find((c) => c.id === val);
                        updateActivePanel((prev) => ({
                          ...prev,
                          channelId: val,
                          channelName: ch?.name ? ch.name.replace(/^#+/, "") : "",
                        }));
                      }}
                      placeholder="Select Discord Channel..."
                      searchPlaceholder="Search channel (e.g. roles, general)..."
                      emptyMessage="No Discord channels match your search"
                    />
                  </div>
                </div>

                <Separator />

                {/* Component Type Switcher (Buttons vs Reactions vs Dropdown) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => updateActivePanel((prev) => ({ ...prev, type: "BUTTON" }))}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activePanel.type === "BUTTON"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/80 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-foreground">🔘 Button Roles</span>
                      {activePanel.type === "BUTTON" && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Members click dedicated colored buttons to toggle roles instantly.
                    </p>
                  </div>

                  <div
                    onClick={() => updateActivePanel((prev) => ({ ...prev, type: "REACTION" }))}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activePanel.type === "REACTION"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/80 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-foreground">😃 Emoji Reactions</span>
                      {activePanel.type === "REACTION" && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Classic Discord reaction emojis appear beneath the message card.
                    </p>
                  </div>

                  <div
                    onClick={() => updateActivePanel((prev) => ({ ...prev, type: "DROPDOWN" }))}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activePanel.type === "DROPDOWN"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/80 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-foreground">
                        📋 Select Menu
                      </span>
                      {activePanel.type === "DROPDOWN" && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Compact String Select Menu ideal for rosters with 10+ roles.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Selection Mode Switcher */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        Exclusive Role Selection (Single Role)
                      </span>
                      <Badge variant="default" className="text-[9px] px-1 py-0">
                        MODE
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      When enabled, choosing a new role automatically strips other roles from this panel.
                    </span>
                  </div>
                  <Switch
                    checked={activePanel.mode === "EXCLUSIVE"}
                    onCheckedChange={(checked) =>
                      updateActivePanel((prev) => ({
                        ...prev,
                        mode: checked ? "EXCLUSIVE" : "MULTI",
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* 2. Discord Embed Customizer */}
            <Card className="border-border/80 shadow-2xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Embed Presentation &amp; Styling
                </CardTitle>
                <CardDescription className="text-xs">
                  Customize how the role selection message looks inside Discord.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Embed Header Title</Label>
                  <Input
                    value={activePanel.embed.title}
                    onChange={(e) =>
                      updateActivePanel((prev) => ({
                        ...prev,
                        embed: { ...prev.embed, title: e.target.value },
                      }))
                    }
                    placeholder="Choose Your Roles"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Embed Description</Label>
                  <textarea
                    value={activePanel.embed.description}
                    onChange={(e) =>
                      updateActivePanel((prev) => ({
                        ...prev,
                        embed: { ...prev.embed, description: e.target.value },
                      }))
                    }
                    rows={2}
                    placeholder="Click buttons below to assign roles to your profile..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Embed Border Color</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      value={activePanel.embed.color}
                      onChange={(e) =>
                        updateActivePanel((prev) => ({
                          ...prev,
                          embed: { ...prev.embed, color: e.target.value },
                        }))
                      }
                      className="w-32 text-xs font-mono"
                    />
                    <div className="flex items-center gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() =>
                            updateActivePanel((prev) => ({
                              ...prev,
                              embed: { ...prev.embed, color: c.value },
                            }))
                          }
                          title={c.label}
                          className={`h-6 w-6 rounded-md border transition-transform cursor-pointer hover:scale-110 ${
                            activePanel.embed.color.toLowerCase() === c.value.toLowerCase()
                              ? "ring-2 ring-primary ring-offset-1"
                              : "border-border"
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Add or Edit Role Option */}
            <Card className={`border-border transition-colors ${editingOptionId ? "ring-1 ring-amber-500/50 border-amber-500/40 bg-amber-500/5" : ""}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {editingOptionId ? (
                      <>
                        <Pencil className="h-4 w-4 text-amber-500" />
                        Edit Role Option
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-primary" />
                        Add Role to this Panel
                      </>
                    )}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {activePanel.options.length} / 25 Max
                  </Badge>
                </CardTitle>
                {editingOptionId && (
                  <CardDescription className="text-xs text-amber-500/90 font-medium">
                    Modifying existing role option. Click &quot;Update Option&quot; to apply your changes.
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Discord Role</Label>
                    <SearchableSelect
                      options={roleOptions}
                      value={newRoleId}
                      onChange={(val) => {
                        setNewRoleId(val);
                      }}
                      placeholder="Select Discord Role..."
                      searchPlaceholder="Search role (e.g. VIP, Member)..."
                      emptyMessage="No Discord roles match your search"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Button / Item Label{" "}
                      <span className="text-muted-foreground font-normal text-[11px]">
                        (Optional if emoji is set)
                      </span>
                    </Label>
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder={newEmoji ? "Optional (Leave blank for emoji-only)" : "Gaming Squad"}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Emoji (Optional)</Label>
                    <EmojiPicker
                      value={newEmoji}
                      onChange={setNewEmoji}
                      customEmojis={emojis}
                      placeholder="Pick an emoji..."
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Button Color Style</Label>
                    <select
                      value={newStyle}
                      onChange={(e) => setNewStyle(e.target.value as RoleButtonStyle)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="primary">Blurple (Primary)</option>
                      <option value="secondary">Grey (Secondary)</option>
                      <option value="success">Green (Success)</option>
                      <option value="danger">Red (Danger)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Dropdown Description</Label>
                    <Input
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="For gaming pings"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveOption}
                    className="gap-1.5 text-xs w-full sm:w-auto"
                  >
                    {editingOptionId ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Update Option</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Option to Panel</span>
                      </>
                    )}
                  </Button>
                  {editingOptionId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 4. Configured Role Items */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Configured Roles ({activePanel.options.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activePanel.options.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No roles added to this panel yet. Add your first role using the form above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activePanel.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-colors ${
                          editingOptionId === opt.id
                            ? "border-amber-500/50 bg-amber-500/10"
                            : "border-border/60 bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          {renderEmoji(opt.emoji)}
                          {opt.label ? (
                            <span className="font-semibold text-foreground">{opt.label}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px] font-mono">
                              (Emoji-only)
                            </span>
                          )}
                          <span className="text-muted-foreground font-mono">
                            → {opt.roleName}
                          </span>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {opt.style}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Edit this role option"
                            className={`h-7 w-7 p-0 cursor-pointer ${
                              editingOptionId === opt.id
                                ? "text-amber-500 bg-amber-500/20"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => handleStartEdit(opt)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Delete option"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                            onClick={() => handleRemoveRoleOption(opt.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Authentic Discord Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4 sticky top-6">
            <DiscordChatPreview
              channelName={(() => {
                const ch = channels.find((c) => c.id === activePanel.channelId);
                const raw = ch?.name || activePanel.channelName;
                return raw ? raw.replace(/^#+/, "") : "reaction-roles";
              })()}
              botName={botName}
              botAvatarUrl={botAvatarUrl}
              headerRightSlot={
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  {activePanel.type} PREVIEW
                </Badge>
              }
            >

                  {/* Embed Card */}
                  <div
                    className="rounded-lg bg-[#2b2d31] p-3.5 space-y-2 border-l-[4px] shadow-xs"
                    style={{ borderLeftColor: activePanel.embed.color || "#5865F2" }}
                  >
                    <h4 className="text-sm font-bold text-white">
                      {activePanel.embed.title || "Choose Your Roles"}
                    </h4>
                    <p className="text-xs text-[#dbdee1] leading-relaxed whitespace-pre-wrap">
                      {activePanel.embed.description ||
                        "Click the buttons below to toggle your roles."}
                    </p>
                    {activePanel.embed.footerText && (
                      <div className="pt-2 text-[10px] text-[#949ba4] border-t border-[#3f4147] flex items-center justify-between">
                        <span>{activePanel.embed.footerText}</span>
                        {activePanel.embed.showTimestamp && <span>Today at 10:15 AM</span>}
                      </div>
                    )}
                  </div>

                  {/* Action Row Components (Buttons vs Select Menu vs Reactions) */}
                  {activePanel.type === "BUTTON" ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activePanel.options.length === 0 ? (
                        <span className="text-xs text-[#949ba4] italic">
                          No buttons configured yet.
                        </span>
                      ) : (
                        activePanel.options.map((opt) => {
                          let bg = "bg-[#4e5058] hover:bg-[#6d6f78] text-white";
                          if (opt.style === "primary")
                            bg = "bg-[#5865f2] hover:bg-[#4752c4] text-white";
                          if (opt.style === "success")
                            bg = "bg-[#248046] hover:bg-[#1a6334] text-white";
                          if (opt.style === "danger")
                            bg = "bg-[#da373c] hover:bg-[#a12828] text-white";

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold shadow-xs transition-colors cursor-pointer ${bg} ${
                                !opt.label ? "min-w-[40px]" : ""
                              }`}
                            >
                              {renderEmoji(opt.emoji)}
                              {opt.label && <span>{opt.label}</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : activePanel.type === "DROPDOWN" ? (
                    /* Dropdown Select Menu */
                    <div className="pt-1">
                      <div className="w-full rounded-sm bg-[#1e1f22] border border-[#3f4147] p-2.5 flex items-center justify-between text-xs text-[#dbdee1] cursor-pointer hover:border-[#5865f2]">
                        <span>{activePanel.description || "Choose your roles..."}</span>
                        <ChevronDown className="h-4 w-4 text-[#949ba4]" />
                      </div>
                      {activePanel.options.length > 0 && (
                        <div className="mt-1 rounded-sm bg-[#2b2d31] border border-[#3f4147] p-1.5 space-y-1 shadow-md">
                          {activePanel.options.slice(0, 4).map((opt) => (
                            <div
                              key={opt.id}
                              className="px-2 py-1.5 rounded text-xs hover:bg-[#35373c] flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                {renderEmoji(opt.emoji)}
                                <span className="font-semibold text-white">
                                  {opt.label || opt.roleName}
                                </span>
                              </div>
                              <span className="text-[10px] text-[#949ba4] font-mono">
                                {opt.roleName}
                              </span>
                            </div>
                          ))}
                          {activePanel.options.length > 4 && (
                            <div className="text-[10px] text-center text-[#949ba4] py-0.5">
                              + {activePanel.options.length - 4} more options in menu
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Emoji Reaction Role Bubbles */
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activePanel.options.length === 0 ? (
                        <span className="text-xs text-[#949ba4] italic">
                          No reaction emojis configured yet.
                        </span>
                      ) : (
                        activePanel.options.map((opt) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] border border-[#3f4147] text-xs cursor-pointer transition-colors"
                          >
                            <span>{renderEmoji(opt.emoji) || "⭐"}</span>
                            <span className="text-[11px] font-semibold text-[#b5bac1]">1</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
            </DiscordChatPreview>

            <div className="p-3 rounded-lg border border-border/60 bg-card/40 text-[11px] text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Bot hierarchy checked on click
              </span>
              <span>
                Target:{" "}
                <strong className="text-foreground">
                  {(() => {
                    const ch = channels.find((c) => c.id === activePanel.channelId);
                    const raw = ch?.name || activePanel.channelName;
                    return raw ? `#${raw.replace(/^#+/, "")}` : "Not Set";
                  })()}
                </strong>
              </span>
            </div>
          </div>
        </div>
        </>
      ) : null}

      {/* Premium Darklin3 Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(panelToDelete)}
        onOpenChange={(open) => !open && !isDeleting && setPanelToDelete(null)}
        title={`Delete "${panelToDelete?.name || "Role Panel"}"?`}
        description="Are you sure you want to permanently delete this role panel? This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete Panel"}
        cancelLabel="Keep Panel"
        isLoading={isDeleting}
        additionalNotice={
          panelToDelete?.messageId && panelToDelete?.channelId ? (
            <div className="flex items-start gap-2.5">
              <Radio className="h-4 w-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <span className="font-semibold text-rose-300 block text-xs">
                  Discord Clean-up Active
                </span>
                <span className="text-[11px] text-zinc-300/90 block leading-relaxed">
                  This panel is currently live in Discord. Deleting it will automatically
                  purge the published embed and interactive buttons/reactions from your channel.
                </span>
              </div>
            </div>
          ) : null
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
