export interface InviteJoinRecord {
  id: string;
  userId: string;
  userTag: string;
  userAvatar?: string | undefined;
  inviterId?: string | undefined;
  inviterTag?: string | undefined;
  inviteCode?: string | undefined;
  channelId?: string | undefined;
  channelName?: string | undefined;
  uses?: number | undefined;
  accountAgeDays: number;
  isFake: boolean;
  isBot: boolean;
  timestamp: string;
}

export interface InvitesConfig {
  enabled: boolean;
  channelId?: string | undefined;
  channelName?: string | undefined;
  trackVanity: boolean;
  trackBots: boolean;
  protectFakes: boolean;
  fakeAccountAgeDays: number;
  joinMessage: string;
  leaveMessage: string;
  fakeJoinMessage: string;
  unknownJoinMessage: string;
  recentJoins?: InviteJoinRecord[] | undefined;
}

export const DEFAULT_INVITES_CONFIG: InvitesConfig = {
  enabled: true,
  channelId: "",
  channelName: "",
  trackVanity: true,
  trackBots: false,
  protectFakes: true,
  fakeAccountAgeDays: 7,
  joinMessage: "📥 {user} joined the server using invite from **{inviter}** (now at **{invites}** invites) via `{code}`.",
  leaveMessage: "📤 {user} left the server. They were invited by **{inviter}**.",
  fakeJoinMessage: "⚠️ Suspected alt/fake account {user} joined! Account created only **{age}** days ago. Invited by **{inviter}**.",
  unknownJoinMessage: "📥 {user} joined via direct invite or vanity URL.",
  recentJoins: [],
};
