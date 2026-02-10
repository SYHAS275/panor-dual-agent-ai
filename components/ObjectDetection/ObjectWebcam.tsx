"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useYoloDetection } from "@/lib/hooks/useYoloDetection";
import type { YoloDetection } from "@/lib/hooks/useYoloDetection";
import { filterObjectDetections } from "@/lib/utils/detectionFilter";

interface ObjectWebcamProps {
  onBack: () => void;
}

export default function ObjectWebcam({ onBack }: ObjectWebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const fpsRef = useRef({ frames: 0, lastTime: Date.now(), fps: 0 });

  const { isModelLoading, modelLoaded, loadModel, detect } = useYoloDetection();
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [fps, setFps] = useState(0);

  // Load model
  useEffect(() => {
    if (!modelLoaded && !isModelLoading) loadModel();
  }, [modelLoaded, isModelLoading, loadModel]);

  // Start camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => setCameraReady(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    }

    start();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Detection loop
  const runDetection = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelLoaded || !cameraReady) {
      animFrameRef.current = requestAnimationFrame(runDetection);
      return;
    }

    const video = videoRef.current;
    const allDets = await detect(video, video.videoWidth, video.videoHeight);
    const objectsOnly = filterObjectDetections(allDets);
    setDetections(objectsOnly);

    // FPS
    fpsRef.current.frames++;
    const now = Date.now();
    if (now - fpsRef.current.lastTime >= 1000) {
      fpsRef.current.fps = fpsRef.current.frames;
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
      setFps(fpsRef.current.fps);
    }

    // Draw
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayW = video.clientWidth;
    const displayH = video.clientHeight;
    canvas.width = displayW;
    canvas.height = displayH;
    ctx.clearRect(0, 0, displayW, displayH);

    const scaleX = displayW / video.videoWidth;
    const scaleY = displayH / video.videoHeight;

    objectsOnly.forEach((det) => {
      const x = det.box.x * scaleX;
      const y = det.box.y * scaleY;
      const w = det.box.width * scaleX;
      const h = det.box.height * scaleY;

      const hue = det.confidence > 0.7 ? 160 : det.confidence > 0.4 ? 40 : 0;
      const color = `hsl(${hue}, 100%, 60%)`;

      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      ctx.shadowBlur = 0;
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.06)`;
      ctx.fillRect(x, y, w, h);

      // Corner accents
      const cl = Math.min(w, h, 18);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y);
      ctx.moveTo(x + w - cl, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cl);
      ctx.moveTo(x + w, y + h - cl); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cl, y + h);
      ctx.moveTo(x + cl, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cl);
      ctx.stroke();

      // Label
      const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 11px Inter, sans-serif";
      const tw = ctx.measureText(label).width + 10;
      const ly = y > 22 ? y - 22 : y + 2;
      ctx.fillStyle = "rgba(6, 6, 12, 0.85)";
      ctx.fillRect(x, ly, tw, 20);
      ctx.fillStyle = color;
      ctx.fillText(label, x + 5, ly + 14);
    });

    animFrameRef.current = requestAnimationFrame(runDetection);
  }, [detect, modelLoaded, cameraReady]);

  useEffect(() => {
    if (modelLoaded && cameraReady) {
      animFrameRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [modelLoaded, cameraReady, runDetection]);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-xl"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />

        {/* FPS Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="badge badge-cyan text-[10px]">{fps} FPS</span>
          <span className="badge badge-green text-[10px]">{detections.length} Objects</span>
        </div>

        {/* Loading overlay */}
        {(!modelLoaded || !cameraReady) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
            <div className="text-center">
              <div className="w-10 h-10 spinner mx-auto mb-3" />
              <p className="text-sm text-white/50">
                {!modelLoaded ? "Loading YOLO model..." : "Starting camera..."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Detection list */}
      {detections.length > 0 && (
        <div className="p-4 border-t border-white/[0.04]">
          <div className="flex flex-wrap gap-2">
            {detections.map((det, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs"
              >
                <span className="text-white/80">{det.label}</span>
                <span className="text-white/30">{(det.confidence * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
