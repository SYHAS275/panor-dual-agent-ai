"use client";

import { useState, useCallback, useRef } from "react";

export interface KnownProfile {
  name: string;
  age: number;
  gender: string;
  occupation: string;
}

export interface DetectedFace {
  id: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  age: number;
  gender: string;
  genderProbability: number;
  expressions: Record<string, number>;
  dominantExpression: string;
  knownProfile?: KnownProfile;
  isSuhas?: boolean;
  suhasConfidence?: number;
}

export interface FaceDetectionState {
  isModelLoading: boolean;
  isDetecting: boolean;
  modelLoaded: boolean;
  faces: DetectedFace[];
  error: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceApiModule = any;

// Suhas face descriptors storage
let suhasDescriptors: Float32Array[] = [];
let descriptorsLoaded = false;

// Load pre-computed Suhas face descriptors
async function loadSuhasDescriptors() {
  if (descriptorsLoaded) return suhasDescriptors;
  try {
    const response = await fetch('/suhas-descriptors.json');
    if (response.ok) {
      const data = await response.json();
      suhasDescriptors = data.descriptors.map((d: number[]) => new Float32Array(d));
      descriptorsLoaded = true;
      console.log(`[useFaceDetection] Loaded ${suhasDescriptors.length} Suhas face descriptors`);
    }
  } catch (err) {
    console.warn("[useFaceDetection] Could not load Suhas descriptors:", err);
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
function matchSuhasDescriptor(descriptor: Float32Array, threshold: number = 0.6): { match: boolean; confidence: number; distance: number } {
  if (suhasDescriptors.length === 0) {
    return { match: false, confidence: 0, distance: 1 };
  }

  let minDistance = Infinity;
  for (const suhasDesc of suhasDescriptors) {
    const dist = euclideanDistance(descriptor, suhasDesc);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  // Convert distance to confidence (lower distance = higher confidence)
  const confidence = Math.max(0, 1 - (minDistance / threshold));

  return {
    match: minDistance < threshold,
    confidence,
    distance: minDistance
  };
}

// Suhas profile
const SUHAS_PROFILE: KnownProfile = {
  name: "SUHAS R",
  age: 23,
  gender: "Male",
  occupation: "Software Engineer at ARTPARK",
};

export function useFaceDetection() {
  const [state, setState] = useState<FaceDetectionState>({
    isModelLoading: false,
    isDetecting: false,
    modelLoaded: false,
    faces: [],
    error: null,
  });

  const faceApiRef = useRef<FaceApiModule>(null);

  const loadModels = useCallback(async () => {
    if (state.modelLoaded || state.isModelLoading) return;

    setState((prev) => ({ ...prev, isModelLoading: true, error: null }));

    try {
      const faceapi = await import("@vladmandic/face-api");
      faceApiRef.current = faceapi;

      // Use CDN to avoid local file caching issues
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      // Load Suhas face descriptors for recognition
      await loadSuhasDescriptors();

      setState((prev) => ({ ...prev, isModelLoading: false, modelLoaded: true }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isModelLoading: false,
        error: `Failed to load face detection models: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }, [state.modelLoaded, state.isModelLoading]);

  const detectFaces = useCallback(
    async (imageElement: HTMLImageElement | HTMLCanvasElement): Promise<DetectedFace[]> => {
      const faceapi = faceApiRef.current;
      if (!faceapi || !state.modelLoaded) {
        throw new Error("Models not loaded");
      }

      setState((prev) => ({ ...prev, isDetecting: true, error: null }));

      try {
        // Detect faces with landmarks and descriptors for recognition
        const detections = await faceapi
          .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withAgeAndGender()
          .withFaceExpressions()
          .withFaceDescriptors();

        const faces: DetectedFace[] = detections.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any, i: number) => {
            const box = d.detection.box;
            const expressionEntries = d.expressions.asSortedArray();

            // Check if this face matches Suhas using descriptors
            let isSuhas = false;
            let suhasConfidence = 0;
            let knownProfile: KnownProfile | undefined;

            if (d.descriptor && suhasDescriptors.length > 0) {
              const matchResult = matchSuhasDescriptor(d.descriptor);
              console.log(`[useFaceDetection] Face ${i}: distance=${matchResult.distance.toFixed(3)}, confidence=${(matchResult.confidence * 100).toFixed(1)}%, match=${matchResult.match}`);
              // Lower threshold (40%) for photo uploads to ensure Suhas is detected
              if (matchResult.match && matchResult.confidence >= 0.4) {
                isSuhas = true;
                suhasConfidence = matchResult.confidence;
                knownProfile = SUHAS_PROFILE;
              }
            }

            return {
              id: i,
              box: {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              },
              age: Math.round(d.age),
              gender: d.gender,
              genderProbability: Math.round(d.genderProbability * 100),
              expressions: Object.fromEntries(
                Object.entries(d.expressions as Record<string, unknown>).filter(
                  ([, v]) => typeof v === "number"
                )
              ) as Record<string, number>,
              dominantExpression: expressionEntries[0]?.expression || "neutral",
              isSuhas,
              suhasConfidence,
              knownProfile,
            };
          }
        );

        setState((prev) => ({ ...prev, isDetecting: false, faces }));
        return faces;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          error: `Face detection failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }));
        return [];
      }
    },
    [state.modelLoaded]
  );

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      faces: [],
      error: null,
      isDetecting: false,
    }));
  }, []);

  return {
    ...state,
    loadModels,
    detectFaces,
    reset,
  };
}
