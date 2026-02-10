"use client";

import { useState, useEffect, useRef } from "react";

// Use CDN to avoid local file caching issues
const FACE_API_MODELS_URI = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";
const SAMPLES_FOLDER = "/suhas-samples";
const TOTAL_SAMPLES = 448; // 0.jpg to 447.jpg

export default function GenerateDescriptorsPage() {
  const [status, setStatus] = useState("Initializing...");
  const [progress, setProgress] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [descriptors, setDescriptors] = useState<number[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faceapiRef = useRef<any>(null);

  // Load face-api dynamically + models
  useEffect(() => {
    async function loadModels() {
      setStatus("Loading face-api library...");
      try {
        const faceapi = await import("@vladmandic/face-api");
        faceapiRef.current = faceapi;
        setStatus("Loading face-api models...");
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_API_MODELS_URI),
          faceapi.nets.faceLandmark68Net.loadFromUri(FACE_API_MODELS_URI),
          faceapi.nets.faceRecognitionNet.loadFromUri(FACE_API_MODELS_URI),
        ]);
        setModelsLoaded(true);
        setStatus("Models loaded. Ready to generate descriptors.");
      } catch (err) {
        setStatus(`Error loading models: ${err}`);
      }
    }
    loadModels();
  }, []);

  const processImage = async (imagePath: string): Promise<Float32Array | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        try {
          const faceapi = faceapiRef.current;
          if (!faceapi) { resolve(null); return; }
          const detection = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detection && detection.descriptor) {
            resolve(detection.descriptor);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imagePath;
    });
  };

  const startProcessing = async () => {
    if (!modelsLoaded || isProcessing) return;

    setIsProcessing(true);
    setDescriptors([]);
    setTotalProcessed(0);
    setProgress(0);

    const collectedDescriptors: number[][] = [];
    let successCount = 0;
    let failCount = 0;

    // Process in batches to avoid overwhelming the browser
    const BATCH_SIZE = 10;

    for (let i = 0; i < TOTAL_SAMPLES; i += BATCH_SIZE) {
      const batch = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE, TOTAL_SAMPLES); j++) {
        batch.push(j);
      }

      setStatus(`Processing images ${i + 1} to ${Math.min(i + BATCH_SIZE, TOTAL_SAMPLES)}...`);

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(async (idx) => {
          const imagePath = `${SAMPLES_FOLDER}/${idx}.jpg`;
          const descriptor = await processImage(imagePath);
          return { idx, descriptor };
        })
      );

      for (const { idx, descriptor } of results) {
        if (descriptor) {
          collectedDescriptors.push(Array.from(descriptor));
          successCount++;
        } else {
          failCount++;
        }
      }

      setTotalProcessed(i + batch.length);
      setProgress(Math.round(((i + batch.length) / TOTAL_SAMPLES) * 100));
      setDescriptors([...collectedDescriptors]);

      // Small delay to let UI update
      await new Promise((r) => setTimeout(r, 50));
    }

    setStatus(
      `Complete! Extracted ${successCount} descriptors from ${TOTAL_SAMPLES} images. (${failCount} failed)`
    );
    setIsProcessing(false);
    setIsComplete(true);
  };

  const downloadDescriptors = () => {
    const data = {
      name: "Suhas R",
      generatedAt: new Date().toISOString(),
      totalSamples: TOTAL_SAMPLES,
      descriptorCount: descriptors.length,
      descriptors: descriptors,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "suhas-descriptors.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Face Descriptor Generator</h1>
        <p className="text-white/60 mb-8">
          Generate face descriptors from Suhas sample images for improved recognition.
        </p>

        <div className="glass-card p-6 rounded-xl border border-white/10 mb-6">
          <h2 className="text-lg font-semibold mb-4">Status</h2>
          <p className="text-[#00e5ff] mb-4">{status}</p>

          {isProcessing && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-white/60 mb-1">
                <span>Progress</span>
                <span>
                  {totalProcessed} / {TOTAL_SAMPLES}
                </span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00e5ff] to-[#8b5cf6] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={startProcessing}
              disabled={!modelsLoaded || isProcessing}
              className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#00e5ff] to-[#8b5cf6] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing..." : "Start Processing"}
            </button>

            {isComplete && descriptors.length > 0 && (
              <button
                onClick={downloadDescriptors}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white font-semibold"
              >
                Download JSON ({descriptors.length} descriptors)
              </button>
            )}
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl border border-white/10">
          <h2 className="text-lg font-semibold mb-4">Statistics</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-white/60">Total Samples:</span>
              <span className="ml-2 font-mono">{TOTAL_SAMPLES}</span>
            </div>
            <div>
              <span className="text-white/60">Processed:</span>
              <span className="ml-2 font-mono">{totalProcessed}</span>
            </div>
            <div>
              <span className="text-white/60">Descriptors Extracted:</span>
              <span className="ml-2 font-mono text-green-400">{descriptors.length}</span>
            </div>
            <div>
              <span className="text-white/60">Failed:</span>
              <span className="ml-2 font-mono text-red-400">
                {totalProcessed - descriptors.length}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-white/40">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click &quot;Start Processing&quot; to begin extracting face descriptors</li>
            <li>Wait for all {TOTAL_SAMPLES} images to be processed</li>
            <li>Click &quot;Download JSON&quot; to save the descriptors file</li>
            <li>Move the downloaded file to <code className="text-[#00e5ff]">public/suhas-descriptors.json</code></li>
            <li>Restart the dev server to load the new descriptors</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
