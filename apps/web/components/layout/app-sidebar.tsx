"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  LayoutDashboard,
  Sparkles,
  Trophy,
  Radio,
  Layers,
  CreditCard,
  ShieldAlert,
  FileText,
  Palette,
  Activity,
  Radar,
  Settings,
  Rocket,
  ScrollText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { GuildSwitcher, type ConnectedGuildItem } from "./guild-switcher";
import { UserMenu } from "./user-menu";

interface AppSidebarProps {
  currentGuild: {
    id: string;
    tenantId: string;
    name?: string | undefined;
  };
  connectedGuilds: ConnectedGuildItem[];
  user: {
    id: string;
    name: string;
    email?: string | undefined;
    image?: string | null | undefined;
  };
}

export function AppSidebar({ currentGuild, connectedGuilds, user }: AppSidebarProps) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();

  const guildBase = `/tenants/${currentGuild.tenantId}/guilds/${currentGuild.id}`;
  const overviewUrl = guildBase;
  const setupUrl = `${guildBase}/setup`;
  const brandingUrl = `${guildBase}/modules/branding`;
  const presenceUrl = `${guildBase}/modules/presence`;
  const settingsUrl = `${guildBase}/settings`;
  const welcomeUrl = `${guildBase}/modules/welcome`;
  const levelsUrl = `${guildBase}/modules/levels`;
  const notificationsUrl = `${guildBase}/modules/notifications`;
  const radarUrl = `${guildBase}/modules/radar`;
  const rolesUrl = `${guildBase}/modules/roles`;
  const boosterUrl = `${guildBase}/modules/booster`;
  const embedsUrl = `${guildBase}/modules/embeds`;
  const moderationUrl = `${guildBase}/modules/moderation`;
  const actionLogsUrl = `${guildBase}/modules/action-logs`;
  const billingUrl = `/tenants/${currentGuild.tenantId}/billing`;

  return (
    <Sidebar id="app-sidebar" collapsible="icon">
      {/* Brand Header */}
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-950 font-black text-sm">
            D
          </div>
          {(state === "expanded" || isMobile) && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-none text-sidebar-foreground">
                Darklin3
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                Discord Operations
              </span>
            </div>
          )}
        </div>

        {/* Guild Switcher */}
        <div className="mt-2">
          <GuildSwitcher currentGuild={currentGuild} connectedGuilds={connectedGuilds} />
        </div>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent>
        {/* Core Operations */}
        <div className="px-2 py-1">
          {(state === "expanded" || isMobile) && (
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-2 mb-1 block">
              Core
            </span>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-guild-overview"
                href={overviewUrl}
                isActive={pathname === overviewUrl}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Overview</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-bot-setup"
                href={setupUrl}
                isActive={pathname === setupUrl}
              >
                <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Bot Configuration</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-bot-branding"
                href={brandingUrl}
                isActive={pathname === brandingUrl}
              >
                <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Bot Identity</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-bot-presence"
                href={presenceUrl}
                isActive={pathname === presenceUrl}
              >
                <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Rich Presence</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-guild-settings"
                href={settingsUrl}
                isActive={pathname === settingsUrl}
              >
                <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Server Settings</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        {/* Engagement & Community */}
        <div className="px-2 py-2">
          {(state === "expanded" || isMobile) && (
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-2 mb-1 block">
              Community
            </span>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-welcome"
                href={welcomeUrl}
                isActive={pathname === welcomeUrl}
              >
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Welcome &amp; Rules</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-levels"
                href={levelsUrl}
                isActive={pathname === levelsUrl}
              >
                <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Levels &amp; XP</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-notifications"
                href={notificationsUrl}
                isActive={pathname === notificationsUrl}
              >
                <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Stream Alerts</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-radar"
                href={radarUrl}
                isActive={pathname === radarUrl}
              >
                <Radar className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && (
                  <div className="flex items-center justify-between w-full">
                    <span>Community Radar</span>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-700/80 text-zinc-300 bg-zinc-900/60 px-1 py-0">
                      PRO
                    </Badge>
                  </div>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-roles"
                href={rolesUrl}
                isActive={pathname === rolesUrl}
              >
                <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Reaction &amp; Button Roles</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-booster"
                href={boosterUrl}
                isActive={pathname === boosterUrl}
              >
                <Rocket className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && (
                  <div className="flex items-center justify-between w-full">
                    <span>Server Booster</span>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-700/80 text-zinc-300 bg-zinc-900/60 px-1 py-0">
                      PRO
                    </Badge>
                  </div>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-embeds"
                href={embedsUrl}
                isActive={pathname === embedsUrl}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && (
                  <div className="flex items-center justify-between w-full">
                    <span>Embed Builder</span>
                    <Badge variant="outline" className="text-[9px] font-mono border-zinc-700/80 text-zinc-300 bg-zinc-900/60 px-1 py-0">
                      PRO
                    </Badge>
                  </div>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        {/* Protection & Moderation */}
        <div className="px-2 py-2">
          {(state === "expanded" || isMobile) && (
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-2 mb-1 block">
              Protection
            </span>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-moderation"
                href={moderationUrl}
                isActive={pathname === moderationUrl}
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Auto Moderation</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-module-action-logs"
                href={actionLogsUrl}
                isActive={pathname === actionLogsUrl}
              >
                <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && <span>Action Logs</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        {/* Workspace & Billing */}
        <div className="px-2 py-2">
          {(state === "expanded" || isMobile) && (
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase px-2 mb-1 block">
              Workspace
            </span>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                id="nav-billing"
                href={billingUrl}
                isActive={pathname.startsWith(`/tenants/${currentGuild.tenantId}/billing`)}
              >
                <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(state === "expanded" || isMobile) && (
                  <div className="flex items-center justify-between w-full">
                    <span>Billing & Plans</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono font-bold border-zinc-700/80 text-zinc-300 bg-zinc-900/60">
                      PRO
                    </Badge>
                  </div>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>

      {/* Sidebar Footer — User information & session control */}
      <SidebarFooter>
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <UserMenu user={user} />
            {(state === "expanded" || isMobile) && (
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-sidebar-foreground truncate leading-tight">
                  {user.name}
                </span>
                {user.email && (
                  <span className="text-[11px] text-muted-foreground truncate leading-tight">
                    {user.email}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
