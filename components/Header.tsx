"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "./AuthPage";

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

const NAV_ITEMS = [
  {
    href: "/",
    label: "AI Analysis",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  },
  {
    href: "/face-detection",
    label: "Face Detection",
    icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  },
  {
    href: "/object-detection",
    label: "Object Detection",
    icon: "M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25",
  },
  {
    href: "/live-streaming",
    label: "Live Streaming",
    icon: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z",
  },
];

export default function Header({ user, onLogout }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        {/* Logo + Brand */}
        <Link href="/" className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
              <path d="M4 10V6a2 2 0 012-2h4" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M26 4h4a2 2 0 012 2v4" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M32 26v4a2 2 0 01-2 2h-4" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10 32H6a2 2 0 01-2-2v-4" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="18" cy="18" r="7" stroke="#00e5ff" strokeWidth="1.5" opacity="0.7" />
              <circle cx="18" cy="18" r="3" fill="#00e5ff" opacity="0.5" />
              <circle cx="18" cy="18" r="1.5" fill="#fff" opacity="0.9" />
              <line x1="8" y1="18" x2="28" y2="18" stroke="#00e5ff" strokeWidth="0.5" opacity="0.3" />
              <line x1="18" y1="8" x2="18" y2="28" stroke="#00e5ff" strokeWidth="0.5" opacity="0.3" />
              <defs>
                <linearGradient id="logo-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00e5ff" />
                  <stop offset="0.5" stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 rounded-full bg-[#00e5ff]/10 blur-lg" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">
              PANOR<span className="text-[#00e5ff]">.</span><span className="text-white/60">AI</span>
            </span>
            <p className="text-[10px] text-white/20 -mt-0.5 tracking-wide">
              Intelligent Analyzer
            </p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/[0.04]">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-r from-[#ec4899]/20 to-[#8b5cf6]/20 text-white border border-white/10"
                    : "text-white/35 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="badge badge-green text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            Online
          </span>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00e5ff] to-[#8b5cf6] flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-white/70 font-medium max-w-[100px] truncate">
                {user.name}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="text-[10px] text-white/30 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-white/[0.04] px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-[#ec4899]/20 to-[#8b5cf6]/20 text-white"
                    : "text-white/35 hover:text-white/70"
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
