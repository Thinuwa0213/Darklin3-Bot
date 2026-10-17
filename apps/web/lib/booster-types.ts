export interface BoosterConfig {
  enabled: boolean;
  channelId?: string | undefined;
  useEmbed: boolean;
  pingUser: boolean;
  title: string;
  message: string;
  accentColor: string;
  bannerUrl?: string | undefined;
  thankYouDm: boolean;
  thankYouDmMessage?: string | undefined;
  customBranding?: boolean | undefined;
  customFooterText?: string | undefined;
  customFooterIconUrl?: string | undefined;
}

export const DEFAULT_BOOSTER_CONFIG: BoosterConfig = {
  enabled: false,
  channelId: undefined,
  useEmbed: true,
  pingUser: true,
  title: "🚀 NEW SERVER BOOST!",
  message: "A massive thank you to {user} for boosting {server}! We have now reached **{boost_count} boosts**! 🎉",
  accentColor: "#F43F5E",
  bannerUrl: undefined,
  thankYouDm: false,
  thankYouDmMessage: "Thank you for boosting {server}! Your support helps unlock higher audio quality, custom emojis, and more server perks! 💖",
  customBranding: false,
  customFooterText: undefined,
  customFooterIconUrl: undefined,
};
