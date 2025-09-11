#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NATIVE_DIR="$ROOT_DIR/native/juce-backend"
BUILD_DIR="$NATIVE_DIR/build"

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"
JUCE_CMAKE_ARGS=()

# If JUCE_DIR is not set, try to auto-detect via Homebrew
if [ -z "${JUCE_DIR:-}" ]; then
  if command -v brew >/dev/null 2>&1; then
    BREW_JUCE_PREFIX="$(brew --prefix juce 2>/dev/null || true)"
    if [ -n "$BREW_JUCE_PREFIX" ] && [ -d "$BREW_JUCE_PREFIX/lib/cmake/JUCE" ]; then
      export JUCE_DIR="$BREW_JUCE_PREFIX/lib/cmake/JUCE"
      echo "Auto-detected JUCE via Homebrew: $JUCE_DIR"
    fi
  fi
fi

if [ -n "${JUCE_DIR:-}" ]; then
  echo "Using JUCE from: $JUCE_DIR"
  JUCE_CMAKE_ARGS+=("-DUSE_JUCE=ON" "-DJUCE_DIR=$JUCE_DIR")
else
  echo "ERROR: JUCE not found."
  echo "- Install via Homebrew: brew install juce cmake"
  echo "- Or set JUCE_DIR to JUCE source or CMake package path"
  exit 1
fi

cmake .. -DCMAKE_BUILD_TYPE=Release "${JUCE_CMAKE_ARGS[@]}"
cmake --build . --config Release -j

BIN_PATH="$BUILD_DIR/juce-backend"
if [ ! -f "$BIN_PATH" ] && [ -f "$BUILD_DIR/Release/juce-backend" ]; then
  BIN_PATH="$BUILD_DIR/Release/juce-backend"
fi
echo "Built backend at: $BIN_PATH"
chmod +x "$BIN_PATH" || true

# Copy to resources/juce for app runtime
RES_DIR="$ROOT_DIR/resources/juce"
mkdir -p "$RES_DIR"
cp -f "$BIN_PATH" "$RES_DIR/juce-backend"
chmod +x "$RES_DIR/juce-backend" || true
echo "Copied backend to: $RES_DIR/juce-backend"
