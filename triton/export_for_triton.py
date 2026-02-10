"""
Re-export YOLO models with ONNX opset 21 for Triton compatibility.
"""
import os
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
YOLO_DIR = PROJECT_ROOT / "public" / "yolo"
TRITON_MODELS_DIR = Path(__file__).parent / "models"

def export_model(model_path: Path, output_dir: Path, model_name: str):
    """Export a YOLO model to ONNX with opset 21."""
    from ultralytics import YOLO

    print(f"\nExporting {model_name}...")
    print(f"  Source: {model_path}")

    # Load the model (from .pt if available, otherwise from .onnx)
    pt_path = model_path.with_suffix('.pt')
    if pt_path.exists():
        model = YOLO(str(pt_path))
    else:
        model = YOLO(str(model_path))

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    version_dir = output_dir / "1"
    version_dir.mkdir(exist_ok=True)

    # Export to ONNX with opset 21
    output_path = version_dir / "model.onnx"
    model.export(
        format="onnx",
        opset=21,  # Use opset 21 for Triton compatibility
        simplify=True,
        dynamic=False,  # Fixed batch size for easier Triton config
        imgsz=640,
    )

    # Move the exported file to the correct location
    exported_file = model_path.with_suffix('.onnx')
    if exported_file != output_path:
        import shutil
        # Find the exported file (ultralytics puts it next to the source)
        possible_locations = [
            model_path.parent / (model_path.stem + ".onnx"),
            pt_path.parent / (pt_path.stem + ".onnx") if pt_path.exists() else None,
        ]
        for loc in possible_locations:
            if loc and loc.exists() and loc != output_path:
                shutil.copy(str(loc), str(output_path))
                print(f"  Copied to: {output_path}")
                break

    print(f"  Output: {output_path}")
    return output_path


def get_model_info(onnx_path: Path):
    """Get input/output info from ONNX model."""
    import onnx

    model = onnx.load(str(onnx_path))

    print(f"\nModel info for {onnx_path.name}:")
    print(f"  Opset: {model.opset_import[0].version}")

    print("  Inputs:")
    for inp in model.graph.input:
        shape = [d.dim_value if d.dim_value else d.dim_param for d in inp.type.tensor_type.shape.dim]
        print(f"    {inp.name}: {shape}")

    print("  Outputs:")
    for out in model.graph.output:
        shape = [d.dim_value if d.dim_value else d.dim_param for d in out.type.tensor_type.shape.dim]
        print(f"    {out.name}: {shape}")

    return model


def create_triton_config(output_dir: Path, model_name: str, input_shape: list, output_shape: list):
    """Create Triton config.pbtxt for the model."""

    # Format shapes for Triton (exclude batch dimension if using max_batch_size=0)
    input_dims = ", ".join(str(d) for d in input_shape)
    output_dims = ", ".join(str(d) if d > 0 else "-1" for d in output_shape)

    config = f'''name: "{model_name}"
platform: "onnxruntime_onnx"
max_batch_size: 0

input [
  {{
    name: "images"
    data_type: TYPE_FP32
    dims: [ {input_dims} ]
  }}
]

output [
  {{
    name: "output0"
    data_type: TYPE_FP32
    dims: [ {output_dims} ]
  }}
]

instance_group [
  {{
    count: 1
    kind: KIND_GPU
  }}
]
'''

    config_path = output_dir / "config.pbtxt"
    config_path.write_text(config)
    print(f"  Config written to: {config_path}")


def main():
    print("=" * 60)
    print("Exporting YOLO models for NVIDIA Triton")
    print("=" * 60)

    # Check if we have the .pt files for better export
    suhas_pt = YOLO_DIR / "suhas_model" / "weights" / "best.pt"
    suhas_onnx = YOLO_DIR / "suhas_model.onnx"

    oiv7_onnx = YOLO_DIR / "yolov8n-oiv7.onnx"

    # For suhas_model - try to find the .pt file
    if suhas_pt.exists():
        print(f"\nFound suhas_model .pt file: {suhas_pt}")
        export_model(suhas_pt, TRITON_MODELS_DIR / "suhas_model", "suhas_model")
    elif suhas_onnx.exists():
        print(f"\nUsing existing suhas_model.onnx: {suhas_onnx}")
        # Just copy and get info
        import shutil
        dest = TRITON_MODELS_DIR / "suhas_model" / "1" / "model.onnx"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(str(suhas_onnx), str(dest))

    # Get model info and create configs
    import onnx

    # suhas_model
    suhas_triton = TRITON_MODELS_DIR / "suhas_model" / "1" / "model.onnx"
    if suhas_triton.exists():
        model = get_model_info(suhas_triton)
        inp = model.graph.input[0]
        out = model.graph.output[0]
        input_shape = [d.dim_value for d in inp.type.tensor_type.shape.dim]
        output_shape = [d.dim_value for d in out.type.tensor_type.shape.dim]
        create_triton_config(TRITON_MODELS_DIR / "suhas_model", "suhas_model", input_shape, output_shape)

    # yolov8n_oiv7
    oiv7_triton = TRITON_MODELS_DIR / "yolov8n_oiv7" / "1" / "model.onnx"
    if oiv7_triton.exists():
        model = get_model_info(oiv7_triton)
        inp = model.graph.input[0]
        out = model.graph.output[0]
        input_shape = [d.dim_value for d in inp.type.tensor_type.shape.dim]
        output_shape = [d.dim_value for d in out.type.tensor_type.shape.dim]
        create_triton_config(TRITON_MODELS_DIR / "yolov8n_oiv7", "yolov8n_oiv7", input_shape, output_shape)

    print("\n" + "=" * 60)
    print("Done! Now rebuild Triton:")
    print("  docker-compose -f docker-compose.triton.yml up --build")
    print("=" * 60)


if __name__ == "__main__":
    main()
