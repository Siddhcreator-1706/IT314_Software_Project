# ==============================================================================
# AI Worker - Optimized Minimal Build
# ==============================================================================
FROM python:3.10-slim

WORKDIR /app

# Python environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install heavy dependencies first to leverage Docker layer caching
# Adding build tools if compiling C/C++ dependencies for ML models
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy source code
COPY . .

# Create a non-root user for security
RUN addgroup --system --gid 1001 aiworker && \
    adduser --system --uid 1001 aiworker && \
    chown -R aiworker:aiworker /app

USER aiworker

# Command to execute the worker process
CMD ["python", "-m", "worker"]
