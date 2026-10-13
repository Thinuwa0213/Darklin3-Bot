/**
 * Standardized Template Variables for CreatorCore.
 * Used uniformly across all modules (Welcome, Boosters, Invites, Levels, Notifications).
 */

export interface TemplateVariable {
  token: string;
  label: string;
  description: string;
  example: string;
  category: "user" | "server" | "channel" | "misc";
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    token: "{user}",
    label: "Mention User",
    description: "Mentions the new member directly (@User)",
    example: "@NewMember",
    category: "user",
  },
  {
    token: "{user.name}",
    label: "Username",
    description: "The plain username without pinging",
    example: "Alex",
    category: "user",
  },
  {
    token: "{server}",
    label: "Server Name",
    description: "The name of your Discord server",
    example: "Creator Realm",
    category: "server",
  },
  {
    token: "{memberCount}",
    label: "Member Count",
    description: "Total members currently in the server",
    example: "1,420",
    category: "server",
  },
  {
    token: "{channel}",
    label: "Channel",
    description: "Mentions the announcement channel",
    example: "#welcome",
    category: "channel",
  },
];

export const WELCOME_VARIABLES: TemplateVariable[] = TEMPLATE_VARIABLES.filter((v) =>
  ["{user}", "{user.name}", "{server}", "{memberCount}"].includes(v.token),
);

export const STREAM_ALERT_VARIABLES: TemplateVariable[] = [
  {
    token: "{streamer}",
    label: "Streamer Name",
    description: "The name of the streamer or channel",
    example: "CreatorPulse",
    category: "user",
  },
  {
    token: "{role}",
    label: "Mention Role",
    description: "The ping role configured for this alert",
    example: "@everyone",
    category: "user",
  },
  {
    token: "{url}",
    label: "Stream Link",
    description: "Direct link to the live stream",
    example: "https://youtube.com/watch?v=...",
    category: "misc",
  },
  {
    token: "{game}",
    label: "Game / Category",
    description: "Current game or category being streamed",
    example: "VALORANT",
    category: "misc",
  },
];

export const VIDEO_UPLOAD_VARIABLES: TemplateVariable[] = [
  {
    token: "{streamer}",
    label: "Creator Name",
    description: "The name of the video creator",
    example: "CreatorPulse",
    category: "user",
  },
  {
    token: "{title}",
    label: "Video Title",
    description: "The title of the newly uploaded video",
    example: "Euro Truck Simulator 2 New Mods",
    category: "misc",
  },
  {
    token: "{url}",
    label: "Video Link",
    description: "Direct link to the uploaded video",
    example: "https://youtube.com/watch?v=...",
    category: "misc",
  },
  {
    token: "{role}",
    label: "Mention Role",
    description: "The ping role configured for this alert",
    example: "@everyone",
    category: "user",
  },
];

export const RADAR_VARIABLES: TemplateVariable[] = [
  {
    token: "{member}",
    label: "Member Name",
    description: "The Discord username or server display name",
    example: "StreamerSLRP",
    category: "user",
  },
  {
    token: "{game}",
    label: "Game Title",
    description: "The game being streamed on Discord",
    example: "Grand Theft Auto V",
    category: "misc",
  },
  {
    token: "{keyword}",
    label: "Matched Tag",
    description: "The matched community keyword or tag",
    example: "[SLRP]",
    category: "misc",
  },
  {
    token: "{url}",
    label: "Stream Link",
    description: "The link to the member's stream",
    example: "https://twitch.tv/streamerslrp",
    category: "misc",
  },
];

/**
 * Replaces standard placeholders in a string with sample preview data.
 */
export function formatTemplatePreview(
  template: string,
  overrides?: Partial<Record<string, string>>,
): string {
  if (!template) return "";

  const defaults: Record<string, string> = {
    "{user}": "@NewMember",
    "{user.name}": "Alex",
    "{server}": "Creator Realm",
    "{memberCount}": "1,420",
    "{channel}": "#welcome-and-rules",
    ...overrides,
  };

  let result = template;
  for (const [token, value] of Object.entries(defaults)) {
    result = result.replaceAll(token, value);
  }
  return result;
}
