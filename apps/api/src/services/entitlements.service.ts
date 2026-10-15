import {
  findSubscriptionByTenant,
  type DatabaseClient,
  type SubscriptionPlan,
  type TenantSubscription,
} from "@creatorcore/db";

export type FeatureKey =
  | "CUSTOM_BOT_TOKEN"
  | "CUSTOM_CANVAS_RANK_CARD"
  | "UNLIMITED_BUTTON_ROLES"
  | "ADVANCED_AUTOMOD"
  | "STREAM_NOTIFICATIONS_LIMIT"
  | "MAX_CONNECTED_GUILDS";

export interface PlanEntitlements {
  plan: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  maxStorageMb: number;
  maxConnectedGuilds: number;
  streamNotificationsLimit: number;
  maxRolePanels: number;
  serverBooster: boolean;
  customBotToken: boolean;
  customCanvasRankCard: boolean;
  unlimitedButtonRoles: boolean;
  advancedAutoMod: boolean;
  slaUptime: string;
  auditRetentionDays: number;
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanEntitlements> = {
  FREE: {
    plan: "FREE",
    name: "Starter (Free)",
    priceMonthly: 0,
    priceAnnual: 0,
    maxStorageMb: 30,
    maxConnectedGuilds: 1,
    streamNotificationsLimit: 4,
    maxRolePanels: 2,
    serverBooster: false,
    customBotToken: false,
    customCanvasRankCard: false,
    unlimitedButtonRoles: false,
    advancedAutoMod: false,
    slaUptime: "Community (Best Effort)",
    auditRetentionDays: 1,
  },
  PRO: {
    plan: "PRO",
    name: "Creator Pro",
    priceMonthly: 9.99,
    priceAnnual: 79,
    maxStorageMb: 100,
    maxConnectedGuilds: 1,
    streamNotificationsLimit: 100,
    maxRolePanels: 10,
    serverBooster: true,
    customBotToken: true,
    customCanvasRankCard: true,
    unlimitedButtonRoles: true,
    advancedAutoMod: true,
    slaUptime: "99.9% High-Availability",
    auditRetentionDays: 30,
  },
  ENTERPRISE: {
    plan: "ENTERPRISE",
    name: "Studio / Esports",
    priceMonthly: 29.99,
    priceAnnual: 249,
    maxStorageMb: 300,
    maxConnectedGuilds: 1,
    streamNotificationsLimit: 500,
    maxRolePanels: 100,
    serverBooster: true,
    customBotToken: true,
    customCanvasRankCard: true,
    unlimitedButtonRoles: true,
    advancedAutoMod: true,
    slaUptime: "99.99% Dedicated Process",
    auditRetentionDays: 90,
  },
};

export class EntitlementsService {
  constructor(private readonly db: DatabaseClient["db"]) {}

  /**
   * Retrieves the active subscription for a tenant, defaulting to FREE if not found.
   */
  async getTenantSubscription(tenantId: string): Promise<{
    subscription: TenantSubscription | null;
    plan: SubscriptionPlan;
    entitlements: PlanEntitlements;
  }> {
    const sub = await findSubscriptionByTenant(this.db, tenantId);
    const plan: SubscriptionPlan = sub && sub.status === "ACTIVE" ? sub.plan : "FREE";
    return {
      subscription: sub ?? null,
      plan,
      entitlements: PLAN_DEFINITIONS[plan],
    };
  }

  /**
   * Evaluates whether a tenant is entitled to a specific binary feature.
   */
  async canAccessFeature(tenantId: string, feature: FeatureKey): Promise<boolean> {
    const { entitlements } = await this.getTenantSubscription(tenantId);
    switch (feature) {
      case "CUSTOM_BOT_TOKEN":
        return entitlements.customBotToken;
      case "CUSTOM_CANVAS_RANK_CARD":
        return entitlements.customCanvasRankCard;
      case "UNLIMITED_BUTTON_ROLES":
        return entitlements.unlimitedButtonRoles;
      case "ADVANCED_AUTOMOD":
        return entitlements.advancedAutoMod;
      default:
        return true;
    }
  }
}
