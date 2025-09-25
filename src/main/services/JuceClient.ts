import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
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
  private commandQueue: Array<{ command: JuceCommand; resolve: (result: any) => void; reject: (error: any) => void; retries: number }> = [];
  private isProcessingQueue = false;
  private maxRetries = 3;
  private retryDelay = 100; // ms
  private waitingForDrain = false;

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

  async updateEdl(id: TransportId, clips: EdlClip[]): Promise<void> {
    await this.ensureStarted();
    try {
      await this.send({ type: 'updateEdl', id, clips });
    } catch (error) {
      throw new Error(`updateEdl failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
        reject(false);
        return;
      }

      // Check if child process is still alive
      if (this.child.killed || this.child.exitCode !== null) {
        this.emitError('Attempted to send command but JUCE process has exited');
        reject(false);
        return;
      }

      // Check if stdin is available and writable
      if (!this.child.stdin || this.child.stdin.destroyed || !this.child.stdin.writable) {
        this.emitError('Attempted to send command but JUCE stdin is not writable');
        reject(false);
        return;
      }

      // Try immediate send first
      this.attemptSend(cmd, resolve, reject, 0);
    });
  }

  private attemptSend(cmd: JuceCommand, resolve: (result: boolean) => void, reject: (error: any) => void, retries: number) {
    if (!this.child?.stdin) {
      reject(new Error('stdin not available'));
      return;
    }

    try {
      const payload = JSON.stringify(cmd) + '\n';
      const success = this.child.stdin.write(payload, 'utf8');

      if (success) {
        // Write successful
        console.log(`[JUCE] ✅ Command sent successfully: ${cmd.type}`);
        resolve(true);
      } else {
        // Buffer is full, handle backpressure
        console.warn(`[JUCE] ⚠️ Buffer full for command: ${cmd.type}, handling backpressure...`);
        this.handleBackpressure(cmd, resolve, reject, retries);
      }
    } catch (e) {
      if (retries < this.maxRetries) {
        console.warn(`[JUCE] ⚠️ Send failed (attempt ${retries + 1}/${this.maxRetries}), retrying: ${e}`);
        setTimeout(() => {
          this.attemptSend(cmd, resolve, reject, retries + 1);
        }, this.retryDelay * Math.pow(2, retries)); // Exponential backoff
      } else {
        console.error(`[JUCE] ❌ Send failed after ${this.maxRetries} retries: ${e}`);
        this.emitError(`Failed to write to JUCE stdin after ${this.maxRetries} retries: ${e}`);
        reject(e);
      }
    }
  }

  private handleBackpressure(cmd: JuceCommand, resolve: (result: boolean) => void, reject: (error: any) => void, retries: number) {
    if (!this.child?.stdin) {
      reject(new Error('stdin not available'));
      return;
    }

    if (retries >= this.maxRetries) {
      console.error(`[JUCE] ❌ Buffer full after ${this.maxRetries} retries, giving up`);
      this.emitError('Failed to write to JUCE stdin: buffer persistently full');
      reject(new Error('Buffer persistently full'));
      return;
    }

    // Queue command for retry when drain fires
    this.commandQueue.push({ command: cmd, resolve, reject, retries: retries + 1 });

    if (!this.waitingForDrain) {
      this.waitingForDrain = true;
      console.log(`[JUCE] 🔄 Waiting for drain event to process ${this.commandQueue.length} queued commands...`);

      // Set up drain listener
      const onDrain = () => {
        this.child?.stdin?.off('drain', onDrain);
        this.waitingForDrain = false;
        console.log(`[JUCE] ✅ Drain event received, processing ${this.commandQueue.length} queued commands`);
        this.processCommandQueue();
      };

      this.child.stdin.once('drain', onDrain);

      // Fallback timeout in case drain never fires
      setTimeout(() => {
        if (this.waitingForDrain) {
          this.child?.stdin?.off('drain', onDrain);
          this.waitingForDrain = false;
          console.warn(`[JUCE] ⚠️ Drain timeout, force-processing ${this.commandQueue.length} queued commands`);
          this.processCommandQueue();
        }
      }, 1000);
    }
  }

  private processCommandQueue() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`[JUCE] 🔄 Processing ${this.commandQueue.length} queued commands...`);

    const processNext = () => {
      if (this.commandQueue.length === 0) {
        this.isProcessingQueue = false;
        console.log(`[JUCE] ✅ Queue processing complete`);
        return;
      }

      const { command, resolve, reject, retries } = this.commandQueue.shift()!;
      this.attemptSend(command, resolve, reject, retries);

      // Small delay between commands to prevent overwhelming the buffer again
      setTimeout(processNext, 10);
    };

    processNext();
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
