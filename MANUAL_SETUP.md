# Manual Setup Guide for PodcastTranscriber

Since npm is having permission issues, here's how to set up the project manually:

## Option 1: Fix npm permissions (Recommended)

```bash
# Fix npm permissions (requires password)
sudo chown -R $(whoami) ~/.npm

# Then run the setup
./setup.sh
```

## Option 2: Use a different npm prefix

```bash
# Create a new npm prefix in your user directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Add to your shell profile (.bashrc, .zshrc, etc.)
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# Now try installing
npm install --legacy-peer-deps
```

## Option 3: Use the simplified package.json

```bash
# Use the simplified package configuration
cp package-simple.json package.json
npm install
```

## Option 4: Alternative - Use Node Version Manager (nvm)

```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc

# Install and use the latest LTS node
nvm install --lts
nvm use --lts

# Try installing again
npm install --legacy-peer-deps
```

## Testing the Setup

Once dependencies are installed, test with:

```bash
# Start the Vite dev server (in one terminal)
npm run dev:vite

# Start Electron (in another terminal)
npm run dev:electron
```

## Manual Development Workflow

If automated scripts don't work, you can develop manually:

1. **Edit React files** in `src/renderer/`
2. **Edit Electron files** in `src/main/`
3. **Test changes** by refreshing the Electron window

## Alternative: Use VS Code Live Server

If Vite won't start, you can use VS Code's Live Server extension:

1. Install "Live Server" extension in VS Code
2. Open `src/renderer/index.html`
3. Right-click and select "Open with Live Server"
4. Update the Electron main.ts to load from the Live Server URL

## Troubleshooting

- **Permission denied**: Run `sudo chown -R $(whoami) ~/.npm`
- **Port already in use**: Kill the process with `lsof -ti:5173 | xargs kill -9`
- **Module not found**: Make sure you're in the correct directory
- **Electron won't start**: Check that the Vite server is running first

## Need Help?

If you continue having issues, we can:
1. Use a different build tool (like Webpack instead of Vite)
2. Set up a simpler development environment
3. Use Docker for a consistent development environment

The most important thing is getting a working Electron + React setup so we can start building the transcription features!