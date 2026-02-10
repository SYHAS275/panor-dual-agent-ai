"""
Train YOLOv8 on the suhas face dataset, then export to ONNX for browser use.

IMPORTANT: To reduce false positives (other people detected as suhas),
add "negative" images — photos of OTHER people (not suhas) — to the
train/images folder WITHOUT any corresponding label .txt file (or with
an empty .txt file). This teaches the model what is NOT suhas.

Steps to improve accuracy:
  1. Add 30-50+ images of Suhas in varied lighting, angles, expressions
  2. Add 30-50+ images of OTHER people (negative examples) with empty .txt labels
  3. Run this script to retrain
"""
from ultralytics import YOLO
import os
import glob

DATA_DIR = os.path.join(os.path.dirname(__file__), "suhas")
DATA_YAML = os.path.join(DATA_DIR, "data.yaml")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "public", "yolo")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Step 0: Ensure negative images have empty label files ---
# YOLO treats images with empty label files as background (negative) examples.
# This scans for images missing a label file and creates empty ones.
TRAIN_IMG_DIR = os.path.join(DATA_DIR, "train", "images")
TRAIN_LBL_DIR = os.path.join(DATA_DIR, "train", "labels")
VALID_IMG_DIR = os.path.join(DATA_DIR, "valid", "images")
VALID_LBL_DIR = os.path.join(DATA_DIR, "valid", "labels")

def ensure_empty_labels(img_dir, lbl_dir):
    """Create empty .txt label files for images that don't have one (negative examples)."""
    os.makedirs(lbl_dir, exist_ok=True)
    count = 0
    for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp"):
        for img_path in glob.glob(os.path.join(img_dir, ext)):
            base = os.path.splitext(os.path.basename(img_path))[0]
            lbl_path = os.path.join(lbl_dir, base + ".txt")
            if not os.path.exists(lbl_path):
                open(lbl_path, "w").close()  # empty file = no objects = negative example
                count += 1
    return count

print("=" * 50)
print("Step 0: Checking for negative/background images")
print("=" * 50)

neg_train = ensure_empty_labels(TRAIN_IMG_DIR, TRAIN_LBL_DIR)
neg_valid = ensure_empty_labels(VALID_IMG_DIR, VALID_LBL_DIR)
print(f"  Created {neg_train} empty label files in train (negative examples)")
print(f"  Created {neg_valid} empty label files in valid (negative examples)")

# Count dataset stats
train_imgs = len(glob.glob(os.path.join(TRAIN_IMG_DIR, "*.*")))
train_pos = len([f for f in glob.glob(os.path.join(TRAIN_LBL_DIR, "*.txt")) if os.path.getsize(f) > 0])
train_neg = train_imgs - train_pos
print(f"\n  Training: {train_imgs} images ({train_pos} positive, {train_neg} negative)")

if train_neg == 0:
    print("\n  WARNING: No negative examples found!")
    print("  Add images of OTHER people to suhas/train/images/ (without label files)")
    print("  This is critical to stop the model labeling everyone as suhas.\n")

print("\n" + "=" * 50)
print("Step 1: Training YOLOv8n on suhas dataset")
print("=" * 50)

model = YOLO("yolov8n.pt")  # Start from pretrained nano model

results = model.train(
    data=DATA_YAML,
    epochs=150,
    imgsz=640,
    batch=4,
    patience=30,
    project=OUTPUT_DIR,
    name="suhas_model",
    exist_ok=True,
    verbose=True,
)

# Find the best weights
best_pt = os.path.join(OUTPUT_DIR, "suhas_model", "weights", "best.pt")

if not os.path.exists(best_pt):
    # Fall back to last.pt
    best_pt = os.path.join(OUTPUT_DIR, "suhas_model", "weights", "last.pt")

print("=" * 50)
print(f"Step 2: Exporting {best_pt} to ONNX")
print("=" * 50)

trained_model = YOLO(best_pt)
export_path = trained_model.export(format="onnx", imgsz=640, simplify=True)

# Copy ONNX to public/yolo/ for serving
import shutil
onnx_dest = os.path.join(OUTPUT_DIR, "suhas_model.onnx")
if export_path and os.path.exists(export_path):
    shutil.copy2(export_path, onnx_dest)
    print(f"\nONNX model saved to: {onnx_dest}")
    print(f"File size: {os.path.getsize(onnx_dest) / 1024 / 1024:.2f} MB")
else:
    print("ERROR: ONNX export failed")

print("\nDone! The model is ready for browser inference.")
