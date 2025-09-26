import { app, BrowserWindow } from 'electron';
import type { TransportLogEntry, TransportLogLevel } from '../../shared/logging/transport';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

type Serializable = string | number | boolean | null | Serializable[] | { [key: string]: Serializable };

const TRANSPORT_TAG_PATTERN = /^\[([^\]]+)\]/;
const queuedEntries: TransportLogEntry[] = [];
let bridgeInstalled = false;
let queueNotified = false;

function toSerializable(value: any, depth: number = 0): Serializable {
  if (value === null || value === undefined) return null;
  if (depth > 4) {
    return typeof value === 'object' ? '[Object]' : String(value);
  }

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return value as Serializable;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    } as Serializable;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item, depth + 1)) as Serializable;
  }

  if (type === 'object') {
    const plain: Record<string, Serializable> = {};
    for (const [key, val] of Object.entries(value)) {
      try {
        plain[key] = toSerializable(val, depth + 1);
      } catch {
        plain[key] = '[Unserializable]' as Serializable;
      }
    }
    return plain as Serializable;
  }

  return String(value) as Serializable;
}

function broadcast(entry: TransportLogEntry) {
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
  if (windows.length === 0) {
    queuedEntries.push(entry);
    if (!queueNotified) {
      queueNotified = true;
      console.info('[Bridge] No renderer windows detected for transport logs, queuing entry', {
        queued: queuedEntries.length,
        message: entry.message,
        source: entry.source,
      });
    }
    return;
  }

  for (const win of windows) {
    try {
      win.webContents.send('transport:log', entry);
    } catch {
      // Ignore delivery errors but keep entry for other windows
    }
  }
}

function flushQueue(reason: string) {
  if (!queuedEntries.length) {
    queueNotified = false;
    return;
  }
  console.info('[Bridge] Flushing queued transport logs', {
    reason,
    queued: queuedEntries.length,
    windows: BrowserWindow.getAllWindows()
      .filter((win) => !win.isDestroyed())
      .map((win) => win.id),
  });
  queueNotified = false;
  const entries = queuedEntries.splice(0, queuedEntries.length);
  for (const entry of entries) {
    broadcast(entry);
  }
}

function interceptConsoleMethod(method: ConsoleMethod) {
  const original = console[method].bind(console);
  console[method] = (...args: any[]) => {
    original(...args);

    if (!args.length) {
      return;
    }

    const [firstArg] = args;
    const message = typeof firstArg === 'string' ? firstArg : '';
    if (typeof firstArg !== 'string') {
      return;
    }

    if (!TRANSPORT_TAG_PATTERN.test(message)) {
      return;
    }

    const sourceMatch = message.match(TRANSPORT_TAG_PATTERN);
    const entry: TransportLogEntry = {
      level: method as TransportLogLevel,
      message,
      source: sourceMatch ? sourceMatch[1] : null,
      args: args.map((arg) => toSerializable(arg)) as any[],
      timestamp: Date.now(),
    };

    broadcast(entry);
  };
}

export function installTransportLogBridge(): void {
  if (bridgeInstalled) return;
  bridgeInstalled = true;

  interceptConsoleMethod('log');
  interceptConsoleMethod('info');
  interceptConsoleMethod('warn');
  interceptConsoleMethod('error');

  console.info('[Bridge] Transport log bridge installed');

  app.on('browser-window-created', (_event, window) => {
    console.info('[Bridge] Renderer window created; preparing to flush transport log queue', {
      windowId: window?.id,
      queued: queuedEntries.length,
    });
    flushQueue('browser-window-created');
  });
  app.on('ready', () => {
    console.info('[Bridge] Electron app ready; awaiting renderer windows for transport logs');
    flushQueue('app-ready');
  });
}
