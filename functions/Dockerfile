# Start from a minimal Python 3.11 container
FROM python:3.11-slim

# [Optional] Ensure we use UTF-8 encoding by default
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Expose port 8080 (the default port Cloud Functions / Functions Framework will listen on)
ENV PORT=8080

# Update apt-get and install dependencies required for Blender
RUN apt-get update && \
    apt-get install -y wget xz-utils \
    # Common libraries for headless Blender:
    libgl1 libglu1 libxi6 libxrender1 libxxf86vm1 libxfixes3 libxkbcommon0 \
    libxcb1 libxcb-glx0 libxcb-xfixes0 libsm6 libice6 libxext6 libxcomposite1 \
    libxdamage1 libxrandr2 libxinerama1 mesa-utils \
    # Then download & extract Blender
    && wget https://download.blender.org/release/Blender3.6/blender-3.6.0-linux-x64.tar.xz \
    && tar -xf blender-3.6.0-linux-x64.tar.xz -C /usr/local \
    && rm blender-3.6.0-linux-x64.tar.xz \
    # Create symlink so we can call 'blender' directly
    && ln -s /usr/local/blender-3.6.0-linux-x64/blender /usr/local/bin/blender \
    # Clean up apt cache to reduce image size
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your source code
COPY . /app

# By default, the Functions Framework looks for a function named "main" if not specified,
# or we can specify this environment variable so it knows which function to call by default.
# For example, if your function in main.py is named "convert_glb_http":
# ENV FUNCTION_TARGET=convert_glb_http
# Or if your function is named something else, set it here. Let's assume "convert_glb_http".
ENV FUNCTION_TARGET=convert_glb_http

# Start the Functions Framework on port 8080
CMD ["functions-framework", "--target=convert_glb_http", "--port=8080"]