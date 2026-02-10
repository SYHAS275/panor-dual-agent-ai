===============================================================================
            PANOR.AI - NVIDIA Triton Inference Server Setup
===============================================================================

This guide explains how to run your YOLO object detection models on NVIDIA
Triton Inference Server for faster GPU-accelerated inference.


========================================
 REQUIREMENTS
========================================

1. NVIDIA GPU (GTX 1060 or better recommended)
2. NVIDIA Drivers installed
3. Docker Desktop with WSL2 backend
4. NVIDIA Container Toolkit (nvidia-docker)


========================================
 INSTALL NVIDIA CONTAINER TOOLKIT (Windows)
========================================

Step 1: Enable WSL2 GPU support
-------------------------------
  - Install latest NVIDIA drivers from nvidia.com
  - Enable WSL2 in Docker Desktop (Settings > General > Use WSL 2)
  - GPU support in WSL2 is automatic with recent drivers

Step 2: Verify GPU is visible in Docker
----------------------------------------
  Open PowerShell and run:
    docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi

  If you see your GPU info, you're ready!

Step 3: If "nvidia-smi" fails in Docker
----------------------------------------
  - Update NVIDIA drivers to latest version
  - Restart Docker Desktop
  - Restart your computer
  - Make sure virtualization is enabled in BIOS


========================================
 QUICK START
========================================

Option A: Use the batch file
-----------------------------
  Double-click: triton-start.bat

  This will:
  1. Check for NVIDIA GPU
  2. Build Triton container with your models
  3. Build PANOR.AI app container
  4. Start both services
  5. Open http://localhost:3000 when ready


Option B: Manual Docker Compose
--------------------------------
  docker-compose -f docker-compose.triton.yml up --build

  Then open: http://localhost:3000


========================================
 ARCHITECTURE
========================================

  +-------------------+       +-------------------+
  |                   |       |                   |
  |   PANOR.AI App    | ----> |   Triton Server   |
  |   (Next.js)       |       |   (ONNX Runtime)  |
  |   Port 3000       |       |   Port 8000       |
  |                   |       |                   |
  +-------------------+       +-------------------+
          |                           |
          v                           v
      Browser                    NVIDIA GPU
    (User Interface)           (YOLO Inference)


Instead of running YOLO in the browser with ONNX.js, the app now:
1. Captures frames from webcam/image
2. Sends pixel data to /api/triton endpoint
3. API forwards to Triton server
4. Triton runs inference on GPU
5. Results sent back to browser for display


========================================
 MODELS LOADED
========================================

1. suhas_model
   - Your custom-trained YOLOv8 model
   - Detects: "Suhas"
   - Path: triton/models/suhas_model/1/model.onnx

2. yolov8n_oiv7
   - YOLOv8 Nano trained on Open Images v7
   - Detects: 601 object classes
   - Path: triton/models/yolov8n_oiv7/1/model.onnx


========================================
 USEFUL COMMANDS
========================================

Check Triton health:
  curl http://localhost:8000/v2/health/ready

List loaded models:
  curl http://localhost:8000/v2/models

Get model info:
  curl http://localhost:8000/v2/models/suhas_model
  curl http://localhost:8000/v2/models/yolov8n_oiv7

View Triton logs:
  docker-compose -f docker-compose.triton.yml logs triton

View app logs:
  docker-compose -f docker-compose.triton.yml logs panorai

Stop everything:
  docker-compose -f docker-compose.triton.yml down


========================================
 SWITCHING BETWEEN BROWSER AND TRITON
========================================

The app can use EITHER:
- Browser-based inference (current default)
- Triton server inference (requires GPU + Docker)

To switch, modify the detection components to use:
  import { useTritonDetection } from "@/lib/hooks/useTritonDetection"
instead of:
  import { useYoloDetection } from "@/lib/hooks/useYoloDetection"

Both hooks have the same interface:
  const { detect, isReady } = useTritonDetection();
  const detections = await detect(source, width, height);


========================================
 PERFORMANCE COMPARISON
========================================

                    Browser (ONNX.js)    Triton (GPU)
---------------------------------------------------------
Inference Speed     ~100-300ms           ~10-50ms
CPU Usage           High                 Low
GPU Required        No                   Yes
Works Offline       Yes                  No (needs server)
Setup Complexity    None                 Moderate


========================================
 TROUBLESHOOTING
========================================

Problem: "nvidia-smi" not found in Docker
Fix:     Install NVIDIA Container Toolkit, restart Docker Desktop

Problem: Triton fails to start
Fix:     Check Docker logs: docker-compose -f docker-compose.triton.yml logs triton

Problem: Models not loading
Fix:     Check model paths in triton/models/ directory
         Each model needs: config.pbtxt and 1/model.onnx

Problem: Slow inference
Fix:     Make sure GPU is being used, not CPU fallback
         Check with: curl http://localhost:8000/v2/models/suhas_model/stats

Problem: Out of GPU memory
Fix:     Reduce batch size in config.pbtxt or close other GPU apps


========================================
 COLAB ALTERNATIVE (Free GPU)
========================================

If you don't have an NVIDIA GPU, you can run Triton on Google Colab:

1. Upload triton/ folder to Colab
2. Run this in a Colab cell:

   !pip install tritonclient[all]
   !docker run -d --gpus all -p 8000:8000 -p 8001:8001 -p 8002:8002 \
     -v /content/triton/models:/models \
     nvcr.io/nvidia/tritonserver:24.01-py3 \
     tritonserver --model-repository=/models

3. Use ngrok to expose port 8000
4. Set TRITON_URL in your .env to the ngrok URL

Note: Colab sessions timeout after ~90 minutes of inactivity.


===============================================================================
