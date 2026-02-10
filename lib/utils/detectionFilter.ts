import type { YoloDetection } from "../hooks/useYoloDetection";

// Labels that are face/person-related
const FACE_LABELS = new Set([
  "Suhas R",
  "Human face",
  "Human head",
  "Person",
  "Man",
  "Woman",
  "Boy",
  "Girl",
  "Human body",
  "Human eye",
  "Human nose",
  "Human mouth",
  "Human ear",
  "Human hair",
  "Human beard",
]);

// Filter detections to only show faces/people
export function filterFaceDetections(detections: YoloDetection[]): YoloDetection[] {
  return detections.filter((det) => {
    return FACE_LABELS.has(det.label) || det.age !== undefined;
  });
}

// Filter detections to only show objects (exclude faces/people)
export function filterObjectDetections(detections: YoloDetection[]): YoloDetection[] {
  return detections.filter((det) => {
    return !FACE_LABELS.has(det.label);
  });
}
