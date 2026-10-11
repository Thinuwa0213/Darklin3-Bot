export type RoleButtonStyle = "primary" | "secondary" | "success" | "danger";

export type RoleComponentType = "BUTTON" | "DROPDOWN" | "REACTION";

export type RoleSelectionMode = "MULTI" | "EXCLUSIVE";

export interface RolePanelOption {
  id: string;
  roleId: string;
  roleName: string;
  roleColor?: string | undefined;
  label: string;
  description?: string | undefined;
  emoji?: string | undefined;
  style: RoleButtonStyle;
}

export interface RolePanelEmbedConfig {
  title: string;
  description: string;
  color: string; // Hex color string, e.g. "#5865F2"
  footerText?: string | undefined;
  showTimestamp?: boolean | undefined;
}

export interface RolePanel {
  id: string;
  name: string;
  description?: string | undefined;
  channelId: string;
  channelName?: string | undefined;
  type: RoleComponentType;
  mode: RoleSelectionMode;
  maxSelections?: number | undefined;
  requiredRoleId?: string | undefined;
  forbiddenRoleId?: string | undefined;
  embed: RolePanelEmbedConfig;
  options: RolePanelOption[];
  messageId?: string | undefined;
  publishedAt?: string | undefined;
  status: "DRAFT" | "PUBLISHED" | "ERROR";
  lastError?: string | undefined;
}

export interface RolePanelsConfig {
  enabled?: boolean;
  panels: RolePanel[];
  loggingEnabled: boolean;
  logChannelId?: string | undefined;
}

export interface RoleAssignmentLog {
  id: string;
  panelId: string;
  panelName: string;
  userId: string;
  userName: string;
  action: "ADD" | "REMOVE";
  roleId: string;
  roleName: string;
  timestamp: string;
}

export const DEFAULT_ROLE_PANELS_CONFIG: RolePanelsConfig = {
  enabled: true,
  panels: [],
  loggingEnabled: true,
  logChannelId: undefined,
};
