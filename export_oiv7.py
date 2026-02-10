from ultralytics import YOLO

# Load a model (OpenImages V7)
model = YOLO("yolov8n-oiv7.pt")

# Export the model
model.export(format="onnx", opset=12)
