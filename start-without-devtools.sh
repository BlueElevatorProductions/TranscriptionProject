#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🎯 Starting TranscriptionProject without DevTools..."
echo "✨ This version optimizes transparency effects without debugging tools"
echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Change to project directory
cd "$SCRIPT_DIR"

# Kill any existing processes first
echo "🧹 Cleaning up existing processes..."
pkill -f "vite" || true
pkill -f "electron" || true

# Wait a moment for ports to be released
sleep 2

# Start Vite in the background
echo "⚡ Starting Vite dev server..."
npm run dev:vite &
VITE_PID=$!

# Wait for Vite to actually serve content
echo "⏳ Waiting for Vite to serve content..."
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Vite is serving content!"
    break
  fi
  echo "   Attempt $i/30..."
  sleep 1
  if [ $i -eq 30 ]; then
    echo "❌ Vite failed to start after 30 seconds"
    exit 1
  fi
done

# Wait a bit more to ensure everything is ready
if curl -s http://localhost:3000 > /dev/null; then
  sleep 3
fi

# Start Electron without DevTools, but load from Vite dev server
echo "🖥️  Starting Electron without DevTools..."
USE_LOCALHOST=true DEVTOOLS_ENABLED=false npm run dev:electron

# Clean up when done
echo "🧹 Cleaning up..."
kill $VITE_PID 2>/dev/null || true

echo "👋 TranscriptionProject (without DevTools) has been stopped."
