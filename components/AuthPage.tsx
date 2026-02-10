"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useYoloDetection, YoloDetection } from "@/lib/hooks/useYoloDetection";

export interface User {
  name: string;
  email: string;
}

interface AuthPageProps {
  onAuth: (user: User) => void;
}

type AuthTab = "login" | "signup" | "face";

// Suhas profile for face login
const SUHAS_PROFILE: User = {
  name: "Suhas R",
  email: "suhas@panorai.local",
};

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [tab, setTab] = useState<AuthTab>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Face login state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>("Initializing...");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const detectionCountRef = useRef(0);

  const { isModelLoading, modelLoaded, loadModel, detect } = useYoloDetection();

  // Reset form when tab switches
  useEffect(() => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setCameraError(null);
    setFaceDetected(false);
    setDetectionStatus("Initializing...");
    detectionCountRef.current = 0;
  }, [tab]);

  // Load YOLO model when face tab is selected
  useEffect(() => {
    if (tab === "face") {
      loadModel();
    }
  }, [tab, loadModel]);

  // Start camera when model is loaded and face tab is selected
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setDetectionStatus("Looking for Suhas...");
      }
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "Failed to access camera"
      );
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    setCameraReady(false);
  }, []);

  // Start camera when model loaded
  useEffect(() => {
    if (tab === "face" && modelLoaded) {
      startCamera();
    }
    return () => {
      if (tab !== "face") {
        stopCamera();
      }
    };
  }, [tab, modelLoaded, startCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Face detection loop
  useEffect(() => {
    if (tab !== "face" || !cameraReady || !modelLoaded || isUnlocking) return;

    let running = true;

    const runDetection = async () => {
      if (!running || isUnlocking) return;

      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        animFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const results = await detect(video, video.videoWidth, video.videoHeight);

      // Check if Suhas is detected (lowered threshold for descriptor-based recognition)
      const suhasDetection = results.find(
        (d: YoloDetection) => d.label.toLowerCase().includes("suhas") && d.confidence >= 0.5
      );

      if (suhasDetection) {
        detectionCountRef.current++;
        setFaceDetected(true);
        setDetectionStatus(`Suhas detected! (${Math.round(suhasDetection.confidence * 100)}%)`);

        // Draw detection box
        drawDetection(suhasDetection, video.videoWidth, video.videoHeight);

        // Require 3 consecutive detections to unlock (reduces false positives)
        if (detectionCountRef.current >= 3 && !isUnlocking) {
          setIsUnlocking(true);
          setDetectionStatus("Unlocking...");

          // Small delay for UX
          setTimeout(() => {
            // Ensure Suhas user exists in localStorage
            const users = JSON.parse(localStorage.getItem("panorai_users") || "[]");
            const suhasExists = users.find((u: { email: string }) => u.email === SUHAS_PROFILE.email);
            if (!suhasExists) {
              users.push({ ...SUHAS_PROFILE, password: "facelogin" });
              localStorage.setItem("panorai_users", JSON.stringify(users));
            }

            localStorage.setItem("panorai_session", JSON.stringify(SUHAS_PROFILE));
            stopCamera();
            onAuth(SUHAS_PROFILE);
          }, 800);
        }
      } else {
        detectionCountRef.current = 0;
        setFaceDetected(false);
        setDetectionStatus("Looking for Suhas...");
        clearCanvas();
      }

      if (running && !isUnlocking) {
        animFrameRef.current = requestAnimationFrame(runDetection);
      }
    };

    animFrameRef.current = requestAnimationFrame(runDetection);

    return () => {
      running = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [tab, cameraReady, modelLoaded, detect, isUnlocking, onAuth, stopCamera]);

  const drawDetection = (det: YoloDetection, videoW: number, videoH: number) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const displayW = video.clientWidth;
    const displayH = video.clientHeight;

    canvas.width = displayW;
    canvas.height = displayH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, displayW, displayH);

    const scaleX = displayW / videoW;
    const scaleY = displayH / videoH;

    // Mirror x-coordinate
    const x = displayW - (det.box.x + det.box.width) * scaleX;
    const y = det.box.y * scaleY;
    const w = det.box.width * scaleX;
    const h = det.box.height * scaleY;

    // Glow effect
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 20;

    // Bounding box
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Corner accents
    const cl = Math.min(20, w / 4, h / 4);
    ctx.lineWidth = 4;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + cl);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cl, y);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - cl, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + cl);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - cl);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + cl, y + h);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - cl, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - cl);
    ctx.stroke();

    ctx.shadowBlur = 0;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const users = JSON.parse(localStorage.getItem("panorai_users") || "[]");
      const user = users.find(
        (u: { email: string; password: string }) =>
          u.email === email.trim().toLowerCase() && u.password === password
      );

      if (!user) {
        setError("Invalid email or password");
        setIsSubmitting(false);
        return;
      }

      localStorage.setItem(
        "panorai_session",
        JSON.stringify({ name: user.name, email: user.email })
      );
      onAuth({ name: user.name, email: user.email });
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const users = JSON.parse(localStorage.getItem("panorai_users") || "[]");
      const exists = users.find(
        (u: { email: string }) => u.email === email.trim().toLowerCase()
      );

      if (exists) {
        setError("An account with this email already exists");
        setIsSubmitting(false);
        return;
      }

      const newUser = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      };

      users.push(newUser);
      localStorage.setItem("panorai_users", JSON.stringify(users));
      localStorage.setItem(
        "panorai_session",
        JSON.stringify({ name: newUser.name, email: newUser.email })
      );
      onAuth({ name: newUser.name, email: newUser.email });
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="aurora-bg" />
      <div className="mesh-grid" />
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="orb orb-4" />
      </div>

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-12 h-12"
              >
                <path d="M4 10V6a2 2 0 012-2h4" stroke="url(#auth-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M26 4h4a2 2 0 012 2v4" stroke="url(#auth-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M32 26v4a2 2 0 01-2 2h-4" stroke="url(#auth-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 32H6a2 2 0 01-2-2v-4" stroke="url(#auth-grad)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="18" cy="18" r="7" stroke="#00e5ff" strokeWidth="1.5" opacity="0.7" />
                <circle cx="18" cy="18" r="3" fill="#00e5ff" opacity="0.5" />
                <circle cx="18" cy="18" r="1.5" fill="#fff" opacity="0.9" />
                <line x1="8" y1="18" x2="28" y2="18" stroke="#00e5ff" strokeWidth="0.5" opacity="0.3" />
                <line x1="18" y1="8" x2="18" y2="28" stroke="#00e5ff" strokeWidth="0.5" opacity="0.3" />
                <defs>
                  <linearGradient id="auth-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00e5ff" />
                    <stop offset="0.5" stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 rounded-full bg-[#00e5ff]/10 blur-xl" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            PANOR<span className="text-[#00e5ff]">.</span>AI
          </h1>
          <p className="text-sm text-white/30">
            Dual AI Analysis Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/50">
          {/* Tab switcher */}
          <div className="px-8 pt-8">
            <div className="flex bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
              <button
                onClick={() => setTab("login")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                  tab === "login"
                    ? "bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white shadow-lg"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                  tab === "signup"
                    ? "bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white shadow-lg"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                Sign Up
              </button>
              <button
                onClick={() => setTab("face")}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 ${
                  tab === "face"
                    ? "bg-gradient-to-r from-[#00e5ff] to-[#8b5cf6] text-white shadow-lg"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Face
              </button>
            </div>
          </div>

          {/* Face Login */}
          {tab === "face" && (
            <div className="px-8 pt-6 pb-8">
              {/* Webcam container */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black/40 border border-white/10 mb-4">
                {/* Model loading state */}
                {isModelLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
                    <div className="text-center">
                      <div className="w-8 h-8 rounded-full border-2 border-[#00e5ff]/30 border-t-[#00e5ff] animate-spin mx-auto mb-2" />
                      <p className="text-xs text-white/60">Loading AI model...</p>
                    </div>
                  </div>
                )}

                {/* Webcam video */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                  playsInline
                  muted
                />

                {/* Detection overlay */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* Scanning animation overlay */}
                {cameraReady && !faceDetected && !isUnlocking && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-4 border-2 border-[#00e5ff]/30 rounded-lg">
                      <div
                        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent animate-pulse"
                        style={{
                          animation: "scanLine 2s ease-in-out infinite",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Camera error */}
                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center p-4">
                      <svg className="w-10 h-10 text-red-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 00-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409" />
                      </svg>
                      <p className="text-xs text-red-300">{cameraError}</p>
                    </div>
                  </div>
                )}

                {/* Unlocking animation */}
                {isUnlocking && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#00e5ff] to-[#8b5cf6] flex items-center justify-center mb-3 mx-auto animate-pulse">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-white">Welcome, Suhas!</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className={`text-center py-3 px-4 rounded-xl mb-4 ${
                faceDetected
                  ? "bg-[#00e5ff]/10 border border-[#00e5ff]/20"
                  : "bg-white/[0.03] border border-white/[0.05]"
              }`}>
                <div className="flex items-center justify-center gap-2">
                  {faceDetected ? (
                    <div className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse" />
                  ) : cameraReady ? (
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
                  )}
                  <span className={`text-sm ${faceDetected ? "text-[#00e5ff]" : "text-white/60"}`}>
                    {detectionStatus}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center">
                <p className="text-[10px] text-white/30 mb-3">
                  Position your face in front of the camera to unlock
                </p>
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="text-xs text-[#00e5ff]/60 hover:text-[#00e5ff] transition-colors"
                >
                  Use password instead
                </button>
              </div>

              {/* Scan line animation style */}
              <style jsx>{`
                @keyframes scanLine {
                  0%, 100% { top: 10%; }
                  50% { top: 90%; }
                }
              `}</style>
            </div>
          )}

          {/* Login/Signup Form */}
          {(tab === "login" || tab === "signup") && (
            <form
              onSubmit={tab === "login" ? handleLogin : handleSignup}
              className="px-8 pt-6 pb-8 space-y-4"
            >
              {/* Name (signup only) */}
              {tab === "signup" && (
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] focus:border-[#00e5ff]/30 focus:outline-none text-white/80 placeholder-white/20 text-sm transition-all"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] focus:border-[#00e5ff]/30 focus:outline-none text-white/80 placeholder-white/20 text-sm transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] focus:border-[#00e5ff]/30 focus:outline-none text-white/80 placeholder-white/20 text-sm transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Confirm Password (signup only) */}
              {tab === "signup" && (
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] focus:border-[#00e5ff]/30 focus:outline-none text-white/80 placeholder-white/20 text-sm transition-all"
                    disabled={isSubmitting}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <p className="text-xs text-red-300/80">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white text-sm font-bold shadow-lg shadow-[#ec4899]/20 hover:shadow-[#ec4899]/40 transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>{tab === "login" ? "Signing in..." : "Creating account..."}</span>
                  </div>
                ) : (
                  tab === "login" ? "Sign In" : "Create Account"
                )}
              </button>

              {/* Switch tab hint */}
              <p className="text-center text-xs text-white/25 pt-2">
                {tab === "login" ? (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setTab("signup")}
                      className="text-[#00e5ff]/60 hover:text-[#00e5ff] transition-colors"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setTab("login")}
                      className="text-[#00e5ff]/60 hover:text-[#00e5ff] transition-colors"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/15 mt-6">
          Powered by Google Gemini &amp; OpenAI GPT-4o
        </p>
      </div>
    </div>
  );
}
