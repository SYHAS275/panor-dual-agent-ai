"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useYoloDetection, YoloDetection } from "@/lib/hooks/useYoloDetection";

type StreamSource = "browser" | "external";

interface StreamConfig {
  externalUrl: string;
}

const DEFAULT_CONFIG: StreamConfig = {
  externalUrl: "http://localhost:8080/video",
};

// Check if URL is local network (doesn't need proxy)
const isLocalNetworkUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.")
    );
  } catch {
    return false;
  }
};

// Check if URL requires proxy (ngrok, tunnels, etc.)
const requiresProxy = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname.includes("ngrok") ||
      hostname.includes("ngrok-free") ||
      hostname.includes("tunnel") ||
      hostname.includes("localtunnel") ||
      hostname.includes("serveo") ||
      hostname.includes("cloudflare")
    );
  } catch {
    return false;
  }
};

export default function LiveStreaming() {
  const [source, setSource] = useState<StreamSource>("browser");
  const [config, setConfig] = useState<StreamConfig>(DEFAULT_CONFIG);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [fps, setFps] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [retryKey, setRetryKey] = useState(0); // Force image reload on retry

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const externalOverlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const externalAnimFrameRef = useRef<number>(0);
  const fpsCounterRef = useRef({ frames: 0, lastTime: Date.now() });

  const { isModelLoading, modelLoaded, loadModel, detect } = useYoloDetection();

  // Load model on mount
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Start browser webcam
  const startBrowserStream = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to access camera");
    }
  }, []);

  // Start external MJPEG stream
  const startExternalStream = useCallback(async () => {
    try {
      setError(null);
      // For MJPEG streams, we use an img element approach with canvas capture
      // But for video processing, we need frames - so we'll use a workaround
      setIsStreaming(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to stream");
    }
  }, []);

  // Stop stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (externalAnimFrameRef.current) {
      cancelAnimationFrame(externalAnimFrameRef.current);
      externalAnimFrameRef.current = 0;
    }
    setIsStreaming(false);
    setDetections([]);
    setFps(0);
  }, []);

  // Toggle stream
  const toggleStream = useCallback(() => {
    if (isStreaming) {
      stopStream();
    } else {
      if (source === "browser") {
        startBrowserStream();
      } else {
        startExternalStream();
      }
    }
  }, [isStreaming, source, startBrowserStream, startExternalStream, stopStream]);

  // Connect to URL
  const connectToUrl = useCallback(() => {
    if (!urlInput.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    const trimmedUrl = urlInput.trim();

    // Validate URL
    try {
      new URL(trimmedUrl);
    } catch {
      setError("Invalid URL format");
      return;
    }

    // Auto-enable proxy for ngrok and tunnel URLs (they have interstitial pages)
    const isNgrok = requiresProxy(trimmedUrl);
    if (isNgrok) {
      setUseProxy(true);
      // Auto-open ngrok URL in new tab to accept the warning
      window.open(trimmedUrl, "_blank");
      // Show message and start streaming after delay
      setError("Opening ngrok URL in new tab... Accept the warning, then the stream will connect automatically.");
    }

    setConfig({ externalUrl: trimmedUrl });
    setSource("external");
    setShowUrlInput(false);

    // Delay streaming start for ngrok to allow user to accept warning
    if (isNgrok) {
      setTimeout(() => {
        setError(null);
        setIsStreaming(true);
      }, 3000); // 3 second delay for user to accept ngrok warning
    } else {
      setError(null);
      setIsStreaming(true);
    }
  }, [urlInput]);

  // Detection loop
  useEffect(() => {
    if (!isStreaming || !modelLoaded || source === "external") return;

    let running = true;

    const runDetection = async () => {
      if (!running) return;

      const video = videoRef.current;
      if (!video || video.videoWidth === 0) {
        animFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      try {
        const results = await detect(video, video.videoWidth, video.videoHeight);
        setDetections(results);

        // Draw overlay
        drawOverlay(results, video.videoWidth, video.videoHeight);

        // FPS counter
        fpsCounterRef.current.frames++;
        const now = Date.now();
        if (now - fpsCounterRef.current.lastTime >= 1000) {
          setFps(fpsCounterRef.current.frames);
          fpsCounterRef.current.frames = 0;
          fpsCounterRef.current.lastTime = now;
        }
      } catch (err) {
        console.error("Detection error:", err);
      }

      if (running) {
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
  }, [isStreaming, modelLoaded, source, detect]);

  // Detection loop for external streams (capture img to canvas)
  useEffect(() => {
    if (!isStreaming || !modelLoaded || source !== "external") return;

    let running = true;

    const runExternalDetection = async () => {
      if (!running) return;

      const img = imgRef.current;
      const captureCanvas = captureCanvasRef.current;

      if (!img || !captureCanvas || img.naturalWidth === 0) {
        externalAnimFrameRef.current = requestAnimationFrame(runExternalDetection);
        return;
      }

      try {
        // Set canvas size to match image
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;
        captureCanvas.width = imgWidth;
        captureCanvas.height = imgHeight;

        // Draw img to canvas for detection
        const ctx = captureCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

          // Run detection on the canvas
          const results = await detect(captureCanvas, imgWidth, imgHeight);
          setDetections(results);

          // Draw overlay on external stream
          drawExternalOverlay(results, imgWidth, imgHeight);

          // FPS counter
          fpsCounterRef.current.frames++;
          const now = Date.now();
          if (now - fpsCounterRef.current.lastTime >= 1000) {
            setFps(fpsCounterRef.current.frames);
            fpsCounterRef.current.frames = 0;
            fpsCounterRef.current.lastTime = now;
          }
        }
      } catch (err) {
        console.error("External detection error:", err);
      }

      if (running) {
        // Use setTimeout for better performance with MJPEG streams
        setTimeout(() => {
          if (running) {
            externalAnimFrameRef.current = requestAnimationFrame(runExternalDetection);
          }
        }, 100); // ~10 FPS for external streams to reduce load
      }
    };

    externalAnimFrameRef.current = requestAnimationFrame(runExternalDetection);

    return () => {
      running = false;
      if (externalAnimFrameRef.current) {
        cancelAnimationFrame(externalAnimFrameRef.current);
      }
    };
  }, [isStreaming, modelLoaded, source, detect]);

  // Draw overlay for external stream
  const drawExternalOverlay = (dets: YoloDetection[], imgWidth: number, imgHeight: number) => {
    const canvas = externalOverlayRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const displayW = img.clientWidth;
    const displayH = img.clientHeight;

    canvas.width = displayW;
    canvas.height = displayH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, displayW, displayH);

    const scaleX = displayW / imgWidth;
    const scaleY = displayH / imgHeight;

    dets.forEach((det) => {
      const isSuhas = det.label.toLowerCase().includes("suhas");
      const color = isSuhas ? "#00e5ff" : "#ec4899";

      // No mirroring for external stream
      const x = det.box.x * scaleX;
      const y = det.box.y * scaleY;
      const w = det.box.width * scaleX;
      const h = det.box.height * scaleY;

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;

      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Corner accents
      const cl = Math.min(15, w / 4, h / 4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;

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

      // Label background
      const label = `${det.label} ${Math.round(det.confidence * 100)}%`;
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const labelHeight = 20;
      const labelY = y > labelHeight + 5 ? y - labelHeight - 5 : y + h + 5;

      ctx.fillStyle = color + "dd";
      ctx.fillRect(x, labelY, textWidth + 12, labelHeight);

      // Label text
      ctx.fillStyle = "#000";
      ctx.fillText(label, x + 6, labelY + 14);

      // Age/Gender if available
      if (det.age || det.gender) {
        const info = [det.gender, det.age ? `${det.age}y` : ""].filter(Boolean).join(", ");
        if (info) {
          ctx.font = "10px Inter, system-ui, sans-serif";
          const infoWidth = ctx.measureText(info).width;
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(x, labelY + labelHeight, infoWidth + 10, 16);
          ctx.fillStyle = "#fff";
          ctx.fillText(info, x + 5, labelY + labelHeight + 11);
        }
      }
    });
  };

  // Draw detection overlay
  const drawOverlay = (dets: YoloDetection[], videoW: number, videoH: number) => {
    const canvas = overlayCanvasRef.current;
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
      const isSuhas = det.label.toLowerCase().includes("suhas");
      const color = isSuhas ? "#00e5ff" : "#ec4899";

      // Mirror x-coordinate for browser webcam
      const x = source === "browser"
        ? displayW - (det.box.x + det.box.width) * scaleX
        : det.box.x * scaleX;
      const y = det.box.y * scaleY;
      const w = det.box.width * scaleX;
      const h = det.box.height * scaleY;

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;

      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Corner accents
      const cl = Math.min(15, w / 4, h / 4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;

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

      // Label background
      const label = `${det.label} ${Math.round(det.confidence * 100)}%`;
      ctx.font = "bold 12px Inter, system-ui, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const labelHeight = 20;
      const labelY = y > labelHeight + 5 ? y - labelHeight - 5 : y + h + 5;

      ctx.fillStyle = color + "dd";
      ctx.fillRect(x, labelY, textWidth + 12, labelHeight);

      // Label text
      ctx.fillStyle = "#000";
      ctx.fillText(label, x + 6, labelY + 14);

      // Age/Gender if available
      if (det.age || det.gender) {
        const info = [det.gender, det.age ? `${det.age}y` : ""].filter(Boolean).join(", ");
        if (info) {
          ctx.font = "10px Inter, system-ui, sans-serif";
          const infoWidth = ctx.measureText(info).width;
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(x, labelY + labelHeight, infoWidth + 10, 16);
          ctx.fillStyle = "#fff";
          ctx.fillText(info, x + 5, labelY + labelHeight + 11);
        }
      }
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  // Get Suhas detections
  const suhasDetections = detections.filter((d) =>
    d.label.toLowerCase().includes("suhas")
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#00e5ff]/20 to-[#8b5cf6]/20 border border-white/10">
            <svg
              className="w-5 h-5 text-[#00e5ff]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Live Streaming</h2>
            <p className="text-xs text-white/40">Real-time face detection with Suhas recognition</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Paste URL button */}
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
              showUrlInput
                ? "bg-[#00e5ff]/10 border-[#00e5ff]/30 text-[#00e5ff]"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            <span className="text-xs font-medium">Paste URL</span>
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* FPS indicator */}
          {isStreaming && (
            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <span className="text-xs text-white/60">{fps} FPS</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-4 p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <h3 className="text-sm font-semibold text-white/80 mb-3">Stream Settings</h3>

          {/* Source selector */}
          <div className="mb-3">
            <label className="block text-xs text-white/40 mb-2">Source</label>
            <div className="flex gap-2">
              <button
                onClick={() => { stopStream(); setSource("browser"); }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  source === "browser"
                    ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                }`}
              >
                Browser Webcam
              </button>
              <button
                onClick={() => { stopStream(); setSource("external"); }}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  source === "external"
                    ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/30"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                }`}
              >
                External Stream
              </button>
            </div>
          </div>

          {/* External URL input */}
          {source === "external" && (
            <div>
              <label className="block text-xs text-white/40 mb-2">Stream URL</label>
              <input
                type="text"
                value={config.externalUrl}
                onChange={(e) => setConfig({ ...config, externalUrl: e.target.value })}
                placeholder="http://localhost:8080/video"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm placeholder-white/30 focus:outline-none focus:border-[#00e5ff]/30"
              />
              <p className="text-[10px] text-white/30 mt-1">
                Run `python stream/stream.py` to start the Flask MJPEG server
              </p>
            </div>
          )}
        </div>
      )}

      {/* URL Input Panel */}
      {showUrlInput && (
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-[#00e5ff]/5 to-[#8b5cf6]/5 border border-[#00e5ff]/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-[#00e5ff]/10">
              <svg className="w-4 h-4 text-[#00e5ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Connect to Stream URL</h3>
              <p className="text-[10px] text-white/40">Paste MJPEG, HTTP, or IP camera stream URL</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connectToUrl()}
              placeholder="http://192.168.1.100:8080/video or rtsp://..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm placeholder-white/30 focus:outline-none focus:border-[#00e5ff]/30 transition-all"
            />
            <button
              onClick={connectToUrl}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#8b5cf6] text-white text-sm font-semibold hover:shadow-lg hover:shadow-[#00e5ff]/20 transition-all"
            >
              Connect
            </button>
            <button
              onClick={() => setShowUrlInput(false)}
              className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-[10px] text-white/30">Quick options:</span>
            <button
              onClick={() => setUrlInput("http://localhost:8080/video")}
              className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              localhost:8080/video
            </button>
            <button
              onClick={() => setUrlInput("http://192.168.0.220:8080/video")}
              className="text-[10px] px-2 py-1 rounded bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              192.168.0.220:8080/video
            </button>
          </div>

          <p className="mt-2 text-[10px] text-yellow-500/70">
            Note: Make sure to include the full path (e.g., /video) in the URL
          </p>

          <div className="mt-3 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#00e5ff] focus:ring-[#00e5ff]/30"
              />
              <span className="text-[10px] text-white/50">Use proxy (for external URLs with CORS issues)</span>
            </label>
          </div>

          {/* Ngrok warning */}
          {urlInput.includes("ngrok") && (
            <div className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-[10px] text-orange-300 font-medium">Ngrok URL detected</p>
                  <p className="text-[10px] text-orange-300/70 mt-0.5">
                    You must open the URL in browser first to accept ngrok&apos;s warning page.
                  </p>
                  <button
                    onClick={() => window.open(urlInput, "_blank")}
                    className="mt-2 text-[10px] px-3 py-1.5 rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-all flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in Browser First
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-[10px] text-white/40 mb-1">To start the Flask stream server:</p>
            <code className="text-[10px] text-[#00e5ff]/80 bg-black/30 px-2 py-1 rounded">
              Double-click start_stream.bat
            </code>
          </div>
        </div>
      )}

      {/* Main stream area */}
      <div className="flex-1 flex gap-4">
        {/* Video container */}
        <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/40 border border-white/10">
          {/* Model loading state */}
          {isModelLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full border-2 border-[#00e5ff]/30 border-t-[#00e5ff] animate-spin mx-auto mb-3" />
                <p className="text-sm text-white/60">Loading AI models...</p>
              </div>
            </div>
          )}

          {/* Browser webcam video */}
          {source === "browser" && (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                style={{ transform: "scaleX(-1)" }}
                playsInline
                muted
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </>
          )}

          {/* External MJPEG stream */}
          {source === "external" && isStreaming && (
            <div className="relative w-full h-full">
              <img
                key={retryKey}
                ref={imgRef}
                src={useProxy
                  ? `/api/stream-proxy?url=${encodeURIComponent(config.externalUrl)}&t=${retryKey}`
                  : `${config.externalUrl}${config.externalUrl.includes('?') ? '&' : '?'}t=${retryKey}`}
                alt="External stream"
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                onError={() => {
                  const isNgrok = config.externalUrl.includes("ngrok");
                  if (isNgrok) {
                    setError("Ngrok stream failed. Click 'Retry' after accepting the ngrok warning page in the other tab.");
                  } else {
                    setError(`Failed to load stream from ${config.externalUrl}. Make sure the stream server is running.`);
                  }
                }}
                onLoad={() => setError(null)}
              />
              {/* Hidden canvas for frame capture */}
              <canvas ref={captureCanvasRef} className="hidden" />
              {/* Detection overlay for external stream */}
              <canvas
                ref={externalOverlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {/* Stream info overlay */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 flex items-center gap-2 max-w-xs">
                  <svg className="w-3 h-3 text-[#00e5ff] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  <p className="text-[10px] text-white/60 truncate">{config.externalUrl}</p>
                </div>
                <button
                  onClick={stopStream}
                  className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
                  title="Disconnect"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10">
                <p className="text-xs text-white/60">
                  External MJPEG Stream
                </p>
              </div>
            </div>
          )}

          {/* Placeholder when not streaming */}
          {!isStreaming && !isModelLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                <svg
                  className="w-10 h-10 text-white/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <p className="text-sm text-white/40 mb-1">No active stream</p>
              <p className="text-xs text-white/20 mb-6 text-center">Use your webcam or connect to an external stream URL</p>

              {/* Quick actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setSource("browser"); startBrowserStream(); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00e5ff] to-[#8b5cf6] text-white text-sm font-medium hover:shadow-lg hover:shadow-[#00e5ff]/20 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Use Webcam
                </button>
                <button
                  onClick={() => setShowUrlInput(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Paste URL
                </button>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="absolute bottom-4 left-4 right-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-red-300">{error}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setError(null); setIsStreaming(false); setShowUrlInput(true); }}
                    className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                  >
                    Change URL
                  </button>
                  <button
                    onClick={() => { setError(null); setRetryKey(k => k + 1); setIsStreaming(true); }}
                    className="px-3 py-1 text-xs bg-[#00e5ff]/20 hover:bg-[#00e5ff]/30 text-[#00e5ff] rounded-lg transition-all"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stream controls overlay - only show for browser webcam */}
          {source === "browser" && isStreaming && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                onClick={stopStream}
                className="px-6 py-3 rounded-xl font-semibold text-sm bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
              >
                Stop Webcam
              </button>
            </div>
          )}

          {/* Recording indicator */}
          {isStreaming && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-white/60">LIVE</span>
            </div>
          )}
        </div>

        {/* Detection sidebar */}
        <div className="w-72 flex flex-col gap-3">
          {/* Stats card */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              Detection Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/5">
                <p className="text-2xl font-bold text-white">{detections.length}</p>
                <p className="text-[10px] text-white/40">Total Objects</p>
              </div>
              <div className="p-3 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/20">
                <p className="text-2xl font-bold text-[#00e5ff]">{suhasDetections.length}</p>
                <p className="text-[10px] text-[#00e5ff]/60">Suhas Found</p>
              </div>
            </div>
          </div>

          {/* Suhas detection card */}
          {suhasDetections.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#00e5ff]/10 to-[#8b5cf6]/10 border border-[#00e5ff]/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00e5ff] to-[#8b5cf6] flex items-center justify-center text-white font-bold">
                  S
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Suhas Detected</h3>
                  <p className="text-xs text-white/40">
                    Confidence: {Math.round(suhasDetections[0].confidence * 100)}%
                  </p>
                </div>
              </div>
              {suhasDetections[0].age && (
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-white/10 text-white/60">
                    {suhasDetections[0].gender}
                  </span>
                  <span className="px-2 py-1 rounded bg-white/10 text-white/60">
                    ~{suhasDetections[0].age} years
                  </span>
                </div>
              )}
            </div>
          )}

          {/* All detections list */}
          <div className="flex-1 p-4 rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
              All Detections
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {detections.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-4">
                  No objects detected
                </p>
              ) : (
                detections.map((det, i) => {
                  const isSuhas = det.label.toLowerCase().includes("suhas");
                  return (
                    <div
                      key={i}
                      className={`p-2 rounded-lg ${
                        isSuhas
                          ? "bg-[#00e5ff]/10 border border-[#00e5ff]/20"
                          : "bg-white/5 border border-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-medium ${
                            isSuhas ? "text-[#00e5ff]" : "text-white/70"
                          }`}
                        >
                          {det.label}
                        </span>
                        <span className="text-xs text-white/40">
                          {Math.round(det.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
