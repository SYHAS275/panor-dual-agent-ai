"use client";

import Header from "@/components/Header";
import ParticleBackground from "@/components/ParticleBackground";
import AuthWrapper from "@/components/AuthWrapper";
import dynamic from "next/dynamic";

const ObjectDetection = dynamic(
  () => import("@/components/ObjectDetection"),
  { ssr: false }
);

export default function ObjectDetectionPage() {
  return (
    <AuthWrapper>
      {(user, onLogout) => (
        <div className="min-h-screen relative">
          {/* Background */}
          <div className="aurora-bg" />
          <div className="mesh-grid" />
          <ParticleBackground />
          <div className="fixed inset-0 z-0 pointer-events-none">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />
            <div className="orb orb-4" />
          </div>

          {/* Content */}
          <div className="relative z-10">
            <Header user={user} onLogout={onLogout} />

            <main className="container mx-auto px-6 py-8 max-w-6xl">
              {/* Hero */}
              <div className="text-center mb-8 animate-fade-in-up">
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                  <span className="gradient-text">Object Detection</span>
                </h1>
                <p className="text-sm sm:text-base text-white/35 max-w-lg mx-auto leading-relaxed">
                  Detect and identify objects in images or through your webcam.
                  Upload a photo or use real-time webcam detection &mdash; faces are filtered out.
                </p>
                <div className="flex items-center justify-center gap-2.5 mt-5">
                  <span className="badge badge-cyan">YOLOv8</span>
                  <span className="text-white/10 text-xs">+</span>
                  <span className="badge badge-purple">ONNX Runtime</span>
                  <span className="text-white/10 text-xs">+</span>
                  <span className="badge badge-green">Objects Only</span>
                </div>
              </div>

              {/* Object Detection Component */}
              <div className="animate-fade-in-up">
                <ObjectDetection />
              </div>
            </main>

            <footer className="py-8 text-center border-t border-white/[0.03] mt-12">
              <p className="text-[11px] text-white/15 tracking-wide">
                PANOR<span className="text-[#00e5ff]/30">.</span>AI &mdash; Object Detection
              </p>
            </footer>
          </div>
        </div>
      )}
    </AuthWrapper>
  );
}
