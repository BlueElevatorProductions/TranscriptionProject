import React from "react";

/**
 * StarterComponents.tsx
 * Minimal scaffold wired to Tailwind + design tokens.
 * - Sidebar remains Arial (standard look/feel).
 * - Transcript area uses the transcript font (Avenir stack) and is intended to be stylable by the user.
 * - Media player is a visual shell; wire it to your existing audio logic.
 *
 * Usage:
 *   import StarterComponents from "./StarterComponents";
 *   // Render at root while feature flag NEW_UI is on, or route to a /playground page.
 */

// Sidebar component — fixed Arial font styling
export const Sidebar: React.FC = () => {
  return (
    <aside className="bg-sidebar-bg text-sidebar-text font-arial w-64 h-full p-4 flex flex-col gap-8">
      {/* Mode Selector */}
      <div>
        <h2 className="text-lg font-bold mb-3">Mode</h2>
        <button className="block w-full text-left py-2 px-3 rounded hover:bg-hover-bg">Listen</button>
        <button className="block w-full text-left py-2 px-3 rounded hover:bg-hover-bg">Edit</button>
      </div>

      {/* Document Settings */}
      <div>
        <h2 className="text-lg font-bold mb-3">Document Settings</h2>
        <label className="block text-sm mb-1">Font</label>
        <select className="w-full p-2 border border-border rounded-md bg-surface text-text">
          <option>Avenir</option>
          <option>Inter</option>
          <option>Arial</option>
        </select>
        <label className="block text-sm mt-3 mb-1">Size</label>
        <input type="number" className="w-full p-2 border border-border rounded-md bg-surface text-text" defaultValue={35} />
      </div>

      {/* Audio Settings Placeholder (future) */}
      <div>
        <h2 className="text-lg font-bold mb-3">Audio Settings</h2>
        <p className="text-sm opacity-80">Configure device, buffer, and advanced playback later.</p>
      </div>
    </aside>
  );
};

// Transcript area — customizable font styling
export const Transcript: React.FC = () => {
  return (
    <main className="flex-1 p-6 bg-transcript-bg font-transcript text-transcript-text">
      <h1 className="text-2xl font-light mb-4">Transcript</h1>
      <p className="text-[35px] leading-[42px]">
        This is an example transcript paragraph. Users can change font, size, and other styles here.
        Click words to seek the audio, or select text in Edit mode.
      </p>
    </main>
  );
};

// Media Player — wire skip buttons to current-clip boundaries in your logic
export const MediaPlayer: React.FC = () => {
  return (
    <footer className="bg-player-bg text-player-text p-4 flex items-center gap-3">
      <button className="px-3 py-2 rounded hover:bg-hover-bg" aria-label="Skip to clip start">⏮️</button>
      <button className="px-3 py-2 rounded hover:bg-hover-bg" aria-label="Play/Pause">▶️</button>
      <button className="px-3 py-2 rounded hover:bg-hover-bg" aria-label="Skip to clip end">⏭️</button>
      <div className="flex-1 h-1 rounded bg-[hsl(var(--border))] mx-3" />
      <time className="tabular-nums text-sm opacity-80">0:00 / 0:00</time>
    </footer>
  );
};

// Layout wrapper
const StarterComponents: React.FC = () => {
  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <div className="flex flex-col flex-1">
        <Transcript />
        <MediaPlayer />
      </div>
    </div>
  );
};

export default StarterComponents;
