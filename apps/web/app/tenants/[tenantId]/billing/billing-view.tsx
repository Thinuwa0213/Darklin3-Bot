"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { upgradePlanAction, cancelPlanAction } from "@/app/actions";
import {
  Check,
  Crown,
  Sparkles,
  ShieldCheck,
  Server,
  Radio,
  Bot,
  Zap,
  Loader2,
} from "lucide-react";
import { PageHeader, ProBadge } from "@/components/layout/page-header";
import { FeedbackBanner } from "@/components/ui/feedback-banner";

export interface BillingPricingPlan {
  id: string;
  name: string;
  description: string;
  monthly_price: number;
  annual_price: number;
  annual_discount_label?: string;
  badge?: string | null;
  is_featured?: boolean;
  features: string[];
  cta_text?: string;
  cta_url?: string;
  cta_type?: string;
  sort_order?: number;
  is_active?: boolean;
}

export function normalizePlanKey(id: string): "FREE" | "PRO" | "ENTERPRISE" {
  const upper = id.toUpperCase();
  if (upper === "STARTER" || upper === "FREE") return "FREE";
  if (upper === "PRO" || upper === "CREATOR" || upper === "CREATOR_PRO") return "PRO";
  if (upper === "ENTERPRISE" || upper === "STUDIO") return "ENTERPRISE";
  return upper as "FREE" | "PRO" | "ENTERPRISE";
}

const DEFAULT_FALLBACK_PLANS: BillingPricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Free dedicated bot hosting for growing communities.",
    monthly_price: 0,
    annual_price: 0,
    annual_discount_label: "",
    badge: null,
    is_featured: false,
    features: [
      "1 dedicated bot instance",
      "1080p welcome canvas studio",
      "Automatic member starter roles",
      "30 MB custom asset storage",
      "1 stream alert per platform",
      "Web console access",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For active guilds, streamers, and community servers.",
    monthly_price: 9.99,
    annual_price: 7.99,
    annual_discount_label: "-20%",
    badge: "Recommended",
    is_featured: true,
    features: [
      "Everything in Starter, plus:",
      "100 MB custom asset storage",
      "Community stream radar",
      "Server booster announcements",
      "Unlimited live stream alerts",
      "Priority Discord ticket support",
    ],
  },
];

interface BillingViewProps {
  tenantId: string;
  currentPlan: "FREE" | "PRO" | "ENTERPRISE";
  subscription: {
    id?: string;
    status?: string;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
  } | null;
  plans?: BillingPricingPlan[];
}

export function BillingView({
  tenantId,
  currentPlan: initialPlan,
  subscription,
  plans,
}: BillingViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [activePlan, setActivePlan] = useState<"FREE" | "PRO" | "ENTERPRISE">(initialPlan);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const displayPlans = plans && plans.length > 0 ? plans : DEFAULT_FALLBACK_PLANS;

  const handlePlanChange = (targetPlan: "FREE" | "PRO" | "ENTERPRISE", planName: string) => {
    setProcessingPlan(targetPlan);
    setFeedback(null);

    startTransition(async () => {
      try {
        if (targetPlan === "FREE") {
          const res = await cancelPlanAction(tenantId);
          if (res.ok) {
            setActivePlan("FREE");
            setFeedback({ type: "success", message: "Plan downgraded to Free Starter." });
            router.refresh();
          } else {
            setFeedback({ type: "error", message: res.error ?? "Failed to downgrade plan." });
          }
        } else {
          const res = await upgradePlanAction(tenantId, targetPlan, interval);
          if (res.ok) {
            setActivePlan(targetPlan);
            setFeedback({
              type: "success",
              message: `Successfully upgraded to ${planName}!`,
            });
            router.refresh();
          } else {
            setFeedback({ type: "error", message: res.error ?? "Failed to upgrade plan." });
          }
        }
      } catch (err) {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "An unexpected error occurred.",
        });
      } finally {
        setProcessingPlan(null);
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <PageHeader
        category="Tenant Administration"
        title="Billing & Subscriptions"
        description="Manage your subscription tiers, usage entitlements, and white-label bot features."
        badge={
          activePlan === "FREE" ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              FREE
            </Badge>
          ) : (
            <ProBadge label={activePlan} />
          )
        }
        backHref="/guilds"
        backLabel="Server Selection"
      />

      {/* Status Feedback Banner */}
      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Current Subscription Status Card */}
      <Card className="border-border/80 shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Active Subscription Overview
            </span>
            <Badge variant="outline" className="text-xs">
              Status: {subscription?.status ?? "ACTIVE"}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            {activePlan === "FREE"
              ? "You are currently on the Free Starter tier. Upgrade to unlock full white-label custom bots."
              : `Active Plan: ${activePlan === "PRO" ? "Pro" : activePlan === "ENTERPRISE" ? "Enterprise" : activePlan}. High-availability priority runtime.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Server className="h-3.5 w-3.5" />
                <span>Bot Deployment</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {activePlan === "ENTERPRISE" ? "Dedicated Cluster" : "Dedicated Server Bot"}
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Bot className="h-3.5 w-3.5" />
                <span>Media & Asset Storage</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {activePlan === "FREE" ? "30 MB Quota" : activePlan === "PRO" ? "100 MB Quota" : "300 MB Quota"}
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Radio className="h-3.5 w-3.5" />
                <span>Stream Live Alerts</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {activePlan === "FREE" ? "1 / Platform (Twitch, YT, Kick, TikTok)" : "Unlimited (All Platforms)"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interval Switcher */}
      <div className="flex flex-col items-center justify-center gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              interval === "month"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly Billing
          </button>

          <button
            type="button"
            onClick={() => setInterval("year")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              interval === "year"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Annual Billing</span>
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white hover:bg-emerald-600">
              Save 20%
            </Badge>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Prices in USD. Cancel or change anytime.</p>
      </div>

      {/* Pricing Comparison Cards */}
      <div
        className={`grid grid-cols-1 ${
          displayPlans.length === 2
            ? "md:grid-cols-2 max-w-3xl"
            : displayPlans.length >= 3
            ? "md:grid-cols-3 max-w-5xl"
            : "max-w-md"
        } mx-auto gap-6 items-stretch w-full`}
      >
        {displayPlans.map((plan) => {
          const targetPlanKey = normalizePlanKey(plan.id);
          const isCurrentPlan = activePlan === targetPlanKey;
          const price = interval === "year" ? plan.annual_price : plan.monthly_price;
          const formattedPrice = price === 0 ? "$0" : `$${Number(price).toFixed(2)}`;
          const isFeatured = Boolean(plan.is_featured || plan.badge);
          const badgeText = plan.badge || (plan.is_featured ? "Most Popular" : null);

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col justify-between border-border transition-all duration-200 ${
                isFeatured ? "border-primary shadow-lg bg-card" : ""
              } ${isCurrentPlan ? "ring-2 ring-primary/60" : ""}`}
            >
              {badgeText && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>{badgeText}</span>
                </div>
              )}

              <CardHeader className={badgeText ? "pt-6" : ""}>
                <div className="flex items-center justify-between mb-1">
                  <CardTitle className="text-lg font-bold flex items-center gap-1.5">
                    {targetPlanKey === "PRO" ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : targetPlanKey === "ENTERPRISE" ? (
                      <ShieldCheck className="h-5 w-5 text-purple-500" />
                    ) : (
                      <Zap className="h-4 w-4 text-primary" />
                    )}
                    <span>{plan.name}</span>
                  </CardTitle>
                  {isCurrentPlan && (
                    <Badge variant={isFeatured ? "default" : "secondary"}>
                      Current Plan
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-foreground">{formattedPrice}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    / month {interval === "year" && price > 0 ? `(billed annually ${plan.annual_discount_label || "-20%"})` : ""}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-2">
                <Separator />
                <ul className="space-y-2.5 text-xs text-muted-foreground">
                  {plan.features.map((feat, idx) => {
                    const isNegative = feat.startsWith("- ");
                    const text = isNegative ? feat.replace(/^-\s*/, "") : feat;

                    if (isNegative) {
                      return (
                        <li key={idx} className="flex items-center gap-2 text-muted-foreground/60">
                          <span className="h-4 w-4 shrink-0 flex items-center justify-center font-bold">-</span>
                          <span className="line-through">{text}</span>
                        </li>
                      );
                    }

                    return (
                      <li key={idx} className="flex items-start gap-2 text-foreground">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>

              <CardFooter className="pt-2">
                {isCurrentPlan ? (
                  <Button disabled variant="outline" className="w-full text-xs">
                    {targetPlanKey === "FREE" ? "Active Tier" : "Current Plan"}
                  </Button>
                ) : targetPlanKey === "FREE" ? (
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    disabled={isPending}
                    onClick={() => handlePlanChange("FREE", plan.name)}
                  >
                    {processingPlan === "FREE" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Downgrade to Free"
                    )}
                  </Button>
                ) : (
                  <Button
                    className={`w-full text-xs font-bold gap-2 shadow-sm ${
                      !isFeatured ? "bg-primary/90 hover:bg-primary" : ""
                    }`}
                    disabled={isPending}
                    onClick={() => handlePlanChange(targetPlanKey, plan.name)}
                  >
                    {processingPlan === targetPlanKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        <span>Upgrade to {plan.name}</span>
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
