#!/bin/bash

# TranscriptionProject Development Server Launcher
echo "🚀 Starting TranscriptionProject Development Servers..."

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"

# Function to cleanup background processes on exit
cleanup() {
    echo "🛑 Shutting down development servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Start Vite dev server in background
echo "⚡ Starting Vite development server..."
npm run dev:vite &
VITE_PID=$!

# Wait a moment for Vite to start
sleep 3

# Start Electron in background
echo "🖥️  Starting Electron application..."
npm run dev:electron &
ELECTRON_PID=$!

echo ""
echo "✅ Development servers started!"
echo "📝 Vite server: http://localhost:5173"
echo "🖥️  Electron app should open automatically"
echo ""
echo "💡 Press Ctrl+C to stop both servers"
echo ""

# Wait for background processes
wait
