"use client";

import { useState, useEffect, ReactNode } from "react";
import type { User } from "./AuthPage";
import dynamic from "next/dynamic";

const AuthPage = dynamic(() => import("@/components/AuthPage"), { ssr: false });

interface AuthWrapperProps {
  children: (user: User, onLogout: () => void) => ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("panorai_session");
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch {
        localStorage.removeItem("panorai_session");
      }
    }
    setIsChecking(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("panorai_session");
    setUser(null);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000000]">
        <div className="text-center">
          <div className="w-12 h-12 spinner mx-auto mb-4" />
          <p className="text-sm text-white/30">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={(u: User) => setUser(u)} />;
  }

  return <>{children(user, handleLogout)}</>;
}
