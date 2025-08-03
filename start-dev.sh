#!/bin/bash

# Navigate to the project directory
cd "/Users/chrismcleod/Documents/ClaudeAccess/ClaudeTranscriptionProject/TranscriptionProject"

# Clean any existing processes
echo "🧹 Cleaning up existing processes..."
npm run clean:dev > /dev/null 2>&1
pkill -f electron > /dev/null 2>&1 || true

# Wait a moment for cleanup
sleep 1

# Start the development servers
echo "🚀 Starting development servers..."
npm run start-dev