"use client";

import { useCallback, useRef } from "react";

export interface TritonDetection {
  bbox: [number, number, number, number]; // x, y, width, height
  score: number;
  class: number;
  label: string;
}

interface UseTritonDetectionResult {
  detect: (
    source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
    sourceWidth: number,
    sourceHeight: number,
    model?: "suhas" | "oiv7" | "both"
  ) => Promise<TritonDetection[]>;
  isReady: boolean;
}

export function useTritonDetection(): UseTritonDetectionResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const detect = useCallback(
    async (
      source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
      sourceWidth: number,
      sourceHeight: number,
      model: "suhas" | "oiv7" | "both" = "both"
    ): Promise<TritonDetection[]> => {
      try {
        // Create offscreen canvas if needed
        if (!canvasRef.current) {
          canvasRef.current = document.createElement("canvas");
        }

        const canvas = canvasRef.current;
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        // Draw source to canvas
        ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);

        // Get image data as RGBA array
        const imageData = ctx.getImageData(0, 0, sourceWidth, sourceHeight);
        const rgbaArray = Array.from(imageData.data);

        // Call Triton API
        const response = await fetch("/api/triton", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageData: rgbaArray,
            width: sourceWidth,
            height: sourceHeight,
            model,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Triton detection failed");
        }

        const result = await response.json();
        return result.detections || [];
      } catch (error) {
        console.error("Triton detection error:", error);
        return [];
      }
    },
    []
  );

  return {
    detect,
    isReady: true, // Always ready since we're using API
  };
}

// Draw detections on canvas (reusable helper)
export function drawTritonDetections(
  ctx: CanvasRenderingContext2D,
  detections: TritonDetection[],
  options?: {
    lineWidth?: number;
    fontSize?: number;
    fontFamily?: string;
  }
) {
  const { lineWidth = 2, fontSize = 14, fontFamily = "Arial" } = options || {};

  ctx.lineWidth = lineWidth;
  ctx.font = `${fontSize}px ${fontFamily}`;

  for (const det of detections) {
    const [x, y, w, h] = det.bbox;

    // Color based on class
    const hue = (det.class * 137.5) % 360;
    const color = `hsl(${hue}, 70%, 50%)`;

    // Draw bbox
    ctx.strokeStyle = color;
    ctx.strokeRect(x, y, w, h);

    // Draw label background
    const label = `${det.label} ${(det.score * 100).toFixed(0)}%`;
    const textMetrics = ctx.measureText(label);
    const textHeight = fontSize + 4;
    const textWidth = textMetrics.width + 8;

    ctx.fillStyle = color;
    ctx.fillRect(x, y - textHeight, textWidth, textHeight);

    // Draw label text
    ctx.fillStyle = "white";
    ctx.fillText(label, x + 4, y - 4);
  }
}
