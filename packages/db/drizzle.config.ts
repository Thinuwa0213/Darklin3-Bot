import { defineConfig } from "drizzle-kit";
import { loadDatabaseConfig } from "@darklin3_bot/config/database";

/**
 * drizzle-kit is pointed at src/schema/index.ts, the Phase 3 physical
 * schema barrel (docs/adr/0006 locks the conceptual model; this is its
 * first physical implementation — see README.md).
 *
 * The URL comes from the same @darklin3_bot/config schema apps/api uses —
 * not a second, independently-maintained copy of the contract (a
 * duplication found during Gate 2 architecture review). `db:generate` only
 * diffs the schema and never connects, so it works with no env vars set at
 * all via the fallback below; `db:migrate`/`db:push` do connect and need a
 * real `DATABASE_URL`.
 */
function resolveDatabaseUrl(): string {
  try {
    return loadDatabaseConfig().DATABASE_URL;
  } catch {
    return "mysql://darklin3_bot:@127.0.0.1:3306/darklin3_bot";
  }
}

export default defineConfig({
  dialect: "mysql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
