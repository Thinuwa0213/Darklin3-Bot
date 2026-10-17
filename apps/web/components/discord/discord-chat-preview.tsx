"use client";

import * as React from "react";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DiscordEmbedField {
  name: string;
  value: React.ReactNode;
  inline?: boolean | undefined;
}

export interface DiscordEmbedProps {
  color?: string | undefined;
  author?: {
    name: string;
    iconUrl?: string | null | undefined;
    url?: string | undefined;
  } | undefined;
  title?: string | undefined;
  titleUrl?: string | undefined;
  description?: React.ReactNode | undefined;
  fields?: DiscordEmbedField[] | undefined;
  thumbnailUrl?: string | null | undefined;
  bannerUrl?: string | null | undefined;
  footer?: {
    text?: string | null | undefined;
    iconUrl?: string | null | undefined;
  } | undefined;
  timestamp?: string | boolean | undefined;
}

export interface DiscordChatPreviewProps {
  channelName?: string | undefined;
  botName?: string | undefined;
  botAvatarUrl?: string | null | undefined;
  timestamp?: string | undefined;
  mention?: string | undefined;
  messageContent?: React.ReactNode | undefined;
  embed?: DiscordEmbedProps | undefined;
  children?: React.ReactNode | undefined;
  actions?: React.ReactNode | undefined;
  containerClassName?: string | undefined;
  headerRightSlot?: React.ReactNode | undefined;
}

export function DiscordAppBadge({ className }: { className?: string | undefined }) {
  return (
    <span
      className={cn(
        "bg-[#5865F2] text-white text-[10px] font-semibold px-1 py-0.2 rounded inline-flex items-center gap-0.5 leading-tight tracking-wide shrink-0",
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="w-2.5 h-2.5 fill-current shrink-0"
        aria-hidden="true"
      >
        <path d="M6.3 12.3 2.7 8.7l1.4-1.4 2.2 2.2 6.6-6.6 1.4 1.4z" />
      </svg>
      APP
    </span>
  );
}

export function DiscordChatPreview({
  channelName = "announcements",
  botName = "Darklin3 Bot",
  botAvatarUrl,
  timestamp,
  mention,
  messageContent,
  embed,
  children,
  actions,
  containerClassName,
  headerRightSlot,
}: DiscordChatPreviewProps) {
  // Format dynamic time fallback safely on client
  const [clientTime, setClientTime] = React.useState<string>("Today at 8:42 PM");

  React.useEffect(() => {
    try {
      const now = new Date();
      const formatted = now.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      setClientTime(`Today at ${formatted}`);
    } catch {
      // fallback
    }
  }, []);

  const displayTime = timestamp || clientTime;
  const cleanChannel = channelName ? channelName.replace(/^#+/, "") : "announcements";

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800/90 bg-[#313338] text-[#dbdee1] shadow-2xl overflow-hidden font-sans select-none",
        containerClassName,
      )}
    >
      {/* 1. Discord Channel Bar Header (Authentic 2024 UI - No fake Mac OS traffic lights) */}
      <div className="bg-[#2B2D31] px-4 py-2.5 flex items-center justify-between border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-zinc-400 shrink-0" />
          <span className="text-xs font-semibold text-zinc-200">
            {cleanChannel}
          </span>
        </div>

        {headerRightSlot ? (
          headerRightSlot
        ) : (
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
            Discord Live Preview
          </span>
        )}
      </div>

      {/* 2. Chat Message Row */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3.5">
          {/* Bot Avatar with Active Online Status Indicator */}
          <div className="relative shrink-0 mt-0.5">
            <div className="w-10 h-10 rounded-full bg-[#5865F2] overflow-hidden flex items-center justify-center font-bold text-xs text-white border border-white/5 shadow-xs">
              {botAvatarUrl ? (
                <img
                  src={botAvatarUrl}
                  alt={botName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src="/logo-icon.png"
                  alt={botName}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#313338] flex items-center justify-center"
              title="Online"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#23a55a] block" />
            </span>
          </div>

          {/* Message Area */}
          <div className="flex-1 min-w-0 space-y-2">

            {/* Author Row with official APP badge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-white hover:underline cursor-pointer">
                {botName}
              </span>
              <DiscordAppBadge />
              <span suppressHydrationWarning className="text-[11px] text-[#949ba4] font-mono ml-0.5">
                {displayTime}
              </span>
            </div>

            {/* Optional Ping / Mention */}
            {mention && (
              <p className="text-xs text-[#c9cdfb] bg-[#5865f2]/20 px-1.5 py-0.5 rounded inline-block font-medium hover:bg-[#5865f2] hover:text-white transition-colors cursor-pointer">
                {mention}
              </p>
            )}

            {/* Main Message Content */}
            {messageContent && (
              <div className="text-[14px] text-[#dbdee1] leading-relaxed break-words font-sans">
                {messageContent}
              </div>
            )}

            {/* Structured Discord Embed */}
            {embed && (
              <div
                className="rounded-md border-l-4 bg-[#2b2d31] p-3.5 space-y-3 text-xs shadow-xs max-w-xl"
                style={{ borderLeftColor: embed.color || "#5865F2" }}
              >
                {/* Author Info */}
                {embed.author && (
                  <div className="flex items-center gap-2">
                    {embed.author.iconUrl && (
                      <img
                        src={embed.author.iconUrl}
                        alt="Author icon"
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                    )}
                    <span className="text-xs font-semibold text-white">
                      {embed.author.name}
                    </span>
                  </div>
                )}

                {/* Title & Thumbnail Grid */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    {embed.title && (
                      <h4 className="text-sm font-bold text-white leading-snug">
                        {embed.titleUrl ? (
                          <a
                            href={embed.titleUrl}
                            onClick={(e) => e.preventDefault()}
                            className="text-[#00a8fc] hover:underline"
                          >
                            {embed.title}
                          </a>
                        ) : (
                          embed.title
                        )}
                      </h4>
                    )}

                    {embed.description && (
                      <div className="text-xs text-[#dbdee1] leading-relaxed whitespace-pre-wrap break-words">
                        {embed.description}
                      </div>
                    )}
                  </div>

                  {embed.thumbnailUrl && (
                    <img
                      src={embed.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-16 h-16 rounded-md object-cover shrink-0 ring-1 ring-white/10"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  )}
                </div>

                {/* Embed Fields */}
                {embed.fields && embed.fields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {embed.fields.map((field, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "space-y-0.5",
                          field.inline ? "col-span-1" : "col-span-1 sm:col-span-2",
                        )}
                      >
                        <span className="text-[11px] font-bold text-white block">
                          {field.name}
                        </span>
                        <div className="text-xs text-[#dbdee1] leading-relaxed">
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Banner Image */}
                {embed.bannerUrl && (
                  <div className="rounded-md overflow-hidden max-h-56 border border-white/5 mt-2">
                    <img
                      src={embed.bannerUrl}
                      alt="Embed Banner"
                      className="w-full h-auto object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                {/* Footer Bar */}
                {(embed.footer?.text || embed.timestamp) && (
                  <div className="pt-2 flex items-center gap-2 text-[10px] text-[#949ba4] font-mono border-t border-white/5 flex-wrap">
                    {embed.footer?.iconUrl && (
                      <img
                        src={embed.footer.iconUrl}
                        alt="Footer Icon"
                        className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                      />
                    )}
                    {embed.footer?.text && <span>{embed.footer.text}</span>}
                    {embed.footer?.text && embed.timestamp && <span>•</span>}
                    {embed.timestamp && (
                      <span>
                        {typeof embed.timestamp === "string"
                          ? embed.timestamp
                          : displayTime}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Custom Children (e.g. Canvas Card, Custom Embed Layouts) */}
            {children}

            {/* Action Row (Buttons, Select Menus) */}
            {actions && <div className="pt-1.5">{actions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
