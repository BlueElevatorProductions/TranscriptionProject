"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAudioFile = exports.AUDIO_EXTENSIONS = exports.formatDuration = exports.isDev = void 0;
/**
 * Check if the app is running in development mode
 */
const isDev = () => {
    return process.env.NODE_ENV === 'development' || !app.isPackaged;
};
exports.isDev = isDev;
/**
 * Format duration in seconds to MM:SS format
 */
const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};
exports.formatDuration = formatDuration;
/**
 * Common file extensions for audio files
 */
exports.AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aiff', '.m4a', '.flac'];
/**
 * Check if a file has an audio extension
 */
const isAudioFile = (filename) => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return exports.AUDIO_EXTENSIONS.includes(ext);
};
exports.isAudioFile = isAudioFile;
// Import app only on main process
let app;
if (typeof window === 'undefined') {
    // We're in the main process
    const electron = require('electron');
    app = electron.app;
}
//# sourceMappingURL=utils.js.map