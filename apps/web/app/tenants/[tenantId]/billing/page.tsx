import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../../../lib/api";
import { GlobalHeader } from "@/components/layout/global-header";
import { BillingView, type BillingPricingPlan } from "./billing-view";

export const dynamic = "force-dynamic";

interface BillingPageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

const ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  process.env.NEXT_PUBLIC_ADMIN_API_URL ||
  "http://localhost:3002";

async function fetchAdminPricingPlans(): Promise<BillingPricingPlan[]> {
  try {
    const res = await fetch(`${ADMIN_API_URL}/api/pricing`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch live pricing plans from Admin API:", err);
  }
  return [];
}

export default async function BillingPage({ params }: BillingPageProps) {
  const session = await getServerSession();
  if (!session) {
    redirect("/");
  }

  const { tenantId } = await params;

  const [res, livePlans] = await Promise.all([
    callApiServer<{
      plan: "FREE" | "PRO" | "ENTERPRISE";
      subscription: {
        id?: string;
        status?: string;
        currentPeriodEnd?: string | null;
        cancelAtPeriodEnd?: boolean;
      } | null;
    }>(`/app/tenants/${encodeURIComponent(tenantId)}/subscription`),
    fetchAdminPricingPlans(),
  ]);

  const currentPlan = res.ok && res.data ? res.data.plan : "FREE";
  const subscription = res.ok && res.data ? res.data.subscription : null;

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader user={session.user} />
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <BillingView
          tenantId={tenantId}
          currentPlan={currentPlan}
          subscription={subscription}
          plans={livePlans}
        />
      </main>
    </div>
  );
}

