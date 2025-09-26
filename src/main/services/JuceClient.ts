import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import {
  Transport,
  TransportEvents,
  TransportId,
  JuceCommand,
  JuceEvent,
  isJuceEvent,
  EdlClip,
} from '../../shared/types/transport';
import { app } from 'electron';

interface JuceClientOptions {
  binaryPath?: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  autoRestart?: boolean;
  name?: string;
}

/**
 * JuceClient manages a headless JUCE backend process, speaking line-delimited JSON over stdio.
 * It provides a Transport-compatible API and emits parsed events via an EventEmitter.
 */
export class JuceClient implements Transport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly options: Required<JuceClientOptions>;
  private stdoutBuffer = '';
  private restarting = false;
  private killed = false;
  private restartAttempts = 0;
  private readonly maxRestartAttempts = 5;
  private readonly emitter = new EventEmitter();
  private handlers: TransportEvents = {};
  private pendingCommands = new Map<string, { resolve: (result: any) => void; reject: (error: any) => void; timeout: NodeJS.Timeout }>();
  private currentLoadCommand: { commandKey: string; id: string } | null = null;

  // Command queue and flow control
  private commandQueue: Array<{ command: JuceCommand; resolve: (result: boolean) => void; reject: (error: any) => void }> = [];
  private isProcessingQueue = false;
  private readonly edlInlineThresholdBytes = 8 * 1024; // 8KB threshold keeps large payloads file-based
  private edlTempDirectory: string | null = null;

  constructor(opts: JuceClientOptions = {}) {
    this.options = {
      binaryPath: opts.binaryPath || JuceClient.defaultBinaryPath(),
      args: opts.args || [],
      env: { ...process.env, ...(opts.env || {}) },
      autoRestart: opts.autoRestart ?? true,
      name: opts.name || 'juce-backend',
    };
  }

  // --- Public Transport API ---
  async load(id: TransportId, filePath: string): Promise<{success: boolean, error?: string}> {
    // Add comprehensive diagnostic logging
    console.log(`[JUCE] load() called with:`, {
      id,
      filePath,
      filePathType: typeof filePath,
      filePathLength: filePath?.length,
      isAbsolute: require('path').isAbsolute(filePath),
      platformSep: require('path').sep
    });

    // Try to resolve the file path if it doesn't exist directly
    const resolvedPath = await this.resolveAudioFilePath(filePath);
    if (!resolvedPath) {
      console.error(`[JUCE] ❌ Unable to resolve audio file path:`, filePath);
      return { success: false, error: `Audio file not found: ${filePath}` };
    }

    console.log(`[JUCE] ✅ Loading audio file: ${resolvedPath}${resolvedPath !== filePath ? ` (resolved from: ${filePath})` : ''}`);
    await this.ensureStarted();

    return new Promise((resolve, reject) => {
      const commandKey = `load_${id}_${Date.now()}`;

      // Set up timeout for this command
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandKey);
        resolve({ success: false, error: 'Load command timed out' });
      }, 10000); // 10 second timeout

      // Store the promise handlers
      this.pendingCommands.set(commandKey, { resolve, reject, timeout });

      try {
        this.send({ type: 'load', id, path: resolvedPath }).then(() => {
          // Store command info for response matching
          this.currentLoadCommand = { commandKey, id };
        }).catch(error => {
          this.pendingCommands.delete(commandKey);
          clearTimeout(timeout);
          resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
        });
      } catch (error) {
        this.pendingCommands.delete(commandKey);
        clearTimeout(timeout);
        resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
  }

  async updateEdl(id: TransportId, revision: number, clips: EdlClip[]): Promise<{ success: boolean; revision?: number; counts?: { words: number; spacers: number; spacersWithOriginal: number; total: number; } }> {
    await this.ensureStarted();

    const stats = this.summarizeSegments(clips);
    console.log('[JUCE] updateEdl() preparing payload', {
      id,
      revision,
      clipCount: clips.length,
      totalSegments: stats.totalSegments,
      wordSegments: stats.wordSegments,
      spacerSegments: stats.spacerSegments,
      spacersWithOriginal: stats.spacersWithOriginal,
      spacerPreview: stats.spacerPreview,
    });
    if (stats.spacerSegments === 0) {
      console.warn('[JUCE] ⚠️ No spacer segments found in updateEdl payload for revision', revision);
    }

    const { command, cleanup } = await this.prepareEdlCommand(id, revision, clips, stats);
    try {
      await this.send(command);
      if (cleanup) {
        setTimeout(() => {
          cleanup().catch(err => {
            if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
              console.warn(`[JUCE] ⚠️ Failed to remove temp EDL file:`, err);
            }
          });
        }, 30000);
      }
      console.log('[JUCE] updateEdl() command dispatched', { id, revision, type: command.type });
    } catch (error) {
      if (cleanup) {
        cleanup().catch(err => {
          if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
            console.warn(`[JUCE] ⚠️ Failed to remove temp EDL file after error:`, err);
          }
        });
      }
      throw new Error(`updateEdl failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
      success: true,
      revision,
      counts: {
        words: stats.wordSegments,
        spacers: stats.spacerSegments,
        spacersWithOriginal: stats.spacersWithOriginal,
        total: stats.totalSegments,
      },
    };
  }

  async play(id: TransportId): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'play', id });
    } catch (error) {
      throw new Error(`play failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async pause(id: TransportId): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'pause', id });
    } catch (error) {
      throw new Error(`pause failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async stop(id: TransportId): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'stop', id });
    } catch (error) {
      throw new Error(`stop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async seek(id: TransportId, timeSec: number): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'seek', id, timeSec });
    } catch (error) {
      throw new Error(`seek failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async setRate(id: TransportId, rate: number): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'setRate', id, rate });
    } catch (error) {
      throw new Error(`setRate failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async setTimeStretch(id: TransportId, ratio: number): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'setTimeStretch', id, ratio });
    } catch (error) {
      throw new Error(`setTimeStretch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async setVolume(id: TransportId, value: number): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'setVolume', id, value });
    } catch (error) {
      throw new Error(`setVolume failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async queryState(id: TransportId): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'queryState', id });
    } catch (error) {
      throw new Error(`queryState failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async dispose(): Promise<void> {
    this.killed = true;
    this.options.autoRestart = false;
    await this.stopChild();
  }

  setEventHandlers(handlers: TransportEvents): void {
    this.handlers = handlers;
  }

  // Event subscription for main-process usage (optional convenience)
  on(listener: (e: JuceEvent) => void) {
    this.emitter.on('event', listener);
  }

  // --- Internals ---
  private static defaultBinaryPath(): string {
    // Default expected location when packaged; during development, allow override via env
    if (process.env.JUCE_BACKEND_PATH) return process.env.JUCE_BACKEND_PATH;
    const base = (process as any).resourcesPath || path.join(process.cwd(), 'resources');
    const bin = process.platform === 'win32' ? 'juce-backend.exe' : 'juce-backend';
    return path.join(base, 'juce', bin);
  }

  /**
   * Resolve audio file path with fallback logic for the main process
   */
  private async resolveAudioFilePath(filePath: string): Promise<string | null> {
    if (!filePath || typeof filePath !== 'string') {
      return null;
    }

    const fs = await import('fs');

    // First check if the path exists as provided
    if (fs.existsSync(filePath)) {
      console.log(`[JUCE] ✅ Direct path exists:`, filePath);
      return filePath;
    }

    console.log(`[JUCE] 🔍 Direct path doesn't exist, trying fallback resolution for:`, filePath);

    // Generate candidate paths for fallback resolution
    const candidates: string[] = [];

    // If it's a relative path or just a filename, try some common locations
    if (!path.isAbsolute(filePath)) {
      const filename = path.basename(filePath);
      const relativePath = filePath;

      // Try relative to current working directory
      candidates.push(
        path.resolve(relativePath),
        path.resolve('audio', filename),
        path.resolve('Audio Files', filename),
        path.resolve('..', 'audio', filename),
        path.resolve('..', 'Audio Files', filename)
      );

      // Legacy fallback locations (for existing projects)
      candidates.push(
        `/Users/chrismcleod/Development/ClaudeAccess/Working Audio/${filename}`,
        `/Users/chrismcleod/Development/ChatAppAccess/Working Audio/${filename}`,
        `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/audio/${filename}`,
        `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/${relativePath}`,
      );
    } else {
      // For absolute paths that don't exist, try some alternative directory structures
      const filename = path.basename(filePath);
      const dirname = path.dirname(filePath);

      candidates.push(
        path.join(dirname, 'Audio Files', filename),
        path.join(path.dirname(dirname), 'Audio Files', filename),
        path.join(process.cwd(), 'audio', filename),
        path.join(process.cwd(), 'Audio Files', filename)
      );
    }

    // Remove duplicates and normalize paths
    const uniqueCandidates = [...new Set(candidates)].map(candidate => path.normalize(candidate));

    console.log(`[JUCE] 🔍 Testing fallback candidates:`, uniqueCandidates);

    // Test each candidate
    for (const candidate of uniqueCandidates) {
      try {
        if (fs.existsSync(candidate)) {
          console.log(`[JUCE] ✅ Found audio file at:`, candidate);
          return candidate;
        } else {
          console.log(`[JUCE] ❌ Candidate doesn't exist:`, candidate);
        }
      } catch (error) {
        console.warn(`[JUCE] ⚠️ Error checking candidate:`, candidate, error);
      }
    }

    console.error(`[JUCE] ❌ No valid audio file found for path:`, filePath);
    return null;
  }

  private async ensureStarted(): Promise<void> {
    if (this.child && !this.restarting && this.isProcessHealthy()) return;
    await this.startChild();
  }

  private isProcessHealthy(): boolean {
    if (!this.child) return false;
    if (this.child.killed || this.child.exitCode !== null) return false;
    if (!this.child.stdin || this.child.stdin.destroyed) return false;
    return true;
  }

  private async startChild(): Promise<void> {
    if (this.child) return;
    this.killed = false;
    this.stdoutBuffer = '';
    const { binaryPath, args, env, name } = this.options;
    try {
      console.log(`[JUCE] Spawning backend '${name}' at: ${binaryPath}`);
      if (process.env.JUCE_BACKEND_PATH) console.log(`[JUCE] JUCE_BACKEND_PATH env: ${process.env.JUCE_BACKEND_PATH}`);
      if (process.env.JUCE_DEBUG_DIR) console.log(`[JUCE] JUCE_DEBUG_DIR env: ${process.env.JUCE_DEBUG_DIR}`);
      this.child = spawn(binaryPath, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      console.log(`[JUCE] Spawned PID: ${this.child.pid}`);
    } catch (e) {
      this.emitError(`Failed to spawn JUCE backend (${name}) at ${binaryPath}: ${e}`);
      throw e;
    }

    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', (chunk: string) => this.onStdout(chunk));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (chunk: string) => {
      // Forward stderr lines as error logs but do not crash parsing
      const text = chunk.toString();
      if (text.trim().length > 0) this.emitError(`[JUCE stderr] ${text.trim()}`);
    });
    this.child.on('error', (err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.emitError(`JUCE process error: ${errorMsg}`);

      // Handle specific error cases
      if (errorMsg.includes('EPIPE')) {
        console.warn('[JUCE] EPIPE error detected - process likely crashed');
        this.child = null;
      }
    });
    this.child.on('exit', (code, signal) => {
      this.child = null;
      if (this.killed) return; // explicit dispose
      const msg = `JUCE process exited code=${code} signal=${signal}`;
      this.emitError(msg);
      if (this.options.autoRestart && this.restartAttempts < this.maxRestartAttempts) {
        this.scheduleRestart();
      }
    });
  }

  private async stopChild(): Promise<void> {
    if (!this.child) return;
    try {
      this.child.stdin.end();
    } catch {}
    try {
      this.child.kill();
    } catch {}
    this.child = null;
  }

  private scheduleRestart() {
    this.restarting = true;
    const attempt = ++this.restartAttempts;
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s,2s,4s,8s,8s
    setTimeout(() => {
      if (this.killed) return;
      this.startChild()
        .then(() => {
          this.restarting = false;
        })
        .catch((e) => {
          this.emitError(`Failed to restart JUCE backend: ${e}`);
          this.restarting = false;
        });
    }, delay);
  }

  private onStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    // JUCE emits line-delimited JSON
    let idx: number;
    while ((idx = this.stdoutBuffer.indexOf('\n')) >= 0) {
      const line = this.stdoutBuffer.slice(0, idx).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1);
      if (line.length === 0) continue;
      let obj: unknown;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        this.emitError(`Invalid JSON from JUCE: ${line}`);
        continue;
      }
      if (isJuceEvent(obj)) {
        const evt = obj as JuceEvent;
        this.emitter.emit('event', evt);
        // per-type handler dispatch
        switch (evt.type) {
          case 'loaded':
            this.handleLoadedEvent(evt);
            this.handlers.onLoaded?.(evt);
            break;
          case 'state':
            this.handlers.onState?.(evt);
            break;
          case 'position':
            this.handlers.onPosition?.(evt);
            break;
          case 'edlApplied':
            this.handlers.onEdlApplied?.(evt as any);
            break;
          case 'ended':
            this.handlers.onEnded?.(evt);
            break;
          case 'error':
            this.handleErrorEvent(evt);
            this.handlers.onError?.(evt);
            break;
        }
      } else {
        this.emitError(`Unexpected message from JUCE: ${line}`);
      }
    }
  }

  private send(cmd: JuceCommand): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.child) {
        this.emitError('Attempted to send command but JUCE process is null');
        reject(new Error('JUCE process not started'));
        return;
      }

      if (this.child.killed || this.child.exitCode !== null) {
        this.emitError('Attempted to send command but JUCE process has exited');
        reject(new Error('JUCE process exited'));
        return;
      }

      if (!this.child.stdin || this.child.stdin.destroyed || !this.child.stdin.writable) {
        this.emitError('Attempted to send command but JUCE stdin is not writable');
        reject(new Error('stdin not available'));
        return;
      }

      this.commandQueue.push({ command: cmd, resolve, reject });
      this.processCommandQueue();
    });
  }

  private processCommandQueue() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    if (!this.child?.stdin) {
      while (this.commandQueue.length > 0) {
        const pending = this.commandQueue.shift();
        pending?.reject(new Error('stdin not available'));
      }
      return;
    }

    this.isProcessingQueue = true;
    const { command, resolve, reject } = this.commandQueue.shift()!;

    const stdin = this.child.stdin;
    const payload = JSON.stringify(command) + '\n';
    let settled = false;
    let drainListener: (() => void) | null = null;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      stdin.off('error', onError);
      if (drainListener) {
        stdin.off('drain', drainListener);
        drainListener = null;
      }

      this.isProcessingQueue = false;

      if (error) {
        console.error(`[JUCE] ❌ Failed to write command ${command.type}:`, error);
        this.emitError(`Failed to write to JUCE stdin: ${error.message || error}`);
        reject(error);
      } else {
        console.log(`[JUCE] ✅ Command sent successfully: ${command.type}`);
        resolve(true);
      }

      setTimeout(() => this.processCommandQueue(), 0);
    };

    const onError = (err: Error) => finish(err);
    stdin.once('error', onError);

    const writeCallback = (err?: Error | null) => {
      if (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    };

    try {
      const wroteImmediately = stdin.write(payload, 'utf8', writeCallback);
      if (wroteImmediately) {
        finish();
      } else {
        drainListener = () => finish();
        stdin.once('drain', drainListener);
      }
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async ensureEdlTempDir(): Promise<string> {
    if (this.edlTempDirectory) {
      return this.edlTempDirectory;
    }

    const base = path.join(app.getPath('temp'), 'juce-edl-cache');
    try {
      await fsPromises.mkdir(base, { recursive: true });
    } catch (error) {
      console.warn('[JUCE] ⚠️ Failed to create EDL cache directory:', error);
    }

    this.edlTempDirectory = base;
    return base;
  }

  private summarizeSegments(clips: EdlClip[]) {
    return clips.reduce(
      (acc, clip) => {
        if (Array.isArray(clip.segments)) {
          for (const seg of clip.segments) {
            acc.totalSegments += 1;
            if (seg.type === 'spacer') acc.spacerSegments += 1;
            else acc.wordSegments += 1;
            if (seg.type === 'spacer' && typeof seg.originalStartSec === 'number' && typeof seg.originalEndSec === 'number') {
              acc.spacersWithOriginal += 1;
            }
            if (seg.type === 'spacer' && acc.spacerPreview.length < 3) {
              acc.spacerPreview.push({
                clipId: clip.id,
                clipOrder: clip.order,
                startSec: Number(seg.startSec.toFixed(3)),
                endSec: Number(seg.endSec.toFixed(3)),
                durationSec: Number((seg.endSec - seg.startSec).toFixed(3)),
                originalStartSec: typeof seg.originalStartSec === 'number'
                  ? Number(seg.originalStartSec.toFixed(3))
                  : undefined,
                originalEndSec: typeof seg.originalEndSec === 'number'
                  ? Number(seg.originalEndSec.toFixed(3))
                  : undefined,
              });
            }
          }
        }
        return acc;
      },
      {
        totalSegments: 0,
        wordSegments: 0,
        spacerSegments: 0,
        spacersWithOriginal: 0,
        spacerPreview: [] as Array<{
          clipId: string;
          clipOrder: number;
          startSec: number;
          endSec: number;
          durationSec: number;
          originalStartSec?: number;
          originalEndSec?: number;
        }>,
      }
    );
  }

  private async prepareEdlCommand(
    id: TransportId,
    revision: number,
    clips: EdlClip[],
    stats: {
      totalSegments: number;
      wordSegments: number;
      spacerSegments: number;
      spacersWithOriginal: number;
      spacerPreview: Array<{
        clipId: string;
        clipOrder: number;
        startSec: number;
        endSec: number;
        durationSec: number;
        originalStartSec?: number;
        originalEndSec?: number;
      }>;
    }
  ): Promise<{ command: JuceCommand; cleanup?: () => Promise<void> }> {
    const inlinePayload: JuceCommand = { type: 'updateEdl', id, revision, clips };
    const inlinePayloadJson = JSON.stringify(inlinePayload);
    const payloadSize = Buffer.byteLength(inlinePayloadJson);

    if (payloadSize <= this.edlInlineThresholdBytes) {
      console.log('[JUCE] updateEdl() sending inline payload', {
        id,
        revision,
        payloadBytes: payloadSize,
        spacers: stats.spacerSegments,
        spacersWithOriginal: stats.spacersWithOriginal,
        spacerPreview: stats.spacerPreview,
      });
      return { command: inlinePayload };
    }

    const dir = await this.ensureEdlTempDir();
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeId}_${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
    const filePath = path.join(dir, fileName);

    const filePayload = { revision, clips };
    await fsPromises.writeFile(filePath, JSON.stringify(filePayload));

    console.log('[JUCE] 🗂️ Large EDL payload written to temp file', {
      id,
      revision,
      payloadBytes: payloadSize,
      path: filePath,
      spacerSegments: stats.spacerSegments,
      spacersWithOriginal: stats.spacersWithOriginal,
      spacerPreview: stats.spacerPreview,
    });
    if (stats.spacerSegments === 0) {
      console.warn('[JUCE] ⚠️ Temp-file payload contains zero spacer segments');
    }

    const cleanup = async () => {
      try {
        await fsPromises.unlink(filePath);
        console.log(`[JUCE] 🧹 Removed temp EDL file: ${filePath}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          console.warn(`[JUCE] ⚠️ Failed to remove temp EDL file ${filePath}:`, error);
        }
      }
    };
    const fileCommand: JuceCommand = { type: 'updateEdlFromFile', id, revision, path: filePath };
    return { command: fileCommand, cleanup };
  }

  private handleLoadedEvent(evt: JuceEvent) {
    if (this.currentLoadCommand) {
      const pending = this.pendingCommands.get(this.currentLoadCommand.commandKey);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingCommands.delete(this.currentLoadCommand.commandKey);
        pending.resolve({ success: true });
        this.currentLoadCommand = null;
      }
    }
  }

  private handleErrorEvent(evt: JuceEvent) {
    if (this.currentLoadCommand && evt.type === 'error') {
      const pending = this.pendingCommands.get(this.currentLoadCommand.commandKey);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingCommands.delete(this.currentLoadCommand.commandKey);
        pending.resolve({ success: false, error: evt.message || 'JUCE error' });
        this.currentLoadCommand = null;
      }
    }
  }

  private emitError(message: string) {
    const event: JuceEvent = { type: 'error', message };
    this.emitter.emit('event', event);
    this.handlers.onError?.(event);
  }
}

export default JuceClient;
