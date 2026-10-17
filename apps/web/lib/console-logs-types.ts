export type ConsoleLogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR" | "DEBUG";

export type ConsoleLogCategory =
  | "SYSTEM"
  | "GATEWAY"
  | "ACTION_LOGS"
  | "AUTO_MOD"
  | "WELCOME"
  | "ROLES"
  | "STREAMS"
  | "BOOSTER"
  | "SECURITY";

export interface GuildConsoleLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string, e.g. "2026-10-11T16:14:40.324Z"
  level: ConsoleLogLevel;
  category: ConsoleLogCategory;
  message: string;
  details?: string | undefined;
}

export interface GuildConsoleData {
  logs: GuildConsoleLogEntry[];
  lastClearedAt?: string;
}

/**
 * Format an ISO timestamp using a target IANA timezone (e.g. "Asia/Colombo", "UTC", etc.)
 * Format output: [YYYY-MM-DD HH:mm:ss] or [YYYY-MM-DD HH:mm:ss.SSS]
 */
export function formatConsoleTimestamp(
  isoString: string,
  timeZone: string = "Asia/Colombo",
  includeMilliseconds = true,
): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const p = (type: string) => parts.find((part) => part.type === type)?.value || "";
    const ms = String(date.getUTCMilliseconds()).padStart(3, "0");

    const formatted = `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}:${p("second")}`;
    return includeMilliseconds ? `${formatted}.${ms}Z` : formatted;
  } catch {
    return isoString;
  }
}
