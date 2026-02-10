"""
Copy a balanced subset of Kaggle face images as negative examples (not suhas).
Images are copied with EMPTY label files so YOLO treats them as background.
"""
import os
import random
import shutil

KAGGLE_DIR = os.path.join(os.path.dirname(__file__), "not suhas")
DATASET_DIR = os.path.join(os.path.dirname(__file__), "suhas")

KAGGLE_TRAIN = os.path.join(KAGGLE_DIR, "images", "train")
KAGGLE_VAL = os.path.join(KAGGLE_DIR, "images", "val")

TRAIN_IMG = os.path.join(DATASET_DIR, "train", "images")
TRAIN_LBL = os.path.join(DATASET_DIR, "train", "labels")
VALID_IMG = os.path.join(DATASET_DIR, "valid", "images")
VALID_LBL = os.path.join(DATASET_DIR, "valid", "labels")

# How many negatives to add (keep roughly 3:1 ratio with positives)
NUM_TRAIN_NEG = 50
NUM_VALID_NEG = 15

random.seed(42)


def copy_negatives(src_dir, dst_img_dir, dst_lbl_dir, count, prefix="neg"):
    """Copy random images as negative examples with empty label files."""
    os.makedirs(dst_img_dir, exist_ok=True)
    os.makedirs(dst_lbl_dir, exist_ok=True)

    exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
    all_images = [f for f in os.listdir(src_dir) if f.lower().endswith(exts)]

    if len(all_images) == 0:
        print(f"  No images found in {src_dir}")
        return 0

    selected = random.sample(all_images, min(count, len(all_images)))
    copied = 0

    for img_name in selected:
        # Prefix to avoid name collisions with existing dataset
        new_name = f"{prefix}_{img_name}"
        base = os.path.splitext(new_name)[0]

        src_path = os.path.join(src_dir, img_name)
        dst_img_path = os.path.join(dst_img_dir, new_name)
        dst_lbl_path = os.path.join(dst_lbl_dir, base + ".txt")

        # Skip if already exists
        if os.path.exists(dst_img_path):
            continue

        shutil.copy2(src_path, dst_img_path)
        # Empty label = no objects = negative example for YOLO
        open(dst_lbl_path, "w").close()
        copied += 1

    return copied


def main():
    print("Adding negative examples (not suhas) from Kaggle dataset\n")

    print(f"Copying {NUM_TRAIN_NEG} negative images to train...")
    train_copied = copy_negatives(KAGGLE_TRAIN, TRAIN_IMG, TRAIN_LBL, NUM_TRAIN_NEG)
    print(f"  Copied {train_copied} images\n")

    print(f"Copying {NUM_VALID_NEG} negative images to valid...")
    valid_copied = copy_negatives(KAGGLE_VAL, VALID_IMG, VALID_LBL, NUM_VALID_NEG)
    print(f"  Copied {valid_copied} images\n")

    # Print final dataset stats
    exts = (".jpg", ".jpeg", ".png", ".bmp", ".webp")
    train_total = len([f for f in os.listdir(TRAIN_IMG) if f.lower().endswith(exts)])
    valid_total = len([f for f in os.listdir(VALID_IMG) if f.lower().endswith(exts)])

    train_pos = len([f for f in os.listdir(TRAIN_LBL) if f.endswith(".txt") and os.path.getsize(os.path.join(TRAIN_LBL, f)) > 0])
    valid_pos = len([f for f in os.listdir(VALID_LBL) if f.endswith(".txt") and os.path.getsize(os.path.join(VALID_LBL, f)) > 0])

    train_neg = train_total - train_pos
    valid_neg = valid_total - valid_pos

    print("=" * 50)
    print("Final dataset:")
    print(f"  Train: {train_total} images ({train_pos} suhas, {train_neg} not-suhas)")
    print(f"  Valid: {valid_total} images ({valid_pos} suhas, {valid_neg} not-suhas)")
    print("=" * 50)
    print("\nReady to train! Run: python train_yolo.py")


if __name__ == "__main__":
    main()
