# Darklin3 Modules Implementation Plan (Option B)

Comprehensive implementation of the 3 essential production modules for the Darklin3 Bot:
1. **Server Booster** (Booster announcements, Discord Nitro embeds, member update tracking)
2. **Action Logs** (Granular audit logging across 5 event categories, channel routing)
3. **Auto Moderation** (Rule-based defense: anti-spam, anti-invite, bad words, mass mentions, auto-timeouts)

---

## Architecture Checklist

### 1. Server Booster (`/modules/booster`)
- [ ] Data contracts & Storage: `apps/web/lib/booster-types.ts`, `apps/web/lib/booster-storage.ts`
- [ ] API routes: `GET / POST /app/tenants/:tenantId/guilds/:guildId/booster` & `/test-alert` in `apps/api`
- [ ] Server Actions: `getBoosterConfigAction`, `saveBoosterConfigAction`, `sendTestBoostAlertAction` in `apps/web/app/actions.ts`
- [ ] Worker runtime: `apps/worker/src/runtime/booster-manager.ts` (listens to `guildMemberUpdate`)
- [ ] Frontend UI: `apps/web/app/tenants/[tenantId]/guilds/[guildId]/modules/booster/page.tsx` & `booster-view.tsx` with live Discord Nitro preview
- [ ] Navigation: Sidebar item in `app-sidebar.tsx`

### 2. Action Logs (`/modules/action-logs`)
- [ ] Data contracts & Storage: `apps/web/lib/action-logs-types.ts`, `apps/web/lib/action-logs-storage.ts`
- [ ] API routes: `GET / POST /app/tenants/:tenantId/guilds/:guildId/action-logs` in `apps/api`
- [ ] Server Actions: `getActionLogsConfigAction`, `saveActionLogsConfigAction` in `apps/web/app/actions.ts`
- [ ] Worker runtime: `apps/worker/src/runtime/action-log-manager.ts` (listens to message, member, role, channel, voice events)
- [ ] Frontend UI: `apps/web/app/tenants/[tenantId]/guilds/[guildId]/modules/action-logs/page.tsx` & `action-logs-view.tsx`
- [ ] Navigation: Sidebar item in `app-sidebar.tsx`

### 3. Auto Moderation (`/modules/moderation`)
- [ ] Data contracts & Storage: `apps/web/lib/moderation-types.ts`, `apps/web/lib/moderation-storage.ts`
- [ ] API routes: `GET / POST /app/tenants/:tenantId/guilds/:guildId/moderation` in `apps/api`
- [ ] Server Actions: `getModerationConfigAction`, `saveModerationConfigAction` in `apps/web/app/actions.ts`
- [ ] Worker runtime: `apps/worker/src/runtime/auto-mod-manager.ts` (listens to `messageCreate`, applies spam/invite/words/mentions defense)
- [ ] Worker Gateway: Ensure `GatewayIntentBits.MessageContent` in `RealDiscordClient`
- [ ] Frontend UI: Upgrade `apps/web/app/tenants/[tenantId]/guilds/[guildId]/modules/moderation/moderation-view.tsx` to full rule-based UI

### 4. Integration & Quality Gate
- [ ] Register all 3 managers in `apps/worker/src/runtime/bot-runtime.ts`
- [ ] Run `pnpm typecheck` across all 6 packages
- [ ] Run `pnpm test` across all workspaces
