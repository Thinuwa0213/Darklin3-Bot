# Button & Dropdown Roles Module Plan (End-to-End Implementation)

> Comprehensive implementation of multi-panel Button & Dropdown Roles with real Discord channel/role picker, in-place message publishing, Worker Gateway interaction handling, and Activity Logging.

---

## 🎯 Architecture & Objectives

1. **Multi-Panel Builder**:
   - Manage unlimited role panels per server (e.g., Gaming, Notifications, Colors, Platforms).
   - Component Type Switcher: **Button Matrix** (ActionRow buttons) vs **Dropdown Menu** (StringSelectMenu).
   - Selection Mode: **Multi-Select** (allow multiple) vs **Exclusive** (single role per panel).
   - Embed Customization: Title, description, hex color picker with presets, footer text, timestamps.
   - Role Gating & Limits: Required Role (prerequisite), Forbidden Role (blacklist), Role Selection Limit.

2. **Storage & Audit Logging**:
   - `storage/tenants/[tenantId]/guilds/[guildId]/roles-panels.json` for persistent panels config.
   - `storage/tenants/[tenantId]/guilds/[guildId]/roles-logs.json` storing recent 100 role assignment/removal events.

3. **Discord Publishing (apps/api)**:
   - In-place message updates via Discord REST API (`PATCH /channels/:id/messages/:id`).
   - Clean fallback to new message (`POST /channels/:id/messages`) if message was deleted or unposted.
   - Discord ActionRow builders with exact component specs (5 buttons per row, 25 options per select menu).

4. **Worker Runtime Dispatcher (apps/worker)**:
   - `RolePanelManager` listening on `client.on("interactionCreate")`.
   - Handles `interaction.isButton()` with instant toggle & ephemeral feedback.
   - Handles `interaction.isStringSelectMenu()` with exact sync (add selected, strip unselected from panel).
   - Rigorous Role Hierarchy check (prevents bot error if role is positioned higher than bot).
   - Instant ephemeral replies (<500ms) to prevent Discord 3s timeout.

5. **Dashboard Web UI (apps/web)**:
   - Authentic Discord message dark-mode preview with real-time button styles, colors, and dropdown mockup.
   - Real Discord channel & role picker loaded directly from `/discord-resources`.
   - Activity log inspector tab with live audit feed.

---

## 📋 Task Breakdown

### Phase 1: Shared Types & Storage Engine
- [x] Create `apps/web/lib/roles-types.ts` defining all interfaces for panels, options, embed config, logs.
- [x] Create `apps/web/lib/roles-storage.ts` for file I/O operations (`readStoredRolePanels`, `writeStoredRolePanels`, `readStoredRoleLogs`, `appendStoredRoleLog`).

### Phase 2: Backend API & Discord REST Publishing
- [x] Implement `publishRolePanelMessage` in `apps/api/src/services/credential-service.ts`.
- [x] Add publish route `POST /guilds/:guildId/roles-panels/:panelId/publish` in `apps/api/src/routes/app/tenant-resources.ts`.

### Phase 3: Server Actions in Web App
- [x] Add `getRolePanelsAction`, `saveRolePanelsAction`, `publishRolePanelAction`, `deleteRolePanelAction`, `getRoleLogsAction` in `apps/web/app/actions.ts`.

### Phase 4: Worker Gateway Interaction Dispatcher
- [x] Create `apps/worker/src/runtime/role-panel-manager.ts` implementing `isButton` and `isStringSelectMenu` dispatching, hierarchy validation, exclusive logic, and logging.
- [x] Integrate `RolePanelManager` into `apps/worker/src/runtime/bot-runtime.ts` under Gateway `interactionCreate`.
- [x] Add unit tests in `apps/worker/src/runtime/role-panel-manager.test.ts`.

### Phase 5: Dashboard UI & Real Discord Integration
- [x] Update `apps/web/app/tenants/[tenantId]/guilds/[guildId]/modules/roles/page.tsx` to fetch live Discord resources and load saved panels.
- [x] Build the complete interactive `roles-view.tsx` with Panel List, Panel Builder, Live Preview, and Activity Log tab.

### Phase 6: Quality Assurance & Type Validation
- [x] Run `pnpm typecheck` across all 6 packages (10/10 tasks passed).
- [x] Run `pnpm test` across all workspaces (10/10 test files, 63/63 tests passed, zero regressions).
