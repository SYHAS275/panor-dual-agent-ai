"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useYoloDetection, YoloDetection } from "@/lib/hooks/useYoloDetection";
import { filterFaceDetections } from "@/lib/utils/detectionFilter";

interface FaceWebcamProps {
  onBack: () => void;
}

export default function FaceWebcam({ onBack }: FaceWebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const { isModelLoading, modelLoaded, error: modelError, loadModel, detect } =
    useYoloDetection();

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const fpsRef = useRef({ frames: 0, lastTime: performance.now() });
  const detectionsRef = useRef<YoloDetection[]>([]);

  // Load YOLO model on mount
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Start camera
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
      }
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "Failed to access camera"
      );
    }
  }, []);

  // Start camera when model is loaded
  useEffect(() => {
    if (modelLoaded) {
      startCamera();
    }
  }, [modelLoaded, startCamera]);

  // Detection loop
  useEffect(() => {
    if (!cameraReady || !modelLoaded) return;

    setIsRunning(true);
    let running = true;

    const runDetection = async () => {
      if (!running) return;

      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        animFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const allResults = await detect(video, video.videoWidth, video.videoHeight);
      const results = filterFaceDetections(allResults);
      detectionsRef.current = results;
      setDetections(results);

      // Draw boxes
      drawDetections(results, video.videoWidth, video.videoHeight);

      // FPS counter
      fpsRef.current.frames++;
      const now = performance.now();
      if (now - fpsRef.current.lastTime >= 1000) {
        setFps(fpsRef.current.frames);
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = now;
      }

      if (running) {
        animFrameRef.current = requestAnimationFrame(runDetection);
      }
    };

    animFrameRef.current = requestAnimationFrame(runDetection);

    return () => {
      running = false;
      setIsRunning(false);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [cameraReady, modelLoaded, detect]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const drawDetections = (
    dets: YoloDetection[],
    videoW: number,
    videoH: number
  ) => {
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

    dets.forEach((det) => {
      // Mirror x-coordinate to match the CSS-mirrored video
      const x = displayW - (det.box.x + det.box.width) * scaleX;
      const y = det.box.y * scaleY;
      const w = det.box.width * scaleX;
      const h = det.box.height * scaleY;
      const conf = Math.round(det.confidence * 100);
      const label = `${det.label.toUpperCase()} ${conf}%`;

      // --- Bounding box ---
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, w, h);

      // Semi-transparent fill
      ctx.fillStyle = "rgba(0, 229, 255, 0.08)";
      ctx.fillRect(x, y, w, h);

      // --- Corner accents ---
      const cl = Math.min(14, w / 4, h / 4);
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 3;
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

      // --- Name label (solid cyan bar + dark text) ---
      ctx.save();
      ctx.font = "bold 14px Arial, sans-serif";
      const tm = ctx.measureText(label);
      const lw = tm.width + 16;
      const lh = 28;
      // Place above box; if not enough room, place inside top
      const ly = y >= lh + 2 ? y - lh : y;

      // Cyan background bar
      ctx.fillStyle = "#00e5ff";
      ctx.fillRect(x, ly, lw, lh);

      // Dark text on cyan
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 8, ly + lh / 2);
      ctx.restore();
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Back to Face Recognition
      </button>

      {/* Model loading state */}
      {isModelLoading && (
        <div className="glass-card rounded-2xl p-10 text-center animate-scale-in">
          <div className="w-14 h-14 spinner mx-auto mb-5" />
          <h3 className="text-lg font-semibold text-white mb-1">
            Loading YOLO Detection Model
          </h3>
          <p className="text-sm text-white/30">
            Loading ONNX model for real-time face detection (~12 MB)
          </p>
          <div className="typing-dots mt-4">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {/* Errors */}
      {(modelError || cameraError) && (
        <div className="glass-card rounded-2xl p-5 border border-red-500/20">
          <p className="text-sm text-red-300/80">
            {modelError || cameraError}
          </p>
        </div>
      )}

      {/* Webcam feed */}
      {modelLoaded && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Status bar */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#00e5ff]/10 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-[#00e5ff]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">
                    Live Webcam Detection
                  </p>
                  <p className="text-xs text-white/20">
                    YOLOv8 ONNX &middot; Real-time
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isRunning && (
                  <span className="text-[10px] text-[#00e5ff] bg-[#00e5ff]/10 px-2 py-1 rounded-full flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff] animate-pulse" />
                    {fps} FPS
                  </span>
                )}
                {detections.length > 0 && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                    {detections.length} detected
                  </span>
                )}
                {cameraReady && !isRunning && (
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full animate-pulse">
                    Starting...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Video container */}
          <div className="glass-card rounded-2xl overflow-hidden webcam-container">
            <div className="relative w-full">
              <video
                ref={videoRef}
                className="w-full h-auto max-h-[500px] object-contain bg-black/60 mirror-video"
                playsInline
                muted
                autoPlay
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />

              {/* Camera not ready overlay */}
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="text-center">
                    <div className="w-10 h-10 spinner mx-auto mb-3" />
                    <p className="text-sm text-white/40">
                      Accessing camera...
                    </p>
                  </div>
                </div>
              )}

              {/* No detections indicator */}
              {cameraReady && isRunning && detections.length === 0 && (
                <div className="webcam-scan-overlay" />
              )}
            </div>
          </div>

          {/* Detection results */}
          {detections.length > 0 && (
            <div className="glass-card rounded-2xl p-4 animate-scale-in">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Recognized Faces
                  </p>
                  <p className="text-xs text-white/20">
                    Real-time YOLO detections
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {detections.map((det, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#00e5ff]/5 border border-[#00e5ff]/20"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#00e5ff]" />
                    <span className="text-sm font-medium text-[#00e5ff] capitalize">
                      {det.label}
                    </span>
                    <span className="text-[10px] text-white/30">
                      {Math.round(det.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <p className="text-[10px] text-white/10 text-center">
            YOLOv8 detection runs entirely in your browser via ONNX Runtime
            WebAssembly. No data is sent to any server.
          </p>
        </div>
      )}
    </div>
  );
}
