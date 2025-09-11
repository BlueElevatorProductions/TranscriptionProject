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
  async load(id: TransportId, filePath: string): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'load', id, path: filePath });
  }

  async updateEdl(id: TransportId, clips: EdlClip[]): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'updateEdl', id, clips });
  }

  async play(id: TransportId): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'play', id });
  }
  async pause(id: TransportId): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'pause', id });
  }
  async stop(id: TransportId): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'stop', id });
  }
  async seek(id: TransportId, timeSec: number): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'seek', id, timeSec });
  }
  async setRate(id: TransportId, rate: number): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'setRate', id, rate });
  }
  async setVolume(id: TransportId, value: number): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'setVolume', id, value });
  }
  async queryState(id: TransportId): Promise<void> {
    await this.ensureStarted();
    this.send({ type: 'queryState', id });
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

  private async ensureStarted(): Promise<void> {
    if (this.child && !this.restarting) return;
    await this.startChild();
  }

  private async startChild(): Promise<void> {
    if (this.child) return;
    this.killed = false;
    this.stdoutBuffer = '';
    const { binaryPath, args, env, name } = this.options;
    try {
      this.child = spawn(binaryPath, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
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
      this.emitError(`JUCE process error: ${err instanceof Error ? err.message : String(err)}`);
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
            this.handlers.onError?.(evt);
            break;
        }
      } else {
        this.emitError(`Unexpected message from JUCE: ${line}`);
      }
    }
  }

  private send(cmd: JuceCommand) {
    if (!this.child || !this.child.stdin.writable) {
      this.emitError('Attempted to send command but JUCE process is not available');
      return;
    }
    try {
      const payload = JSON.stringify(cmd) + '\n';
      this.child.stdin.write(payload, 'utf8');
    } catch (e) {
      this.emitError(`Failed to write to JUCE stdin: ${e}`);
    }
  }

  private emitError(message: string) {
    const event: JuceEvent = { type: 'error', message };
    this.emitter.emit('event', event);
    this.handlers.onError?.(event);
  }
}

export default JuceClient;

