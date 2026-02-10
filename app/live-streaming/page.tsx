"use client";

import Header from "@/components/Header";
import ParticleBackground from "@/components/ParticleBackground";
import AuthWrapper from "@/components/AuthWrapper";
import dynamic from "next/dynamic";

const LiveStreaming = dynamic(
  () => import("@/components/LiveStreaming"),
  { ssr: false }
);

export default function LiveStreamingPage() {
  return (
    <AuthWrapper>
      {(user, onLogout) => (
        <div className="min-h-screen relative">
          <div className="aurora-bg" />
          <div className="mesh-grid" />
          <ParticleBackground />
          <div className="fixed inset-0 z-0 pointer-events-none">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
            <div className="orb orb-4" />
          </div>

          <div className="relative z-10">
            <Header user={user} onLogout={onLogout} />

            <main className="container mx-auto px-6 py-8 max-w-6xl">
              <div className="text-center mb-8 animate-fade-in-up">
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                  <span className="gradient-text">Live Streaming</span>
                </h1>
                <p className="text-sm sm:text-base text-white/35 max-w-lg mx-auto leading-relaxed">
                  Real-time detection on webcam or external MJPEG/RTSP streams.
                  Detects faces, objects, and identifies known people.
                </p>
                <div className="flex items-center justify-center gap-2.5 mt-5">
                  <span className="badge badge-cyan">YOLOv8</span>
                  <span className="text-white/10 text-xs">+</span>
                  <span className="badge badge-purple">Face-API</span>
                  <span className="text-white/10 text-xs">+</span>
                  <span className="badge badge-pink">Descriptors</span>
                  <span className="text-white/10 text-xs">=</span>
                  <span className="badge badge-green">Full Detection</span>
                </div>
              </div>

              <div className="animate-fade-in-up h-[calc(100vh-320px)]">
                <LiveStreaming />
              </div>
            </main>

            <footer className="py-8 text-center border-t border-white/[0.03] mt-12">
              <p className="text-[11px] text-white/15 tracking-wide">
                PANOR<span className="text-[#00e5ff]/30">.</span>AI &mdash; Live Streaming & Detection
              </p>
            </footer>
          </div>
        </div>
      )}
    </AuthWrapper>
  );
}
