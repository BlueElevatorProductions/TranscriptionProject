#!/bin/bash
set -euo pipefail

# Navigate to the project directory
ROOT_DIR="/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject"
cd "$ROOT_DIR/TranscriptionProject"

# Prepare log files directory
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
VITE_LOG="$LOG_DIR/vite_$(date +%Y%m%d_%H%M%S).log"
ELECTRON_LOG="$LOG_DIR/electron_$(date +%Y%m%d_%H%M%S).log"
{
  echo "=========================="
  echo "🚀 TranscriptionProject v2.0 started: $(date)"
  echo "=========================="
} >> "$ELECTRON_LOG"

build_juce_backend() {
  echo "🔨 Building JUCE backend..." | tee -a "$ELECTRON_LOG"
  local JUCE_SRC_DIR_DEFAULT="$ROOT_DIR/TranscriptionProject/native/JUCE"
  local JUCE_DIR_ENV="${JUCE_DIR:-}"
  if [ -z "$JUCE_DIR_ENV" ]; then
    if [ -d "$JUCE_SRC_DIR_DEFAULT" ]; then
      export JUCE_DIR="$JUCE_SRC_DIR_DEFAULT"
    else
      echo "❌ JUCE source not found. Set JUCE_DIR to your JUCE path." | tee -a "$ELECTRON_LOG"
      return 1
    fi
  fi

  local BUILD_DIR="$ROOT_DIR/TranscriptionProject/native/juce-backend/build"
  mkdir -p "$BUILD_DIR"
  local BUILD_LOG="$LOG_DIR/juce_build_$(date +%Y%m%d_%H%M%S).log"
  (
    cd "$BUILD_DIR"
    echo "📦 CMake configure (USE_JUCE=ON, JUCE_DIR=$JUCE_DIR)" | tee -a "$ELECTRON_LOG"
    cmake -DUSE_JUCE=ON -DCMAKE_BUILD_TYPE=Release -DJUCE_DIR="$JUCE_DIR" .. 2>&1 | tee -a "$BUILD_LOG"
    echo "🏗️  CMake build (Release)" | tee -a "$ELECTRON_LOG"
    cmake --build . --config Release 2>&1 | tee -a "$BUILD_LOG"
  )
  local status=$?
  if [ $status -ne 0 ]; then
    echo "❌ JUCE backend build failed. See $BUILD_LOG" | tee -a "$ELECTRON_LOG"
    # Print the last 60 lines to the main log for quick visibility
    tail -n 60 "$BUILD_LOG" >> "$ELECTRON_LOG" 2>/dev/null || true
    return $status
  fi
  echo "✅ JUCE backend build completed. Log: $BUILD_LOG" | tee -a "$ELECTRON_LOG"
}

# Build backend and resolve binary
build_juce_backend || {
  echo "❌ JUCE backend build failed. Aborting launch." | tee -a "$ELECTRON_LOG"
  exit 1
}

echo "🔎 Resolving JUCE backend binary..." | tee -a "$ELECTRON_LOG"
JUCE_BACKEND_PATH_ENV="${JUCE_BACKEND_PATH:-}"
if [ -z "$JUCE_BACKEND_PATH_ENV" ]; then
  # Prefer freshly built binary
  CANDIDATES=(
    "$ROOT_DIR/TranscriptionProject/native/juce-backend/build/juce-backend"
    "$ROOT_DIR/TranscriptionProject/native/juce-backend/build/Release/juce-backend"
    "$ROOT_DIR/TranscriptionProject/resources/juce/juce-backend"
    "$ROOT_DIR/resources/juce/juce-backend"
  )
  for c in "${CANDIDATES[@]}"; do
    if [ -f "$c" ]; then
      JUCE_BACKEND_PATH_ENV="$c"
      break
    fi
  done
fi

if [ -z "$JUCE_BACKEND_PATH_ENV" ]; then
  echo "❌ JUCE backend binary not found after build. Aborting launch." | tee -a "$ELECTRON_LOG"
  exit 1
fi

export JUCE_BACKEND_PATH="$JUCE_BACKEND_PATH_ENV"
export VITE_USE_JUCE=true
if [ -w "$JUCE_BACKEND_PATH" ]; then chmod +x "$JUCE_BACKEND_PATH" 2>/dev/null || true; fi
export VITE_AUDIO_DEBUG=true
export EDL_DEBUG_DIR="$LOG_DIR/edl"
export JUCE_DEBUG_DIR="$LOG_DIR/juce"
mkdir -p "$EDL_DEBUG_DIR" "$JUCE_DEBUG_DIR" 2>/dev/null || true
echo "✅ JUCE backend: ${JUCE_BACKEND_PATH}" | tee -a "$ELECTRON_LOG"
echo "   VITE_USE_JUCE=${VITE_USE_JUCE}" | tee -a "$ELECTRON_LOG"
echo "   VITE_AUDIO_DEBUG=true" | tee -a "$ELECTRON_LOG"
echo "   EDL_DEBUG_DIR=$EDL_DEBUG_DIR" | tee -a "$ELECTRON_LOG"
echo "   JUCE_DEBUG_DIR=$JUCE_DEBUG_DIR" | tee -a "$ELECTRON_LOG"

# Clean any existing processes
echo "🧹 Cleaning up..."
pkill -f "vite" || true
pkill -f "electron" || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Start Vite in the background
echo "⚡ Starting Vite dev server..."
USE_LOCALHOST=true DEVTOOLS_ENABLED=true npm run dev:vite 2>&1 | tee -a "$VITE_LOG" &
VITE_PID=$!

# Wait for Vite to serve content
echo "⏳ Waiting for Vite to serve content..."
for i in {1..30}; do
  if curl -s http://localhost:3000 | grep -q "<!DOCTYPE html>"; then
    echo "✅ Vite is serving content!"
    break
  fi
  echo "   Attempt $i/30..."
  sleep 1
done

if [ ${i:-30} -eq 30 ]; then
  echo "⚠️  Vite might not be serving content properly, continuing anyway..."
fi

# Start Electron
echo "🖥️ Starting Electron with debugging enabled..."
USE_LOCALHOST=true DEVTOOLS_ENABLED=true ELECTRON_ENABLE_LOGGING=true ELECTRON_ENABLE_STACK_DUMPING=true npm run dev:electron 2>&1 | tee -a "$ELECTRON_LOG"

# Clean up when done
kill $VITE_PID 2>/dev/null || true
