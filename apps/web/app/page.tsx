import { redirect } from "next/navigation";
import { loadWebConfig } from "@creatorcore/config";
import { getServerSession } from "../lib/api";
import { DiscordSignInButton } from "./components/auth-buttons";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = loadWebConfig();
  const session = await getServerSession();

  if (session) {
    redirect("/guilds");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      {/* Top utility bar */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md shadow-2xs border-border/80">
        <CardHeader className="text-center pb-4">
          <img
            src="/logo-icon.png"
            alt="Darklin3"
            className="mx-auto mb-3 h-14 w-14 rounded-2xl object-cover shadow-md border border-border"
          />
          <CardTitle className="text-2xl font-bold tracking-tight">
            {config.NEXT_PUBLIC_APP_NAME}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            Control-plane foundation operational.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          <div id="unauthenticated-view" className="space-y-4">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              Sign in with your Discord account to manage your branded bots and server
              configurations.
            </p>

            <div className="pt-2">
              <DiscordSignInButton />
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-3 border-t border-border">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Requires Administrator permissions on Discord</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
