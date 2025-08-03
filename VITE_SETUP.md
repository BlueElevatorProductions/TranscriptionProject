# Vite Development Server Setup

## Fixed Issues

### ✅ Port Conflicts
- **Problem**: `Error: Port 5173 is already in use`
- **Solution**: Changed default port to 5174 and set `strictPort: false` to auto-find available ports
- **Usage**: `npm run dev:vite` now uses port 5174 by default

### ✅ CJS Deprecation Warning
- **Problem**: `The CJS build of Vite's Node API is deprecated`
- **Status**: This is a harmless warning from Vite 5.x about future API changes
- **Impact**: No functional impact - the app works perfectly
- **Note**: Added documentation in .env file explaining this is expected

## Development Commands

```bash
# Start Vite development server (recommended)
npm run dev:vite

# Clean any stuck Vite processes and start fresh
npm run dev:clean

# Kill any existing Vite processes manually
npm run clean:dev

# Full development with both Vite and Electron
npm run start-dev
```

## Server Configuration

- **Default Port**: 5174 (changed from 5173 to avoid conflicts)
- **Auto Port Selection**: Enabled (will find next available port if 5174 is busy)
- **Host**: localhost
- **Hot Reload**: Enabled
- **ESM Support**: Fully configured

## Troubleshooting

### If Vite won't start:
1. Run `npm run clean:dev` to kill existing processes
2. Check if another service is using port 5174: `lsof -i :5174`
3. Try starting with: `npm run dev:clean`

### If you see CJS warnings:
- These are expected and harmless
- They indicate Vite will change APIs in future versions
- Your app functionality is not affected

## Technical Details

- **Vite Version**: 5.4.19
- **Module System**: ESNext with proper ESM configuration
- **TypeScript**: Full support with correct module resolution
- **Build Target**: ES2020 for modern browser compatibility