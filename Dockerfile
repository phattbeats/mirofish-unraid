FROM node:20-bookworm-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN NODE_ENV=development npm ci

COPY frontend/ ./
ENV VITE_API_BASE_URL=
RUN npm run build


FROM python:3.11-slim

# Runtime deps: node is kept for Claude/Codex CLI wrappers mounted from the host.
# Build deps needed for kuzu, PyMuPDF (native extension modules)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    nodejs npm \
    build-essential \
    cmake \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_DEBUG=false \
    FLASK_HOST=0.0.0.0 \
    FLASK_PORT=5001

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 5001

CMD ["python", "backend/run.py"]
