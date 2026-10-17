import { redirect } from "next/navigation";
import { callApiServer, getServerSession } from "../../lib/api";
import { type GuildItem } from "../components/guild-card";
import { GuildsCommandDeck } from "./guilds-command-deck";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ArrowLeft, Server, AlertCircle, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GuildsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  const res = await callApiServer<{ guilds: GuildItem[] }>("/app/guilds");

  if (!res.ok || !res.data) {
    return (
      <main className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-lg rounded-lg border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <h1 className="text-lg font-semibold">Guild Selection Error</h1>
          </div>
          <p id="guilds-error-message" className="text-sm text-destructive mt-1">
            Failed to load manageable guilds: {res.error ?? "Access denied or Discord unavailable"}
          </p>
          <div className="mt-6 pt-4 border-t border-destructive/15 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" asChild>
              <a href="/" className="flex items-center gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </a>
            </Button>
            <Button variant="default" size="sm" asChild>
              <a href="/guilds" className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </a>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const guilds = res.data.guilds;

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader user={session.user} />

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Bar */}
        <PageHeader
          category="Control Plane Hub"
          title="Server Command Deck"
          description="Manage your authoritative Discord servers, active bot instances, and tenant configurations."
          backHref="/"
          backLabel="Back to Home"
        />

        {/* Content Area */}
        {guilds.length === 0 ? (
          <div
            id="no-guilds-message"
            className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center"
          >
            <Server className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="font-semibold text-foreground text-base">No manageable Discord guilds found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              We couldn&apos;t detect any Discord servers where you have Administrator or Manage Server permissions.
            </p>
            <div className="mt-5">
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs"
                >
                  Verify Discord Permissions
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <GuildsCommandDeck initialGuilds={guilds} />
        )}
      </main>
    </div>
  );
}
