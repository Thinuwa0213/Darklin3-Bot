# Stream & Video Content Alerts Module Plan (Twitch, YouTube, Kick, TikTok)

> Complete end-to-end implementation of multi-platform stream & video notifications with URL auto-detection, Free vs Pro plan limits, and Discord bot automated dispatch.

---

## 🎯 Scope & Objectives
1. **Multi-Platform Support**: Twitch, YouTube, Kick, and **TikTok**.
2. **Smart Channel URL Detection**: Auto-detect platform and handle from pasted link (`twitch.tv/...`, `youtube.com/@...`, `kick.com/...`, `tiktok.com/@...`).
3. **Dual Notification Types**:
   - 🔴 Live Streams (Twitch, YouTube, Kick, TikTok)
   - 🎬 Video Uploads (YouTube, TikTok)
   - Per-channel checkboxes (`notifyLive`, `notifyUploads`).
4. **Live Auto-Role System**:
   - Auto-assign designated role when creator goes live; auto-remove when stream ends.
   - Dual trigger: Configured stream alert detection + Discord Gateway streaming presence.
   - Available on all plans (Free & Pro).
5. **Plan Gating**:
   - Free Plan: Max 1 Twitch, 1 YouTube, 1 Kick, 1 TikTok channel (1 per platform) + 1 Live Role configuration.
   - Pro Plan: Unlimited channels across all platforms + Auto-cleanup on stream offline.
6. **Discord Targeting**: Real channel & role pickers loaded from active Discord server.
7. **Worker Daemon Service**: 2-minute interval checking for live streams and new video uploads with Rich Embed notification and automated role grants/strips.

---

## 📋 Task Breakdown

### Phase 1: Storage & Shared Types
- [x] Create `apps/web/lib/streams-storage.ts` with TypeScript interfaces for `StreamerAlert` and `StreamAlertsConfig`.
- [x] Implement `readStoredStreams(tenantId, guildId)` and `writeStoredStreams(tenantId, guildId, config)`.

### Phase 2: Server Actions & Page Data
- [x] Add `saveStreamAlertsAction` and `getStreamAlertsAction` in `apps/web/app/actions.ts`.
- [x] Update `apps/web/app/tenants/[tenantId]/guilds/[guildId]/modules/notifications/page.tsx` to load live Discord channels/roles and stored stream config.

### Phase 3: Dashboard Web UI
- [x] Enhance `apps/web/app/tenants/[tenantId]/guilds/[guildId]/modules/notifications/notifications-view.tsx`.

### Phase 4: Worker Stream Manager & Discord Dispatcher
- [x] Create `apps/worker/src/runtime/stream-manager.ts`.
- [x] Register `StreamManager` in `apps/worker/src/runtime/bot-runtime.ts`.

### Phase 5: Verification & Quality Check
- [x] Run type checking across web and worker packages (`pnpm typecheck` passed 10/10).
- [x] Validate unit tests and verify module functionality (`pnpm test` passed 5/5 workspaces).

### Phase 6: Video Uploads & TikTok Integration
- [x] Update `apps/web/lib/streams-storage.ts` to include `"tiktok"` in platforms, `notifyLive`, `notifyUploads`, `lastVideoId`, and `customUploadMessage`.
- [x] Update `notifications-view.tsx` with TikTok URL auto-detection, Free tier 1 TikTok limit, alert type toggles (Live / Video Uploads), and Upload message template.
- [x] Update `apps/worker/src/runtime/stream-manager.ts` to check YouTube video uploads, TikTok videos/live, and dispatch distinct video upload embeds.
- [x] Run `pnpm typecheck` and `pnpm test` to verify zero regressions (10/10 typecheck tasks and 254/254 tests passed).

### Phase 7: Live Auto-Role Feature
- [x] Extend storage schema in `apps/web/lib/streams-storage.ts` (`liveRoleEnabled`, `liveRoleId`, `liveRoleName`, `autoPresenceRole`, `discordUserId`).
- [x] Add Live Auto-Role settings UI card and linked Discord member input in `notifications-view.tsx`.
- [x] Extend `IDiscordClient` in `apps/worker/src/runtime/discord-client.ts` with `fetchGuild` and `GuildPresences` intent.
- [x] Update `StreamManager` in `apps/worker/src/runtime/stream-manager.ts` to assign/strip Live Role upon stream start/end and handle presence streaming status.
- [x] Verify with typecheck and unit tests (`pnpm typecheck` passed 10/10, `pnpm test` passed 5/5 workspaces).
