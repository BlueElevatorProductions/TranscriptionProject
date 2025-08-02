/**
 * Electron API mock for testing
 */

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  send: jest.fn(),
  removeAllListeners: jest.fn(),
};

export const shell = {
  openExternal: jest.fn().mockResolvedValue(true),
};

export const app = {
  getVersion: jest.fn().mockReturnValue('1.0.0'),
  getPath: jest.fn().mockReturnValue('/mock/path'),
  isPackaged: false,
};

export const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn(),
  on: jest.fn(),
  webContents: {
    openDevTools: jest.fn(),
  },
}));

export default {
  ipcRenderer,
  shell,
  app,
  BrowserWindow,
};