export interface ActionLogsConfig {
  enabled: boolean;
  defaultChannelId?: string | undefined;
  specifyPerCategory: boolean;
  individualChannels?: boolean | undefined;
  showMemberAvatars?: boolean | undefined;
  newAccountAgeDays?: number | undefined;
  eventChannels?: Record<string, string | undefined> | undefined;
  categories: {
    messages: {
      enabled: boolean;
      channelId?: string | undefined;
      events: {
        messageDelete: boolean;
        messageUpdate: boolean;
        imageDelete?: boolean;
        bulkDelete?: boolean;
        invites?: boolean;
        modCommands?: boolean;
      };
    };
    members: {
      enabled: boolean;
      channelId?: string | undefined;
      events: {
        memberJoin: boolean;
        memberLeave: boolean;
        roleUpdate: boolean;
        nicknameUpdate: boolean;
      };
    };
    moderation: {
      enabled: boolean;
      channelId?: string | undefined;
      events: {
        memberBan: boolean;
        memberUnban: boolean;
        memberTimeout: boolean;
      };
    };
    channelsAndRoles: {
      enabled: boolean;
      channelId?: string | undefined;
      events: {
        channelCreate: boolean;
        channelDelete: boolean;
        roleCreate: boolean;
        roleDelete: boolean;
      };
    };
    voice: {
      enabled: boolean;
      channelId?: string | undefined;
      events: {
        voiceJoin: boolean;
        voiceLeave: boolean;
        voiceMove: boolean;
      };
    };
  };
  ignoredChannels: string[];
  ignoredRoles: string[];
}

export const DEFAULT_ACTION_LOGS_CONFIG: ActionLogsConfig = {
  enabled: false,
  defaultChannelId: undefined,
  specifyPerCategory: false,
  individualChannels: false,
  showMemberAvatars: true,
  newAccountAgeDays: 7,
  eventChannels: {},
  categories: {
    messages: {
      enabled: true,
      channelId: undefined,
      events: {
        messageDelete: true,
        messageUpdate: true,
        imageDelete: true,
        bulkDelete: true,
        invites: true,
        modCommands: true,
      },
    },
    members: {
      enabled: true,
      channelId: undefined,
      events: {
        memberJoin: true,
        memberLeave: true,
        roleUpdate: true,
        nicknameUpdate: true,
      },
    },
    moderation: {
      enabled: true,
      channelId: undefined,
      events: {
        memberBan: true,
        memberUnban: true,
        memberTimeout: true,
      },
    },
    channelsAndRoles: {
      enabled: false,
      channelId: undefined,
      events: {
        channelCreate: true,
        channelDelete: true,
        roleCreate: true,
        roleDelete: true,
      },
    },
    voice: {
      enabled: false,
      channelId: undefined,
      events: {
        voiceJoin: true,
        voiceLeave: true,
        voiceMove: true,
      },
    },
  },
  ignoredChannels: [],
  ignoredRoles: [],
};
