"use client";

import * as React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Smile, X, ChevronDown, Loader2 } from "lucide-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Theme, EmojiStyle, Categories } from "emoji-picker-react";

// Dynamically import Picker with SSR disabled for optimal performance & hydration safety in Next.js
const DynamicPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 text-xs text-muted-foreground gap-2 h-80 bg-[#1e1f22]">
      <Loader2 className="h-5 w-5 animate-spin text-[#5865F2]" />
      <span>Loading Discord Emoji Picker...</span>
    </div>
  ),
});

export interface LiveDiscordCustomEmoji {
  id: string;
  name: string;
  animated?: boolean;
}

export interface CustomEmojiItem {
  id: string;
  names: string[];
  imgUrl: string;
  group?: string;
}

export interface EmojiPickerProps {
  id?: string;
  value?: string;
  onChange: (emoji: string) => void;
  customEmojis?: LiveDiscordCustomEmoji[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Parses Discord custom emoji string (<:name:id> or <a:name:id>) into parts
 */
export function parseDiscordCustomEmoji(val: string): { name: string; id: string; animated: boolean } | null {
  if (!val) return null;
  const match = val.match(/^<(a)?:([a-zA-Z0-9_~]+):(\d+)>$/);
  if (!match || !match[2] || !match[3]) return null;
  return {
    animated: Boolean(match[1]),
    name: match[2],
    id: match[3],
  };
}

export function EmojiPicker({
  id,
  value = "",
  onChange,
  customEmojis = [],
  placeholder = "Select emoji...",
  disabled = false,
  className = "",
}: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Format Discord server custom emojis for emoji-picker-react
  const formattedCustomEmojis = useMemo<CustomEmojiItem[]>(() => {
    if (!customEmojis || customEmojis.length === 0) return [];
    return customEmojis.map((e) => ({
      id: e.id,
      names: [e.name],
      imgUrl: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}?size=48&quality=lossless`,
      group: "Server Emojis",
    }));
  }, [customEmojis]);

  // Configure category order (show Server Emojis first if available)
  const categoriesConfig = useMemo(() => {
    if (formattedCustomEmojis.length === 0) return undefined;
    return [
      {
        category: Categories.CUSTOM,
        name: "Server Emojis",
      },
      {
        category: Categories.SUGGESTED,
        name: "Frequently Used",
      },
      {
        category: Categories.SMILEYS_PEOPLE,
        name: "Smileys & People",
      },
      {
        category: Categories.ANIMALS_NATURE,
        name: "Animals & Nature",
      },
      {
        category: Categories.FOOD_DRINK,
        name: "Food & Drink",
      },
      {
        category: Categories.ACTIVITIES,
        name: "Activities",
      },
      {
        category: Categories.TRAVEL_PLACES,
        name: "Travel & Places",
      },
      {
        category: Categories.OBJECTS,
        name: "Objects",
      },
      {
        category: Categories.SYMBOLS,
        name: "Symbols",
      },
      {
        category: Categories.FLAGS,
        name: "Flags",
      },
    ];
  }, [formattedCustomEmojis.length]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (emojiData.isCustom) {
      // Find matching server emoji to preserve animated status
      const match = customEmojis.find(
        (c) => c.id === emojiData.unified || c.name === emojiData.names[0],
      );
      const isAnimated = match?.animated ?? false;
      const emojiId = match?.id ?? emojiData.unified;
      const emojiName = match?.name ?? emojiData.names[0] ?? "emoji";
      onChange(`<${isAnimated ? "a" : ""}:${emojiName}:${emojiId}>`);
    } else {
      // Standard Unicode emoji
      onChange(emojiData.emoji);
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  // Preview formatting for trigger button
  const customParsed = parseDiscordCustomEmoji(value);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full ${isOpen ? "z-50" : "z-auto"} ${className}`}
    >
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-9 rounded-lg border border-input/80 bg-background/90 px-3 py-1.5 text-xs shadow-xs flex items-center justify-between gap-2 transition-all cursor-pointer hover:border-border focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary ${
          isOpen ? "border-primary ring-1 ring-primary/40 bg-background shadow-md" : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {customParsed ? (
            <img
              src={`https://cdn.discordapp.com/emojis/${customParsed.id}.${
                customParsed.animated ? "gif" : "png"
              }?size=32`}
              alt={customParsed.name}
              className="h-4 w-4 object-contain shrink-0 rounded-xs"
            />
          ) : value ? (
            <span className="text-base leading-none shrink-0">{value}</span>
          ) : (
            <Smile className="h-4 w-4 text-muted-foreground shrink-0" />
          )}

          {customParsed ? (
            <span className="truncate text-xs text-muted-foreground font-mono">
              :{customParsed.name}:
            </span>
          ) : !value ? (
            <span className="truncate text-xs text-muted-foreground">
              {placeholder}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange("");
                }
              }}
              title="Clear emoji"
              className="p-0.5 rounded hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Discord-Styled Emoji Picker Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 top-full mt-1.5 rounded-xl border border-[#383a40] bg-[#1e1f22] text-[#dbdee1] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/50">
          <DynamicPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.TWITTER}
            lazyLoadEmojis={true}
            searchPlaceHolder="Search Discord & Unicode emojis..."
            width={340}
            height={420}
            previewConfig={{
              showPreview: true,
              defaultCaption: "Pick an emoji for this role",
            }}
            {...(formattedCustomEmojis.length > 0 ? { customEmojis: formattedCustomEmojis as any } : {})}
            {...(categoriesConfig ? { categories: categoriesConfig as any } : {})}
          />
        </div>
      )}
    </div>
  );
}
