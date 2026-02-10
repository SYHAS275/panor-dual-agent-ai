"use client";

import { useRef, useEffect, useCallback } from "react";
import type { DetectedFace } from "@/lib/hooks/useFaceDetection";

interface FaceCanvasProps {
  imageSrc: string;
  faces: DetectedFace[];
  selectedFaceId: number | null;
  onFaceClick: (faceId: number) => void;
  onImageLoad: (img: HTMLImageElement) => void;
}

export default function FaceCanvas({
  imageSrc,
  faces,
  selectedFaceId,
  onFaceClick,
  onImageLoad,
}: FaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const drawBoxes = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.naturalWidth) return;

    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const scaleX = displayWidth / img.naturalWidth;
    const scaleY = displayHeight / img.naturalHeight;

    faces.forEach((face) => {
      const x = face.box.x * scaleX;
      const y = face.box.y * scaleY;
      const w = face.box.width * scaleX;
      const h = face.box.height * scaleY;

      const isSelected = face.id === selectedFaceId;
      const isMale = face.gender === "male";
      const isKnown = !!face.knownProfile;

      const borderColor = isKnown ? "#10b981" : isSelected ? "#8b5cf6" : isMale ? "#00e5ff" : "#ec4899";
      const bgColor = isKnown
        ? "rgba(16, 185, 129, 0.1)"
        : isSelected
          ? "rgba(139, 92, 246, 0.1)"
          : isMale
            ? "rgba(0, 229, 255, 0.06)"
            : "rgba(236, 72, 153, 0.06)";

      // Bounding box
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      // Rounded rect
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.stroke();

      // Fill
      ctx.fillStyle = bgColor;
      ctx.fill();

      // Label bar at top
      const label = face.knownProfile
        ? `${face.knownProfile.name} | Age: ${face.knownProfile.age} | ${face.knownProfile.gender} | ${face.knownProfile.occupation}`
        : `Age: ${face.age} | ${face.gender.charAt(0).toUpperCase() + face.gender.slice(1)} (${face.genderProbability}%) | ${face.dominantExpression.charAt(0).toUpperCase() + face.dominantExpression.slice(1)}`;

      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const labelW = Math.max(textWidth + 16, w);
      const labelH = 22;

      // Label background
      ctx.fillStyle = "rgba(6, 6, 12, 0.85)";
      ctx.beginPath();
      ctx.moveTo(x, y - labelH);
      ctx.lineTo(x + labelW, y - labelH);
      ctx.lineTo(x + labelW, y);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();

      // Label border top
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - labelH);
      ctx.lineTo(x + labelW, y - labelH);
      ctx.stroke();

      // Label text
      ctx.fillStyle = borderColor;
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 8, y - labelH / 2);

      // Face number badge
      const badgeSize = 20;
      ctx.fillStyle = borderColor;
      ctx.beginPath();
      ctx.arc(x + w - 2, y + h - 2, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#06060c";
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(`${face.id + 1}`, x + w - 2, y + h - 1);
      ctx.textAlign = "start";
    });
  }, [faces, selectedFaceId]);

  useEffect(() => {
    drawBoxes();
  }, [drawBoxes]);

  // Redraw on window resize
  useEffect(() => {
    const handleResize = () => drawBoxes();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawBoxes]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = img.clientWidth / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    for (const face of faces) {
      const x = face.box.x * scaleX;
      const y = face.box.y * scaleY;
      const w = face.box.width * scaleX;
      const h = face.box.height * scaleY;

      if (clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
        onFaceClick(face.id);
        return;
      }
    }
  };

  return (
    <div className="face-canvas-container glass-card rounded-2xl overflow-hidden">
      <div className="relative inline-block w-full">
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Uploaded for face detection"
          className="w-full h-auto max-h-[500px] object-contain bg-black/40"
          onLoad={(e) => {
            onImageLoad(e.currentTarget);
            drawBoxes();
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          onClick={handleCanvasClick}
        />
        {faces.length === 0 && (
          <div className="face-scan-animation" />
        )}
      </div>
    </div>
  );
}
