/**
 * Check if the app is running in development mode
 */
export const isDev = (): boolean => {
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
};

/**
 * Format duration in seconds to MM:SS format
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Common file extensions for audio files
 */
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aiff', '.m4a', '.flac'];

/**
 * Check if a file has an audio extension
 */
export const isAudioFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return AUDIO_EXTENSIONS.includes(ext);
};

// Import app only on main process
let app: any;
if (typeof window === 'undefined') {
  // We're in the main process
  const electron = require('electron');
  app = electron.app;
}