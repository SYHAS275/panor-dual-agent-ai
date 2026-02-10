"use client";

import { useState, useCallback, useRef } from "react";
// @ts-ignore
import * as faceapi from '@vladmandic/face-api';
import { OPENIMAGES_CLASSES } from "../utils/openImagesClasses";

export interface YoloDetection {
  label: string;
  confidence: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  age?: number;
  gender?: string;
  genderProbability?: number;
}

const CUSTOM_MODEL_URL = "/yolo/suhas_model.onnx";
const OPENIMAGES_MODEL_URL = "/yolo/yolov8n-oiv7.onnx";

const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.25;
const SUHAS_CONF_THRESHOLD = 0.5; // Lower threshold for live webcam detection (photo uploads use Gemini/ChatGPT instead)
const IOU_THRESHOLD = 0.45;
const OVERLAP_THRESHOLD = 0.3;

const CUSTOM_CLASS_NAMES = ["suhas"];

// Face API Configuration - Use CDN to avoid local file caching issues
const FACE_API_MODELS_URI = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";

const ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrtModule = any;

function loadOrtFromCDN(): Promise<OrtModule> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).ort) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve((window as any).ort);
      return;
    }
    const script = document.createElement("script");
    script.src = ORT_CDN;
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ort = (window as any).ort;
      if (ort) resolve(ort);
      else reject(new Error("ONNX Runtime failed to load from CDN"));
    };
    script.onerror = () => reject(new Error("Failed to load ONNX Runtime script"));
    document.head.appendChild(script);
  });
}

// Separate FaceAPI loader to avoid blocking YOLO if it fails
async function loadFaceApi() {
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_API_MODELS_URI),
      faceapi.nets.faceLandmark68Net.loadFromUri(FACE_API_MODELS_URI),
      faceapi.nets.ageGenderNet.loadFromUri(FACE_API_MODELS_URI),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_API_MODELS_URI),
    ]);
    return true;
  } catch (err) {
    console.error("Failed to load FaceAPI models", err);
    return false;
  }
}

// Suhas face descriptors storage
let suhasDescriptors: Float32Array[] = [];
let descriptorsLoaded = false;

// Load pre-computed Suhas face descriptors
async function loadSuhasDescriptors() {
  if (descriptorsLoaded) {
    console.log(`[loadSuhasDescriptors] Already loaded ${suhasDescriptors.length} descriptors`);
    return suhasDescriptors;
  }
  try {
    console.log("[loadSuhasDescriptors] Fetching descriptors...");
    const response = await fetch('/suhas-descriptors.json');
    if (response.ok) {
      const data = await response.json();
      suhasDescriptors = data.descriptors.map((d: number[]) => new Float32Array(d));
      descriptorsLoaded = true;
      console.log(`[loadSuhasDescriptors] Successfully loaded ${suhasDescriptors.length} Suhas face descriptors`);
    } else {
      console.error("[loadSuhasDescriptors] Failed to fetch:", response.status);
    }
  } catch (err) {
    console.error("[loadSuhasDescriptors] Error loading descriptors:", err);
  }
  return suhasDescriptors;
}

// Calculate Euclidean distance between two face descriptors
function euclideanDistance(desc1: Float32Array, desc2: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Match a face descriptor against Suhas descriptors
// Distance threshold 0.6 is standard for face-api.js recognition
function matchSuhasDescriptor(descriptor: Float32Array, threshold: number = 0.6): { match: boolean; confidence: number; distance: number } {
  if (suhasDescriptors.length === 0) {
    console.log("[matchSuhasDescriptor] No descriptors loaded");
    return { match: false, confidence: 0, distance: 1 };
  }

  let minDistance = Infinity;
  for (const suhasDesc of suhasDescriptors) {
    const dist = euclideanDistance(descriptor, suhasDesc);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  // Convert distance to confidence - more generous scale
  // Distance 0 = 100%, Distance 0.3 = 50%, Distance 0.6 = 0%
  // This gives higher confidence for closer matches
  const confidence = Math.max(0, 1 - (minDistance / 0.6));

  console.log(`[matchSuhasDescriptor] minDistance: ${minDistance.toFixed(3)}, confidence: ${(confidence * 100).toFixed(1)}%, match: ${minDistance < threshold}`);

  return {
    match: minDistance < threshold,
    confidence,
    distance: minDistance
  };
}

export function useYoloDetection() {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [faceApiLoaded, setFaceApiLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customSessionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const googleSessionRef = useRef<any>(null); // OpenImages
  const ortRef = useRef<OrtModule>(null);

  const loadModel = useCallback(async () => {
    if (modelLoaded || isModelLoading) return;
    setIsModelLoading(true);
    setError(null);

    try {
      const ort = await loadOrtFromCDN();
      ortRef.current = ort;

      ort.env.wasm.numThreads = 2;
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";

      // Load YOLO Models
      const [customSession, googleSession] = await Promise.all([
        ort.InferenceSession.create(CUSTOM_MODEL_URL, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        }),
        ort.InferenceSession.create(OPENIMAGES_MODEL_URL, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        }),
      ]);

      customSessionRef.current = customSession;
      googleSessionRef.current = googleSession;

      // Load Face API
      const faceLoaded = await loadFaceApi();
      setFaceApiLoaded(faceLoaded);

      // Load Suhas face descriptors for recognition
      if (faceLoaded) {
        await loadSuhasDescriptors();
      }

      setModelLoaded(true);
    } catch (err) {
      setError(
        `Failed to load models: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsModelLoading(false);
    }
  }, [modelLoaded, isModelLoading]);

  const preprocessFrame = useCallback(
    (
      source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
      sourceWidth: number,
      sourceHeight: number
    ): { tensor: Float32Array; scale: number; padX: number; padY: number } => {
      const scale = Math.min(INPUT_SIZE / sourceWidth, INPUT_SIZE / sourceHeight);
      const newW = Math.round(sourceWidth * scale);
      const newH = Math.round(sourceHeight * scale);
      const padX = (INPUT_SIZE - newW) / 2;
      const padY = (INPUT_SIZE - newH) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = INPUT_SIZE;
      canvas.height = INPUT_SIZE;
      const ctx = canvas.getContext("2d")!;

      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
      ctx.drawImage(source, padX, padY, newW, newH);

      const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
      const pixels = imageData.data;

      const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
      const channelSize = INPUT_SIZE * INPUT_SIZE;

      for (let i = 0; i < channelSize; i++) {
        tensor[i] = pixels[i * 4] / 255;
        tensor[channelSize + i] = pixels[i * 4 + 1] / 255;
        tensor[2 * channelSize + i] = pixels[i * 4 + 2] / 255;
      }

      return { tensor, scale, padX, padY };
    },
    []
  );

  const runYoloInference = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: any,
    tensor: Float32Array,
    classNames: string[],
    scale: number,
    padX: number,
    padY: number,
    confThreshold: number = CONF_THRESHOLD
  ): Promise<YoloDetection[]> => {
    if (!session || !ortRef.current) return [];

    const ort = ortRef.current;
    const inputTensor = new ort.Tensor("float32", tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);

    const inputName = session.inputNames[0];
    const results = await session.run({ [inputName]: inputTensor });
    const outputName = session.outputNames[0];
    const output = results[outputName];

    const data = output.data as Float32Array;
    const numPreds = output.dims[2];
    const numValues = output.dims[1];

    const detections: YoloDetection[] = [];

    for (let i = 0; i < numPreds; i++) {
        const cx = data[0 * numPreds + i];
        const cy = data[1 * numPreds + i];
        const w = data[2 * numPreds + i];
        const h = data[3 * numPreds + i];

        let bestScore = 0;
        let bestClassIdx = 0;
        for (let c = 0; c < numValues - 4; c++) {
            const score = data[(4 + c) * numPreds + i];
            if (score > bestScore) {
                bestScore = score;
                bestClassIdx = c;
            }
        }

        if (bestScore < confThreshold) continue;

        const x1 = (cx - w / 2 - padX) / scale;
        const y1 = (cy - h / 2 - padY) / scale;
        const bw = w / scale;
        const bh = h / scale;

        detections.push({
            label: classNames[bestClassIdx] || `class_${bestClassIdx}`,
            confidence: bestScore,
            box: {
                x: Math.max(0, x1),
                y: Math.max(0, y1),
                width: bw,
                height: bh,
            },
        });
    }

    return nms(detections, IOU_THRESHOLD);
  };

  const detect = useCallback(
    async (
      source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
      sourceWidth: number,
      sourceHeight: number
    ): Promise<YoloDetection[]> => {
      const customSession = customSessionRef.current;
      const googleSession = googleSessionRef.current;
      if (!customSession || !googleSession) return [];

      try {
        const { tensor, scale, padX, padY } = preprocessFrame(
          source,
          sourceWidth,
          sourceHeight
        );

        // Run detection tasks in parallel
        const tasks: Promise<any>[] = [
           runYoloInference(customSession, tensor, CUSTOM_CLASS_NAMES, scale, padX, padY, SUHAS_CONF_THRESHOLD),
           runYoloInference(googleSession, tensor, OPENIMAGES_CLASSES, scale, padX, padY, CONF_THRESHOLD)
        ];

        // Only run FaceAPI if loaded - now with face descriptors for recognition
        if (faceApiLoaded) {
             tasks.push(
                (async () => {
                    return await faceapi.detectAllFaces(source as any)
                      .withFaceLandmarks()
                      .withAgeAndGender()
                      .withFaceDescriptors();
                })()
             );
        } else {
            tasks.push(Promise.resolve([]));
        }

        const [customDetections, googleDetections, faceResults] = await Promise.all(tasks);

        // Face descriptor matching for Suhas recognition
        // Lower threshold (>=0.40) to ensure Suhas is detected reliably
        const LIVE_WEBCAM_MIN_CONFIDENCE = 0.40;
        const descriptorMatches: { face: any; match: ReturnType<typeof matchSuhasDescriptor> }[] = [];
        if (faceResults && faceResults.length > 0 && suhasDescriptors.length > 0) {
          for (const face of faceResults) {
            if (face.descriptor) {
              const matchResult = matchSuhasDescriptor(face.descriptor);
              // Only accept matches with high confidence for live webcam
              if (matchResult.match && matchResult.confidence >= LIVE_WEBCAM_MIN_CONFIDENCE) {
                descriptorMatches.push({ face, match: matchResult });
              }
            }
          }
        }

        // Merge Logic
        // 1. Start with Google OpenImages Detections (Person, Phone, etc.)
        // 2. Add Age/Gender metadata if "Person" overlaps with a Face
        // 3. Replace "Person" with "Suhas" if "Suhas" overlaps with "Person"
        // 4. Ideally, also attach Age/Gender to "Suhas" if Suhas overlaps Face

        const finalDetections: YoloDetection[] = [];
        const processedFaces = new Set<number>();

        // IMPORTANT: Only use face descriptor matching for Suhas recognition
        // YOLO detections alone are not reliable enough (too many false positives)
        // Face descriptors are the primary method for identity verification

        // Process face descriptor matches as Suhas detections
        for (const { face, match } of descriptorMatches) {
            const faceBox = face.detection.box;

            // Check if YOLO also detected this as Suhas (for confidence boost)
            let yoloConfidence = 0;
            for (const det of customDetections) {
                if (iou(det.box, { x: faceBox.x, y: faceBox.y, width: faceBox.width, height: faceBox.height }) > OVERLAP_THRESHOLD) {
                    yoloConfidence = det.confidence;
                    break;
                }
            }

            // Combine descriptor confidence with YOLO confidence if available
            const combinedConfidence = yoloConfidence > 0
                ? Math.min(1, match.confidence * 0.7 + yoloConfidence * 0.3)
                : match.confidence;

            const suhasDetection: YoloDetection = {
                label: "Suhas R",
                confidence: combinedConfidence,
                box: {
                    x: faceBox.x,
                    y: faceBox.y,
                    width: faceBox.width,
                    height: faceBox.height,
                },
                age: Math.round(face.age),
                gender: face.gender,
                genderProbability: face.genderProbability,
            };
            finalDetections.push(suhasDetection);
            processedFaces.add(faceResults.indexOf(face));
        }

        // Loop through Google Detections
        googleDetections.forEach((det: YoloDetection) => {
            // If it's a "Person" (OpenImages has "Person", "Man", "Woman", "Boy", "Girl" - need to be careful)
            // OpenImages has "Person", "Man", "Woman", "Boy", "Girl", "Human body", "Human face", "Human head"
            // We'll treat any human-like label as candidate for fusion
            const isHuman = ["Person", "Man", "Woman", "Boy", "Girl"].includes(det.label);

            let shouldAdd = true;

            if (isHuman) {
                // Check if this overlaps significantly with an existing "Suhas" detection
                // If so, we SKIP adding this generic person, because "Suhas" is already added
                for (const suhas of customDetections) {
                    if (iou(det.box, suhas.box) > OVERLAP_THRESHOLD) {
                        shouldAdd = false;
                        break;
                    }
                }

                if (shouldAdd) {
                    // Try to match with a Face to get Age/Gender
                    // We only use faces that haven't been assigned to Suhas (or we can share, actually)
                    // Let's allow sharing for simplicity or robust display
                    const bestFace = findBestFaceMatch(det.box, faceResults);
                    if (bestFace) {
                        det.age = Math.round(bestFace.age);
                        det.gender = bestFace.gender;
                        det.genderProbability = bestFace.genderProbability;
                    }
                }
            }

            if (shouldAdd) {
                finalDetections.push(det);
            }
        });

        return finalDetections;

      } catch (err) {
        console.error("Detection error:", err);
        return [];
      }
    },
    [preprocessFrame, faceApiLoaded]
  );

  return {
    isModelLoading,
    modelLoaded,
    error,
    loadModel,
    detect,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBestFaceMatch(box: any, faceResults: any[]): any {
    if (!faceResults || faceResults.length === 0) return null;
    
    let bestMatch = null;
    let maxIoU = 0;

    faceResults.forEach((face: any, index: number) => {
        // FaceAPI box: { x, y, width, height } (same structure)
        // face.detection.box
        const faceBox = face.detection.box;
        const overlap = iou(box, faceBox);
        if (overlap > 0.3 && overlap > maxIoU) {
            maxIoU = overlap;
            bestMatch = { ...face, index };
        }
    });

    return bestMatch;
}

function nms(detections: YoloDetection[], iouThreshold: number): YoloDetection[] {
  if (detections.length === 0) return [];
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const keep: YoloDetection[] = [];
  const suppressed = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed.has(i)) continue;
    keep.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed.has(j)) continue;
      if (iou(sorted[i].box, sorted[j].box) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }
  return keep;
}

function iou(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}
