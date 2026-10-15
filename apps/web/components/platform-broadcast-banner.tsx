"use client";

import React, { useEffect, useState } from 'react';
import { Wrench, AlertTriangle, Flame, Info, ExternalLink, X } from 'lucide-react';

interface BannerData {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'MAINTENANCE';
  target_platforms: 'ALL' | 'MAIN_SITE' | 'BOT_WEB';
  link_url: string | null;
  link_text: string | null;
  is_active: number;
  dismissible: number;
}

interface PlatformBroadcastBannerProps {
  platform?: 'MAIN_SITE' | 'BOT_WEB';
  adminApiUrl?: string;
}

export function PlatformBroadcastBanner({
  platform = 'BOT_WEB',
  adminApiUrl = 'http://localhost:3002',
}: PlatformBroadcastBannerProps) {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkBanner() {
      try {
        const res = await fetch(`${adminApiUrl}/api/banner?platform=${platform}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.banner && isMounted) {
            const dismissed = sessionStorage.getItem(`darklin3_banner_${data.banner.id}`);
            if (dismissed === 'true') {
              setIsDismissed(true);
            } else {
              setBanner(data.banner);
              setIsDismissed(false);
            }
          } else if (isMounted) {
            setBanner(null);
          }
        }
      } catch {
        // Quietly ignore if admin server is unreachable
      }
    }

    checkBanner();
    const interval = setInterval(checkBanner, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [platform, adminApiUrl]);

  if (!banner || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(`darklin3_banner_${banner.id}`, 'true');
    } catch {
      // ignore
    }
  };

  const getStyle = () => {
    switch (banner.severity) {
      case 'CRITICAL':
        return {
          wrapper: 'bg-red-950/95 border-b border-red-700/80 text-red-100',
          badge: 'bg-red-500/20 text-red-200 border-red-500/40',
          btn: 'bg-red-500/20 hover:bg-red-500/30 text-white border-red-400/40',
          icon: Flame,
          label: 'CRITICAL ALERT',
        };
      case 'WARNING':
        return {
          wrapper: 'bg-amber-950/95 border-b border-amber-700/80 text-amber-100',
          badge: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
          btn: 'bg-amber-500/20 hover:bg-amber-500/30 text-white border-amber-400/40',
          icon: AlertTriangle,
          label: 'NOTICE',
        };
      case 'INFO':
        return {
          wrapper: 'bg-blue-950/95 border-b border-blue-700/80 text-blue-100',
          badge: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
          btn: 'bg-blue-500/20 hover:bg-blue-500/30 text-white border-blue-400/40',
          icon: Info,
          label: 'ANNOUNCEMENT',
        };
      case 'MAINTENANCE':
      default:
        return {
          wrapper: 'bg-orange-950/95 border-b border-orange-700/80 text-orange-100',
          badge: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
          btn: 'bg-orange-500/20 hover:bg-orange-500/30 text-white border-orange-400/40',
          icon: Wrench,
          label: 'MAINTENANCE',
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  return (
    <div
      role="alert"
      className={`relative z-50 w-full px-4 py-2.5 backdrop-blur-md transition-all animate-in slide-in-from-top-full duration-300 font-mono ${style.wrapper}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-black/40 border border-white/10 shrink-0">
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold tracking-tight text-white">{banner.title}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border uppercase font-semibold ${style.badge}`}>
              {style.label}
            </span>
            <span className="text-white/85 text-[11px] leading-tight">{banner.message}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {banner.link_text && banner.link_url && (
            <a
              href={banner.link_url}
              target="_blank"
              rel="noreferrer"
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border flex items-center gap-1 transition-colors cursor-pointer ${style.btn}`}
            >
              <span>{banner.link_text}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {banner.dismissible === 1 && (
            <button
              onClick={handleDismiss}
              className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
              title="Dismiss announcement"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
