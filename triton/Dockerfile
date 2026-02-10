# NVIDIA Triton Inference Server with ONNX Runtime
# Using 25.01 for latest ONNX opset support
FROM nvcr.io/nvidia/tritonserver:25.01-py3

# Copy model repository
COPY models /models

# Expose Triton ports
# 8000 = HTTP
# 8001 = gRPC
# 8002 = Metrics
EXPOSE 8000 8001 8002

# Start Triton with model repository
CMD ["tritonserver", "--model-repository=/models", "--strict-model-config=false"]
