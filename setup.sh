#!/bin/bash

echo "🎙️ Setting up PodcastTranscriber..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Clean up any existing installation
echo "🧹 Cleaning up existing files..."
rm -rf node_modules package-lock.json build dist

# Try different installation methods
echo "📦 Installing dependencies..."

# Method 1: Standard install
if npm install; then
    echo "✅ Dependencies installed successfully!"
else
    echo "⚠️  Standard install failed, trying with --legacy-peer-deps..."
    # Method 2: Legacy peer deps
    if npm install --legacy-peer-deps; then
        echo "✅ Dependencies installed with legacy peer deps!"
    else
        echo "⚠️  Legacy install failed, trying with --force..."
        # Method 3: Force install
        if npm install --force; then
            echo "✅ Dependencies installed with force!"
        else
            echo "❌ All installation methods failed. Please try manually:"
            echo "   1. Fix npm cache permissions: sudo chown -R \$(whoami) ~/.npm"
            echo "   2. Clear npm cache: npm cache clean --force"
            echo "   3. Try: npm install --legacy-peer-deps"
            exit 1
        fi
    fi
fi

echo ""
echo "🚀 Setup complete! Next steps:"
echo "   1. Run: npm run dev:vite"
echo "   2. In another terminal, run: npm run dev:electron"
echo "   3. The Electron app should open with your React interface"
echo ""
echo "📁 Project structure:"
echo "   src/main/     - Electron main process"
echo "   src/renderer/ - React frontend"
echo "   src/shared/   - Shared utilities"
echo ""
echo "Happy coding! 🎉"