from ultralytics import YOLO
import json

model = YOLO("yolov8n-oiv7.pt")
names = model.names
# Ensure it's a list sorted by key if it's a dict
if isinstance(names, dict):
    sorted_names = [names[i] for i in range(len(names))]
else:
    sorted_names = names

with open("classes.json", "w") as f:
    json.dump(sorted_names, f)
