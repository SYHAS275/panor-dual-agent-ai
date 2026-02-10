"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useFaceDetection } from "@/lib/hooks/useFaceDetection";
import type { DetectedFace, KnownProfile } from "@/lib/hooks/useFaceDetection";
import { useYoloDetection } from "@/lib/hooks/useYoloDetection";
import type { YoloDetection } from "@/lib/hooks/useYoloDetection";
import { readSSEStream } from "@/lib/utils/sseReader";
import FaceCanvas from "./FaceCanvas";
import FaceResults from "./FaceResults";
import dynamic from "next/dynamic";

const KNOWN_PROFILES: Record<string, KnownProfile> = {
  "Suhas R": {
    name: "SUHAS R",
    age: 23,
    gender: "Male",
    occupation: "Software Engineer at ARTPARK",
  },
};

const FaceWebcam = dynamic(() => import("./FaceWebcam"), { ssr: false });

interface AIResponse {
  text: string;
  model: string;
  timestamp: string;
}

type FaceMode = "upload" | "webcam";

interface FaceRecognitionProps {
  onBack?: () => void;
}

export default function FaceRecognition({ onBack }: FaceRecognitionProps) {
  const router = useRouter();
  const handleBack = onBack || (() => router.push("/"));
  const [faceMode, setFaceMode] = useState<FaceMode>("upload");
  const {
    isModelLoading: isFaceModelLoading,
    isDetecting,
    modelLoaded: faceModelLoaded,
    faces: rawFaces,
    error: detectionError,
    loadModels,
    detectFaces,
    reset: resetDetection,
  } = useFaceDetection();

  const {
    isModelLoading: isYoloLoading,
    modelLoaded: yoloModelLoaded,
    loadModel: loadYoloModel,
    detect: yoloDetect,
  } = useYoloDetection();

  const [enrichedFaces, setEnrichedFaces] = useState<DetectedFace[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState<number | null>(null);

  // Use enriched faces (with known profiles) if available, otherwise raw
  const faces = enrichedFaces.length > 0 ? enrichedFaces : rawFaces;
  const isModelLoading = isFaceModelLoading || isYoloLoading;
  const modelLoaded = faceModelLoaded;
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identification, setIdentification] = useState<{
    gemini: AIResponse | null;
    chatgpt: AIResponse | null;
  }>({ gemini: null, chatgpt: null });
  const [error, setError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load models on mount
  useEffect(() => {
    loadModels();
    loadYoloModel();
  }, [loadModels, loadYoloModel]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const f = acceptedFiles[0];
        setFile(f);
        setImageSrc(URL.createObjectURL(f));
        setSelectedFaceId(null);
        setIdentification({ gemini: null, chatgpt: null });
        setError(null);
        setEnrichedFaces([]);
        resetDetection();
      }
    },
    [resetDetection]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 10485760,
    disabled: !modelLoaded,
  });

  const handleImageLoad = useCallback(
    async (img: HTMLImageElement) => {
      imgRef.current = img;
      if (!faceModelLoaded) return;

      try {
        const detectedFaces = await detectFaces(img);

        // Let Gemini/ChatGPT handle all face identification
        setEnrichedFaces(detectedFaces);
        if (detectedFaces.length > 0) {
          setSelectedFaceId(0);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Face detection failed"
        );
      }
    },
    [faceModelLoaded, detectFaces]
  );

  // Start AI identification when we have faces and a file
  useEffect(() => {
    if (faces.length > 0 && file && !isIdentifying && !identification.gemini && !identification.chatgpt) {
      identifyFaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faces, file]);

  const identifyFaces = async () => {
    if (!file) return;
    setIsIdentifying(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/identify-face", {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        await readSSEStream(response, (event, data) => {
          if (event === "gemini") {
            setIdentification((prev) => ({ ...prev, gemini: data as AIResponse }));
          } else if (event === "chatgpt") {
            setIdentification((prev) => ({ ...prev, chatgpt: data as AIResponse }));
          } else if (event === "error") {
            setError((data as { message: string }).message);
          }
        });
      } else {
        const json = await response.json();
        throw new Error(json.error || "Identification failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identification failed");
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleReset = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setFile(null);
    setImageSrc(null);
    setSelectedFaceId(null);
    setIdentification({ gemini: null, chatgpt: null });
    setError(null);
    setEnrichedFaces([]);
    resetDetection();
  };

  // If webcam mode, render the webcam component
  if (faceMode === "webcam") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-xs font-bold text-[#ec4899] bg-[#ec4899]/10 hover:bg-[#ec4899]/20 border border-[#ec4899]/20 hover:border-[#ec4899]/40 px-4 py-2 rounded-lg transition-all shadow-[0_0_10px_rgba(236,72,153,0.1)] hover:shadow-[0_0_15px_rgba(236,72,153,0.2)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Document Analysis
        </button>

        {/* Mode toggle */}
        <div className="flex justify-center">
          <div className="mode-switcher">
            <button
              onClick={() => setFaceMode("upload")}
              className="px-4 py-2 rounded-[10px] text-xs font-medium transition-all text-white/40 hover:text-white/60"
            >
              Upload Photo
            </button>
            <button
              className="px-4 py-2 rounded-[10px] text-xs font-medium transition-all bg-[#00e5ff]/10 text-[#00e5ff] shadow-sm"
            >
              Live Webcam
            </button>
          </div>
        </div>

        <FaceWebcam onBack={() => setFaceMode("upload")} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-xs font-bold text-[#ec4899] bg-[#ec4899]/10 hover:bg-[#ec4899]/20 border border-[#ec4899]/20 hover:border-[#ec4899]/40 px-4 py-2 rounded-lg transition-all shadow-[0_0_10px_rgba(236,72,153,0.1)] hover:shadow-[0_0_15px_rgba(236,72,153,0.2)]"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Document Analysis
      </button>

      {/* Mode toggle */}
      <div className="flex justify-center">
        <div className="mode-switcher">
          <button
            className="px-4 py-2 rounded-[10px] text-xs font-medium transition-all bg-[#ec4899]/10 text-[#ec4899] shadow-sm"
          >
            Upload Photo
          </button>
          <button
            onClick={() => setFaceMode("webcam")}
            className="px-4 py-2 rounded-[10px] text-xs font-medium transition-all text-white/40 hover:text-white/60"
          >
            Live Webcam
          </button>
        </div>
      </div>

      {/* Model loading state */}
      {isModelLoading && (
        <div className="glass-card rounded-2xl p-10 text-center animate-scale-in">
          <div className="w-14 h-14 spinner mx-auto mb-5" />
          <h3 className="text-lg font-semibold text-white mb-1">
            Loading Detection Models
          </h3>
          <p className="text-sm text-white/30">
            Downloading face detection &amp; identity recognition models (cached after first load)
          </p>
          <div className="typing-dots mt-4">
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* Model load error */}
      {detectionError && (
        <div className="glass-card rounded-2xl p-5 border border-red-500/20">
          <p className="text-sm text-red-300/80">{detectionError}</p>
        </div>
      )}

      {/* Upload dropzone — shown when model is loaded and no image yet */}
      {modelLoaded && !imageSrc && (
        <div
          {...getRootProps()}
          className={`glass-card neon-border rounded-2xl p-10 text-center cursor-pointer transition-all duration-500 animate-scale-in ${
            isDragActive ? "border-[#ec4899]/30 bg-[#ec4899]/[0.02]" : ""
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#ec4899]/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#ec4899]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-sm text-[#ec4899]">Drop the image here</p>
            ) : (
              <>
                <p className="text-sm text-white/50">
                  Drop a photo or <span className="text-[#ec4899]">browse</span>
                </p>
                <p className="text-xs text-white/20">
                  Supports PNG, JPG, JPEG, WebP
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results area — image + canvas + face results */}
      {imageSrc && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Detection status bar */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#ec4899]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#ec4899]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80 truncate max-w-[200px]">
                    {file?.name}
                  </p>
                  <p className="text-xs text-white/20">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isDetecting && (
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full animate-pulse">
                    Detecting faces...
                  </span>
                )}
                {isIdentifying && (
                  <span className="text-[10px] text-[#ec4899] bg-[#ec4899]/10 px-2 py-1 rounded-full animate-pulse">
                    Identifying...
                  </span>
                )}
                {!isDetecting && !isIdentifying && faces.length > 0 && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                    {faces.length} face{faces.length !== 1 ? "s" : ""} found
                  </span>
                )}
                <button
                  onClick={handleReset}
                  className="text-xs text-white bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 hover:border-emerald-500 transition-all px-4 py-1.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                >
                  Upload New Photo
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="glass-card rounded-2xl p-4 border border-red-500/20">
              <p className="text-sm text-red-300/80">{error}</p>
            </div>
          )}

          {/* Canvas + Results side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <FaceCanvas
              imageSrc={imageSrc}
              faces={faces}
              selectedFaceId={selectedFaceId}
              onFaceClick={setSelectedFaceId}
              onImageLoad={handleImageLoad}
            />

            {faces.length > 0 && (
              <FaceResults
                faces={faces}
                selectedFaceId={selectedFaceId}
                onSelectFace={setSelectedFaceId}
                identification={identification}
                isIdentifying={isIdentifying}
              />
            )}
          </div>

          {/* No faces disclaimer */}
          {!isDetecting && faces.length === 0 && imageSrc && (
            <div className="text-center py-6">
              <p className="text-sm text-white/30">
                No faces detected in this image. Try a clearer photo with visible faces.
              </p>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="flex justify-center pt-8 pb-4">
            <button
              onClick={handleReset}
              className="btn-premium rounded-xl py-3 px-8 font-semibold text-white text-sm shadow-lg shadow-[#00e5ff]/20 hover:shadow-[#00e5ff]/40 transform hover:scale-105 transition-all duration-300"
            >
              Upload Another Photo
            </button>
          </div>

          {/* Privacy note */}
          <p className="text-[10px] text-white/10 text-center">
            Face detection runs entirely in your browser. Name identification sends the image to AI APIs (Google Gemini &amp; OpenAI).
          </p>
        </div>
      )}
    </div>
  );
}
