# Start from a minimal Python 3.11 container
FROM python:3.11-slim

# Set environment variables for UTF-8 encoding
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PORT=8080 \
    FUNCTION_TARGET=convert_glb_http

# Update apt-get and install dependencies required for Blender
RUN apt-get update && \
    apt-get install -y \
        wget \
        xz-utils \
        # Common libraries for headless Blender
        libgl1 \
        libglu1 \
        libxi6 \
        libxrender1 \
        libxxf86vm1 \
        libxfixes3 \
        libxkbcommon0 \
        libxcb1 \
        libxcb-glx0 \
        libxcb-xfixes0 \
        libsm6 \
        libice6 \
        libxext6 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libxinerama1 \
        mesa-utils \
    && \
    # Download & extract Blender
    wget https://download.blender.org/release/Blender3.6/blender-3.6.0-linux-x64.tar.xz && \
    tar -xf blender-3.6.0-linux-x64.tar.xz -C /usr/local && \
    rm blender-3.6.0-linux-x64.tar.xz && \
    # Create symlink for blender command
    ln -s /usr/local/blender-3.6.0-linux-x64/blender /usr/local/bin/blender && \
    # Clean up apt cache
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Start the Functions Framework
CMD ["functions-framework", "--target=convert_glb_http", "--port=8080"]
