"use client";

import * as React from "react";
import { useState, useTransition } from "react";
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
  Sliders,
  Send,
  Sparkles,
  ChevronDown,
  Layers,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, ProBadge } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";
import type { LiveDiscordChannel, LiveDiscordRole } from "../welcome/welcome-types";
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
  botName,
  botAvatarUrl,
  initialConfig,
}: RolesViewProps) {
  const [config, setConfig] = useState<RolePanelsConfig>(initialConfig);

  const [selectedPanelId, setSelectedPanelId] = useState<string>(
    initialConfig.panels[0]?.id || "",
  );

  const [isPending, startTransition] = useTransition();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  // New Role Form State (inside panel builder)
  const [newRoleId, setNewRoleId] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const [newEmoji, setNewEmoji] = useState<string>("🎮");
  const [newStyle, setNewStyle] = useState<RoleButtonStyle>("primary");
  const [newDescription, setNewDescription] = useState<string>("");

  const activePanel = config.panels.find((p) => p.id === selectedPanelId) || config.panels[0];

  const maxPanels = PLAN_PANEL_LIMITS[currentPlan] ?? 2;
  const isLimitReached = config.panels.length >= maxPanels;

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
      channelName: channels[0]?.name || "",
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
  };

  const handleDeletePanel = async (panelId: string) => {
    startTransition(async () => {
      const res = await deleteRolePanelAction(tenantId, guildId, panelId);
      if (res.ok) {
        setConfig((prev) => {
          const remaining = prev.panels.filter((p) => p.id !== panelId);
          return { ...prev, panels: remaining };
        });
        const remaining = config.panels.filter((p) => p.id !== panelId);
        setSelectedPanelId(remaining[0]?.id || "");
        setBanner({ type: "success", message: "Panel deleted successfully!" });
      } else {
        setBanner({ type: "error", message: res.error || "Failed to delete panel" });
      }
    });
  };

  const handleAddRoleOption = () => {
    if (!activePanel) return;
    if (activePanel.options.length >= 25) {
      setBanner({ type: "error", message: "Discord limits maximum 25 roles per panel." });
      return;
    }

    const selectedRole = discordRoles.find((r) => r.id === newRoleId);
    if (!selectedRole && !newRoleId) {
      setBanner({ type: "error", message: "Please select a Discord role." });
      return;
    }

    const roleName = selectedRole?.name || newRoleId;
    const label = newLabel.trim() || roleName.replace(/^@/, "");

    const newOption: RolePanelOption = {
      id: `opt-${Date.now()}`,
      roleId: selectedRole?.id || newRoleId,
      roleName: roleName,
      roleColor: selectedRole?.color,
      label,
      emoji: newEmoji.trim() || undefined,
      style: newStyle,
      description: newDescription.trim() || undefined,
    };

    updateActivePanel((prev) => ({
      ...prev,
      options: [...prev.options, newOption],
    }));

    setNewLabel("");
    setNewEmoji("🎮");
    setNewDescription("");
  };

  const handleRemoveRoleOption = (optionId: string) => {
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
    setPublishingId(panelId);
    startTransition(async () => {
      // 1. Save config first
      await saveRolePanelsAction(tenantId, guildId, config);

      // 2. Publish to Discord
      const res = await publishRolePanelAction(tenantId, guildId, panelId);
      setPublishingId(null);

      if (res.ok) {
        updateActivePanel((prev) => ({
          ...prev,
          status: "PUBLISHED",
          publishedAt: new Date().toISOString(),
          messageId: res.messageId,
          lastError: undefined,
        }));
        setBanner({
          type: "success",
          message: "Role panel published to Discord channel successfully!",
        });
      } else {
        updateActivePanel((prev) => ({
          ...prev,
          status: "ERROR",
          lastError: res.error,
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
      <PageHeader
        category="Interactive Menus"
        title="Button & Dropdown Roles"
        description="Design multi-panel Discord buttons and dropdown menus allowing server members to self-assign roles with automated hierarchy verification."
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
        backHref={`/tenants/${tenantId}/guilds/${guildId}`}
        backLabel="Server Overview"
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveConfig}
              disabled={isPending}
              variant="outline"
              size="sm"
              className="gap-2 shadow-2xs h-9 cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </Button>
            {activePanel && (
              <Button
                onClick={() => handlePublishPanel(activePanel.id)}
                disabled={isPending || publishingId === activePanel.id}
                size="sm"
                className="gap-2 shadow-2xs h-9 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                <span>
                  {publishingId === activePanel.id
                    ? "Publishing..."
                    : activePanel.status === "PUBLISHED"
                      ? "Update on Discord"
                      : "Publish to Discord"}
                </span>
              </Button>
            )}
          </div>
        }
      />

      {banner && (
        <FeedbackBanner
          type={banner.type}
          message={banner.message}
          onDismiss={() => setBanner(null)}
        />
      )}

      {/* Sleek Active Panel Selector Bar */}
      {config.panels.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-card/60 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Active Role Panel ({config.panels.length} / {currentPlan === "ENTERPRISE" ? "∞" : maxPanels})
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={activePanel?.id || selectedPanelId}
                  onChange={(e) => setSelectedPanelId(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer min-w-[220px]"
                >
                  {config.panels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === "BUTTON" ? "Buttons" : "Dropdown"} • {p.options.length} roles)
                    </option>
                  ))}
                </select>

                {activePanel?.status === "PUBLISHED" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-emerald-500 border-emerald-500/30 gap-1 py-0.5 h-6 font-medium"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live on Discord
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] text-muted-foreground py-0.5 h-6">
                    Draft (Unpublished)
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              onClick={handleCreatePanel}
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-8 shadow-2xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New Panel</span>
            </Button>
          </div>
        </div>
      )}

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
      ) : activePanel ? (
        /* Active Role Panel Builder */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Panel Configuration Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Panel Settings */}
            <Card className="border-border/80 shadow-2xs">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" />
                    Panel Setup & Target Destination
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
                    <select
                      value={activePanel.channelId}
                      onChange={(e) => {
                        const ch = channels.find((c) => c.id === e.target.value);
                        updateActivePanel((prev) => ({
                          ...prev,
                          channelId: e.target.value,
                          channelName: ch?.name || "",
                        }));
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                    >
                      <option value="">Select Discord Channel...</option>
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Separator />

                {/* Component Type Switcher (Buttons vs Dropdown) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    onClick={() => updateActivePanel((prev) => ({ ...prev, type: "DROPDOWN" }))}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activePanel.type === "DROPDOWN"
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border/80 bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-foreground">
                        🔽 Dropdown Menu
                      </span>
                      {activePanel.type === "DROPDOWN" && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Compact String Select Menu ideal for large role categories.
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
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Embed Presentation & Styling
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

            {/* 3. Add Role Option */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-primary" />
                    Add Role to this Panel
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {activePanel.options.length} / 25 Max
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Discord Role</Label>
                    <select
                      value={newRoleId}
                      onChange={(e) => {
                        setNewRoleId(e.target.value);
                        const role = discordRoles.find((r) => r.id === e.target.value);
                        if (role && !newLabel) {
                          setNewLabel(role.name.replace(/^@/, ""));
                        }
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                    >
                      <option value="">Select Discord Role...</option>
                      {discordRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Button / Item Label</Label>
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Gaming Squad"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Emoji (Optional)</Label>
                    <Input
                      value={newEmoji}
                      onChange={(e) => setNewEmoji(e.target.value)}
                      placeholder="🎮"
                      className="text-xs text-center font-mono"
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

                <Button
                  size="sm"
                  onClick={handleAddRoleOption}
                  className="gap-1.5 text-xs w-full sm:w-auto"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Option to Panel</span>
                </Button>
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
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/60 bg-muted/30"
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          {opt.emoji && <span className="text-base">{opt.emoji}</span>}
                          <span className="font-semibold text-foreground">{opt.label}</span>
                          <span className="text-muted-foreground font-mono">
                            → {opt.roleName}
                          </span>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {opt.style}
                          </Badge>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                          onClick={() => handleRemoveRoleOption(opt.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Authentic Discord Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4 sticky top-6">
            <Card className="border-border bg-card/60 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-emerald-500" />
                  Discord Component Preview
                </CardTitle>
                <CardDescription className="text-xs">
                  Pixel-perfect representation of how members see this panel in Discord.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Discord Dark Theme Message Container (#313338) */}
                <div className="rounded-xl border border-zinc-800 bg-[#313338] text-[#dbdee1] p-4 space-y-3 font-sans shadow-lg">
                  {/* Bot Header */}
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                      {botAvatarUrl ? (
                        <img
                          src={botAvatarUrl}
                          alt={botName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        botName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white hover:underline cursor-pointer">
                        {botName}
                      </span>
                      <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1 py-0.5 rounded leading-none">
                        BOT
                      </span>
                      <span className="text-[11px] text-[#949ba4] ml-1">Today at 10:15 AM</span>
                    </div>
                  </div>

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

                  {/* Action Row Components (Buttons vs Select Menu) */}
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
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold shadow-xs transition-colors cursor-pointer ${bg}`}
                            >
                              {opt.emoji && <span>{opt.emoji}</span>}
                              <span>{opt.label}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : (
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
                                {opt.emoji && <span>{opt.emoji}</span>}
                                <span className="font-semibold text-white">{opt.label}</span>
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
                  )}
                </div>

                <div className="pt-3 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Bot hierarchy checked on click
                  </span>
                  <span>
                    Target:{" "}
                    <strong className="text-foreground">
                      {channels.find((c) => c.id === activePanel.channelId)?.name ||
                        activePanel.channelName ||
                        "Not Set"}
                    </strong>
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
