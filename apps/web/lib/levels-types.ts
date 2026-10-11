export interface LevelRoleReward {
  level: number;
  roleId: string;
  roleName: string;
}

export interface RankCardConfig {
  enabled: boolean;
  preset: "landscape" | "ocean" | "midnight" | "blurple";
  customBgUrl?: string | undefined;
  progressBarColor: string;
  circleColor: string;
  textColor: string;
  barTextColor: string;
}

export const DEFAULT_RANK_CARD_CONFIG: RankCardConfig = {
  enabled: true,
  preset: "landscape",
  progressBarColor: "#5865f2",
  circleColor: "#5865f2",
  textColor: "#ffffff",
  barTextColor: "#ffffff",
};

export interface LevelSettings {
  enabled: boolean;
  xpMin: number;
  xpMax: number;
  cooldownSeconds: number;
  announcementEnabled: boolean;
  announcementChannelId?: string | undefined;
  announcementChannelName?: string | undefined;
  ignoredChannelIds: string[];
  roleRewards: LevelRoleReward[];
  roleRewardsEnabled?: boolean | undefined;
  voiceXpEnabled?: boolean | undefined;
  voiceXpPerInterval?: number | undefined;
  voiceIntervalMinutes?: number | undefined;
  boosterMultiplierEnabled?: boolean | undefined;
  boosterMultiplier?: number | undefined;
  dailyXpEnabled?: boolean | undefined;
  dailyXpAmount?: number | undefined;
  rankCard?: RankCardConfig | undefined;
}

export interface UserXpRecord {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  xp: number;
  level: number;
  lastXpAt: number;
  lastDailyAt?: number | undefined;
}

export const DEFAULT_LEVEL_SETTINGS: LevelSettings = {
  enabled: true,
  xpMin: 15,
  xpMax: 25,
  cooldownSeconds: 60,
  announcementEnabled: true,
  announcementChannelId: "",
  announcementChannelName: "",
  ignoredChannelIds: [],
  roleRewardsEnabled: false,
  roleRewards: [],
  voiceXpEnabled: false,
  voiceXpPerInterval: 10,
  voiceIntervalMinutes: 5,
  boosterMultiplierEnabled: true,
  boosterMultiplier: 1.5,
  dailyXpEnabled: true,
  dailyXpAmount: 100,
  rankCard: DEFAULT_RANK_CARD_CONFIG,
};
