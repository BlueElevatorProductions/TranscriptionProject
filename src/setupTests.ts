/**
 * Jest setup file
 * Configures testing environment for React components and contexts
 */

import '@testing-library/jest-dom';

// Mock Electron API
global.window = global.window || {};
(global.window as any).electronAPI = {
  getVersion: jest.fn().mockResolvedValue('1.0.0'),
  getPlatform: jest.fn().mockResolvedValue('darwin'),
  startTranscription: jest.fn().mockResolvedValue({ success: true, jobId: 'test-job-1' }),
  getApiKeys: jest.fn().mockResolvedValue({}),
  saveProject: jest.fn().mockResolvedValue(true),
  readAudioFile: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
  onTranscriptionComplete: jest.fn(),
  onTranscriptionProgress: jest.fn(),
  onTranscriptionError: jest.fn(),
  removeAllListeners: jest.fn(),
};

// Mock console methods for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress logs in tests unless specifically needed
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock ResizeObserver (used by some components)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver (used by virtualization)
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock URL.createObjectURL and revokeObjectURL (used by audio player)
global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock HTMLMediaElement methods (used by audio player)
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: jest.fn().mockImplementation(() => Promise.resolve()),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
  writable: true,
  value: jest.fn(),
});

// Mock audio properties
Object.defineProperty(window.HTMLMediaElement.prototype, 'duration', {
  writable: true,
  value: 100,
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'currentTime', {
  writable: true,
  value: 0,
});

Object.defineProperty(window.HTMLMediaElement.prototype, 'paused', {
  writable: true,
  value: true,
});

// Increase timeout for longer tests
jest.setTimeout(10000);