# PodcastTranscriber Setup Guide

## Quick Start

1. **Run the setup script:**
   ```bash
   ./setup.sh
   ```

2. **Start development:**
   ```bash
   # Terminal 1 - Start Vite dev server
   npm run dev:vite
   
   # Terminal 2 - Start Electron app
   npm run dev:electron
   ```

## Manual Setup

If the setup script fails:

1. **Fix npm permissions (if needed):**
   ```bash
   sudo chown -R $(whoami) ~/.npm
   npm cache clean --force
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.ts     # Main application entry
│   └── preload.ts  # Preload script for IPC
├── renderer/       # React frontend
│   ├── App.tsx     # Main React component
│   ├── App.css     # Styles
│   ├── main.tsx    # React entry point
│   └── index.html  # HTML template
└── shared/         # Shared utilities
    └── utils.ts    # Common functions
```

## Available Scripts

- `npm run dev:vite` - Start Vite development server
- `npm run dev:electron` - Start Electron app
- `npm run build` - Build both renderer and main processes
- `npm run start` - Run built application
- `npm run clean` - Clean build files

## Development Workflow

1. Make changes to React components in `src/renderer/`
2. Make changes to Electron main process in `src/main/`
3. Hot reload is enabled for the React app
4. Restart Electron app to see main process changes

## Troubleshooting

### Common Issues

1. **Port 5173 already in use:**
   - Kill the process using the port: `lsof -ti:5173 | xargs kill -9`

2. **Permission errors:**
   - Fix npm permissions: `sudo chown -R $(whoami) ~/.npm`

3. **Dependencies won't install:**
   - Try: `npm install --legacy-peer-deps --force`

4. **Electron won't start:**
   - Make sure Vite dev server is running first
   - Check that port 5173 is accessible

### Development Tips

- Use React DevTools in the Electron DevTools
- Check Electron main process logs in terminal
- Use `console.log` in renderer process (shows in DevTools)
- Use `console.log` in main process (shows in terminal)

## Next Steps

Once the basic setup is working, you can start implementing:

1. **File import functionality**
2. **WhisperX integration for transcription**
3. **Audio playback with Tracktion Engine**
4. **Text editor with React-Quill**
5. **Export functionality**

Happy coding! 🎙️