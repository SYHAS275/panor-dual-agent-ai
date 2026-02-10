"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useYoloDetection } from "@/lib/hooks/useYoloDetection";
import type { YoloDetection } from "@/lib/hooks/useYoloDetection";
import { filterObjectDetections } from "@/lib/utils/detectionFilter";
import dynamic from "next/dynamic";

const ObjectWebcam = dynamic(() => import("./ObjectWebcam"), { ssr: false });

type DetectionMode = "upload" | "webcam";

export default function ObjectDetection() {
  const [mode, setMode] = useState<DetectionMode>("upload");
  const { isModelLoading, modelLoaded, error: modelError, loadModel, detect } = useYoloDetection();
  const [image, setImage] = useState<string | null>(null);
  const [detections, setDetections] = useState<YoloDetection[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!modelLoaded && !isModelLoading) {
      loadModel();
    }
  }, [modelLoaded, isModelLoading, loadModel]);

  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const url = URL.createObjectURL(file);
    setImage(url);
    setDetections([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"] },
    maxFiles: 1,
    maxSize: 10485760,
  });

  const handleImageLoad = useCallback(async () => {
    if (!imgRef.current || !modelLoaded) return;
    setIsDetecting(true);
    try {
      const img = imgRef.current;
      const allDetections = await detect(img, img.naturalWidth, img.naturalHeight);
      const objectsOnly = filterObjectDetections(allDetections);
      setDetections(objectsOnly);
    } catch (err) {
      console.error("Detection error:", err);
    }
    setIsDetecting(false);
  }, [detect, modelLoaded]);

  // Draw bounding boxes
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = img.clientWidth / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    detections.forEach((det, idx) => {
      const x = det.box.x * scaleX;
      const y = det.box.y * scaleY;
      const w = det.box.width * scaleX;
      const h = det.box.height * scaleY;

      // Color based on confidence
      const hue = det.confidence > 0.7 ? 160 : det.confidence > 0.4 ? 40 : 0;
      const color = `hsl(${hue}, 100%, 60%)`;

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Fill
      ctx.shadowBlur = 0;
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, 0.06)`;
      ctx.fillRect(x, y, w, h);

      // Corner accents
      const cornerLen = Math.min(w, h, 20);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y);
      ctx.moveTo(x + w - cornerLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerLen);
      ctx.moveTo(x + w, y + h - cornerLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - cornerLen, y + h);
      ctx.moveTo(x + cornerLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - cornerLen);
      ctx.stroke();

      // Label
      const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 12px Inter, sans-serif";
      const textW = ctx.measureText(label).width + 12;
      const labelY = y > 24 ? y - 24 : y + 4;

      ctx.fillStyle = "rgba(6, 6, 12, 0.85)";
      ctx.fillRect(x, labelY, textW, 22);
      ctx.fillStyle = color;
      ctx.fillText(label, x + 6, labelY + 15);
    });
  }, [detections, image]);

  return (
    <div>
      {mode === "webcam" ? (
        <>
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setMode("upload")}
              className="flex items-center gap-2 text-xs font-bold text-[#00e5ff] bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 border border-[#00e5ff]/20 px-4 py-2 rounded-lg transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Upload
            </button>
            <h2 className="text-lg font-bold text-white">Live Object Detection</h2>
          </div>
          <ObjectWebcam onBack={() => setMode("upload")} />
        </>
      ) : (
        <>
          {/* Mode Toggle */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode("upload")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload Image
              </button>
              <button
                onClick={() => setMode("webcam")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all text-white/40 hover:text-white/70"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Webcam
              </button>
            </div>

            {modelLoaded && (
              <span className="badge badge-green text-[10px]">Model Ready</span>
            )}
          </div>

          {/* Model Loading */}
          {isModelLoading && (
            <div className="glass-card rounded-2xl p-10 text-center">
              <div className="w-12 h-12 spinner mx-auto mb-4" />
              <p className="text-sm text-white/40">Loading YOLO object detection model...</p>
            </div>
          )}

          {modelError && (
            <div className="glass-card rounded-2xl p-5 border border-red-500/20 mb-6">
              <p className="text-sm text-red-400">{modelError}</p>
            </div>
          )}

          {/* Upload Zone */}
          {!image && modelLoaded && (
            <div
              {...getRootProps()}
              className={`glass-card rounded-2xl p-12 border-2 border-dashed transition-all cursor-pointer text-center ${
                isDragActive
                  ? "border-[#00e5ff]/50 bg-[#00e5ff]/5"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <input {...getInputProps()} />
              <svg className="w-12 h-12 mx-auto mb-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm text-white/40 mb-1">Drop an image here or click to browse</p>
              <p className="text-xs text-white/20">PNG, JPG, WebP up to 10MB</p>
            </div>
          )}

          {/* Image with Detections */}
          {image && (
            <div className="space-y-6">
              <div className="glass-card rounded-2xl p-4">
                <div className="relative inline-block w-full">
                  <img
                    ref={imgRef}
                    src={image}
                    alt="Uploaded"
                    className="w-full rounded-xl"
                    onLoad={handleImageLoad}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  />
                  {isDetecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                      <div className="text-center">
                        <div className="w-10 h-10 spinner mx-auto mb-3" />
                        <p className="text-sm text-white/60">Detecting objects...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Detection Results */}
              {detections.length > 0 && (
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white mb-4">
                    Detected Objects ({detections.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {detections.map((det, idx) => (
                      <div key={idx} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                        <p className="text-sm font-medium text-white truncate">{det.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#00e5ff]"
                              style={{ width: `${det.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/40">{(det.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isDetecting && detections.length === 0 && (
                <div className="glass-card rounded-2xl p-6 text-center">
                  <p className="text-sm text-white/30">No objects detected in this image</p>
                </div>
              )}

              {/* New Image Button */}
              <div className="text-center">
                <button
                  onClick={() => { setImage(null); setDetections([]); }}
                  className="text-xs text-white/50 hover:text-white/80 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                >
                  Upload Another Image
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
