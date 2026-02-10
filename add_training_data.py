"""
Auto-annotate Suhas images using OpenCV face detection and add them to the YOLO dataset.
Detects face bounding boxes, creates YOLO-format labels, and copies to train/valid splits.
"""
import cv2
import os
import shutil
import random

SRC_DIR = os.path.join(os.path.dirname(__file__), "data")
DATASET_DIR = os.path.join(os.path.dirname(__file__), "suhas")
TRAIN_IMG = os.path.join(DATASET_DIR, "train", "images")
TRAIN_LBL = os.path.join(DATASET_DIR, "train", "labels")
VALID_IMG = os.path.join(DATASET_DIR, "valid", "images")
VALID_LBL = os.path.join(DATASET_DIR, "valid", "labels")

# Create dirs
for d in [TRAIN_IMG, TRAIN_LBL, VALID_IMG, VALID_LBL]:
    os.makedirs(d, exist_ok=True)

# Load OpenCV face detector (DNN-based, more accurate than Haar)
# Fall back to Haar cascade if DNN model not available
def get_face_detector():
    # Try DNN first (more accurate)
    dnn_proto = cv2.data.haarcascades.replace("haarcascades", "")
    proto_path = os.path.join(dnn_proto, "deploy.prototxt")
    model_path = os.path.join(dnn_proto, "res10_300x300_ssd_iter_140000.caffemodel")

    if os.path.exists(proto_path) and os.path.exists(model_path):
        return "dnn", cv2.dnn.readNetFromCaffe(proto_path, model_path)

    # Fall back to Haar cascade
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    return "haar", cv2.CascadeClassifier(cascade_path)


def detect_face_dnn(net, img):
    """Detect faces using OpenCV DNN."""
    h, w = img.shape[:2]
    blob = cv2.dnn.blobFromImage(img, 1.0, (300, 300), (104.0, 177.0, 123.0))
    net.setInput(blob)
    detections = net.forward()

    faces = []
    for i in range(detections.shape[2]):
        confidence = detections[0, 0, i, 2]
        if confidence > 0.5:
            x1 = max(0, int(detections[0, 0, i, 3] * w))
            y1 = max(0, int(detections[0, 0, i, 4] * h))
            x2 = min(w, int(detections[0, 0, i, 5] * w))
            y2 = min(h, int(detections[0, 0, i, 6] * h))
            faces.append((x1, y1, x2 - x1, y2 - y1, confidence))
    return faces


def detect_face_haar(cascade, img):
    """Detect faces using Haar cascade."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces_raw = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
    faces = []
    for (x, y, w, h) in faces_raw:
        faces.append((x, y, w, h, 0.9))
    return faces


def to_yolo_label(img_w, img_h, x, y, w, h):
    """Convert pixel bbox to YOLO normalized format: class cx cy w h"""
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h
    nw = w / img_w
    nh = h / img_h
    return f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}"


def main():
    detector_type, detector = get_face_detector()
    print(f"Using {detector_type} face detector")

    # Get all images
    exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
    images = sorted([f for f in os.listdir(SRC_DIR) if f.lower().endswith(exts)])

    if not images:
        print(f"No images found in {SRC_DIR}")
        return

    print(f"Found {len(images)} images in {SRC_DIR}\n")

    # Shuffle and split: 80% train, 20% valid
    random.seed(42)
    random.shuffle(images)
    split_idx = max(1, int(len(images) * 0.8))
    train_images = images[:split_idx]
    valid_images = images[split_idx:]

    print(f"Split: {len(train_images)} train, {len(valid_images)} valid\n")

    success = 0
    failed = 0

    for img_name in images:
        is_train = img_name in train_images
        img_dir = TRAIN_IMG if is_train else VALID_IMG
        lbl_dir = TRAIN_LBL if is_train else VALID_LBL
        split_name = "train" if is_train else "valid"

        src_path = os.path.join(SRC_DIR, img_name)
        img = cv2.imread(src_path)
        if img is None:
            print(f"  SKIP {img_name} - could not read")
            failed += 1
            continue

        h, w = img.shape[:2]

        # Detect faces
        if detector_type == "dnn":
            faces = detect_face_dnn(detector, img)
        else:
            faces = detect_face_haar(detector, img)

        if not faces:
            # If no face detected, use center crop as fallback (assume face is centered)
            print(f"  WARN {img_name} - no face detected, using center fallback")
            fx = int(w * 0.15)
            fy = int(h * 0.05)
            fw = int(w * 0.7)
            fh = int(h * 0.8)
            faces = [(fx, fy, fw, fh, 0.5)]

        # Take the largest / most confident face
        best_face = max(faces, key=lambda f: f[2] * f[3])
        bx, by, bw, bh, conf = best_face

        # Create YOLO label
        label_line = to_yolo_label(w, h, bx, by, bw, bh)

        # Copy image
        base = os.path.splitext(img_name)[0]
        dst_img = os.path.join(img_dir, img_name)
        dst_lbl = os.path.join(lbl_dir, base + ".txt")

        shutil.copy2(src_path, dst_img)
        with open(dst_lbl, "w") as f:
            f.write(label_line + "\n")

        print(f"  OK   {img_name} -> {split_name} | face: ({bx},{by},{bw},{bh}) conf={conf:.2f}")
        success += 1

    print(f"\nDone! {success} images annotated, {failed} failed.")
    print(f"  Train: {len(train_images)} | Valid: {len(valid_images)}")

    # Count total dataset
    total_train = len(os.listdir(TRAIN_IMG))
    total_valid = len(os.listdir(VALID_IMG))
    print(f"\nTotal dataset now: {total_train} train images, {total_valid} valid images")
    print("\nNext step: Add negative images (other people) and run train_yolo.py")


if __name__ == "__main__":
    main()
