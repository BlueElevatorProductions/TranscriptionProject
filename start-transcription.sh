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
  echo "🚀 New run started: $(date)"
  echo "=========================="
} >> "$ELECTRON_LOG"

# Resolve JUCE backend binary path (for JuceClient)
echo "🔎 Looking for JUCE backend binary..."
JUCE_BACKEND_PATH_ENV="${JUCE_BACKEND_PATH:-}"
if [ -z "$JUCE_BACKEND_PATH_ENV" ]; then
  CANDIDATES=(
    "$ROOT_DIR/resources/juce/juce-backend"
    "$ROOT_DIR/resources/juce/juce-backend.exe"
    "$ROOT_DIR/TranscriptionProject/resources/juce/juce-backend"
    "$ROOT_DIR/TranscriptionProject/resources/juce/juce-backend.exe"
    "$ROOT_DIR/TranscriptionProject/native/juce-backend/build/juce-backend"
    "$ROOT_DIR/TranscriptionProject/native/juce-backend/juce-backend"
  )
  for c in "${CANDIDATES[@]}"; do
    if [ -f "$c" ]; then
      JUCE_BACKEND_PATH_ENV="$c"
      break
    fi
  done
fi

# Fail if JUCE backend not found
if [ -n "$JUCE_BACKEND_PATH_ENV" ]; then
  export JUCE_BACKEND_PATH="$JUCE_BACKEND_PATH_ENV"
  export VITE_USE_JUCE=true
  export VITE_AUDIO_DEBUG=true
  export EDL_DEBUG_DIR="$LOG_DIR/edl"
  export JUCE_DEBUG_DIR="$LOG_DIR/juce"
  echo "✅ JUCE backend: $JUCE_BACKEND_PATH" | tee -a "$ELECTRON_LOG"
  echo "   VITE_USE_JUCE=true" | tee -a "$ELECTRON_LOG"
  echo "   VITE_AUDIO_DEBUG=true" | tee -a "$ELECTRON_LOG"
  echo "   EDL_DEBUG_DIR=$EDL_DEBUG_DIR" | tee -a "$ELECTRON_LOG"
  echo "   JUCE_DEBUG_DIR=$JUCE_DEBUG_DIR" | tee -a "$ELECTRON_LOG"
  if [ -w "$JUCE_BACKEND_PATH" ]; then chmod +x "$JUCE_BACKEND_PATH" 2>/dev/null || true; fi
else
  echo "❌ JUCE backend not found. Aborting launch." | tee -a "$ELECTRON_LOG"
  echo "   Build it with: cd TranscriptionProject && scripts/build-juce.sh" | tee -a "$ELECTRON_LOG"
  exit 1
fi

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
