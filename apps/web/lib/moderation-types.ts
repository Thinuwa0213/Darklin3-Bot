export interface AutoModRuleConfig {
  enabled: boolean;
  action: "DELETE" | "TIMEOUT" | "WARN";
  timeoutSeconds: number;
  sendAlert?: boolean;
  sendDm?: boolean;
}

export interface CustomAutoModRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: "CUSTOM_WORD" | "CUSTOM_PATTERN";
  patterns: string[];
  action: "DELETE" | "TIMEOUT" | "WARN";
  timeoutSeconds: number;
  sendAlert?: boolean;
  sendDm?: boolean;
}

export interface ModerationConfig {
  enabled: boolean;
  logChannelId?: string | undefined;
  antiSpam: AutoModRuleConfig & {
    threshold: number;
    timeSpan: number;
  };
  imageSpam?: AutoModRuleConfig & {
    maxImages: number;
    timeSpan: number;
  };
  antiInvites: AutoModRuleConfig & {
    allowedInvites: string[];
  };
  badWords: AutoModRuleConfig & {
    words: string[];
  };
  massMentions: AutoModRuleConfig & {
    maxMentions: number;
  };
  capsLimit: {
    enabled: boolean;
    maxPercentage: number;
    minLength: number;
    action?: "DELETE" | "TIMEOUT" | "WARN";
    sendAlert?: boolean;
    sendDm?: boolean;
  };
  customRules?: CustomAutoModRule[];
  ignoredChannels: string[];
  ignoredRoles: string[];
}

export const DEFAULT_MODERATION_CONFIG: ModerationConfig = {
  enabled: true,
  logChannelId: undefined,
  antiSpam: {
    enabled: true,
    threshold: 5,
    timeSpan: 5,
    action: "TIMEOUT",
    timeoutSeconds: 300,
    sendAlert: true,
    sendDm: true,
  },
  imageSpam: {
    enabled: true,
    maxImages: 3,
    timeSpan: 5,
    action: "DELETE",
    timeoutSeconds: 300,
    sendAlert: true,
    sendDm: true,
  },
  antiInvites: {
    enabled: true,
    allowedInvites: [],
    action: "DELETE",
    timeoutSeconds: 600,
    sendAlert: true,
    sendDm: true,
  },
  badWords: {
    enabled: true,
    words: ["scam", "free nitro", "discord.gift", "nuke", "raid"],
    action: "DELETE",
    timeoutSeconds: 300,
    sendAlert: true,
    sendDm: false,
  },
  massMentions: {
    enabled: true,
    maxMentions: 4,
    action: "TIMEOUT",
    timeoutSeconds: 600,
    sendAlert: true,
    sendDm: true,
  },
  capsLimit: {
    enabled: true,
    maxPercentage: 70,
    minLength: 10,
    action: "DELETE",
    sendAlert: false,
    sendDm: false,
  },
  customRules: [],
  ignoredChannels: [],
  ignoredRoles: [],
};
