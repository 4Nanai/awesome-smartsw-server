FROM python:3.13-trixie

WORKDIR /app

# Install system dependencies needed for LightGBM
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements
COPY ml/requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy full project (so ML worker can access CSV + ONNX)
COPY . /app

# Optional: ensure Python script is executable
RUN chmod +x /app/ml/ml/train_lightgbm.py

# Keep container running (Node will "docker exec" into it)
CMD ["sleep", "infinity"]
