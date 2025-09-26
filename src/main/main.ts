import { app, BrowserWindow, Menu, shell, ipcMain, dialog, crashReporter } from 'electron';
import * as http from 'http';
import * as url from 'url';
import { pathToFileURL } from 'url';
import { lookup as mimeLookup } from 'mime-types';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import { SimpleCloudTranscriptionService } from './services/SimpleCloudTranscriptionService';
import { ProjectFileManager } from './services/ProjectFileManager';
import { ProjectFileService } from './services/ProjectFileService';
import { ProjectPackageService } from './services/ProjectPackageService';
import AudioAnalyzer from './services/AudioAnalyzer';
import AudioConverter from './services/AudioConverter';
import UserPreferencesService from './services/UserPreferences';
import JuceClient from './services/JuceClient';
import { ProjectDataStore } from './services/ProjectDataStore';
import { TranscriptionServiceV2 } from './services/TranscriptionServiceV2';
import { installTransportLogBridge } from './utils/transportLogBridge';
import type { JuceEvent, EdlClip } from '../shared/types/transport';
import type { EditOperation, ProjectData } from '../shared/types';

// Load environment variables from .env file
dotenv.config();

installTransportLogBridge();

const isDev = () => {
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
};

interface TranscriptionJob {
  id: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
  speakerNames?: { [key: string]: string };
  speakerMerges?: { [key: string]: string };
  normalizedAt?: string | null;
  speakerSegments?: SpeakerSegmentSummary[];
}

interface SpeakerSegmentSummary {
  speaker: string;
  start: number;
  end: number;
  text: string;
  segmentIds: (number | string)[];
  wordCount: number;
}

const defaultSpeakerLabel = (index: number): string => `Speaker ${index + 1}`;

const buildSpeakerMetadata = (segments: any[] = []): { speakers: { [key: string]: string }; speakerSegments: SpeakerSegmentSummary[] } => {
  const speakers: { [key: string]: string } = {};
  const speakerSegments: SpeakerSegmentSummary[] = [];

  if (!Array.isArray(segments) || segments.length === 0) {
    return { speakers, speakerSegments };
  }

  const sortedSegments = [...segments].sort((a, b) => (a?.start ?? 0) - (b?.start ?? 0));
  let current: SpeakerSegmentSummary | null = null;

  sortedSegments.forEach((segment, index) => {
    const speakerId = segment?.speaker || 'SPEAKER_00';
    if (!speakers[speakerId]) {
      speakers[speakerId] = defaultSpeakerLabel(Object.keys(speakers).length);
    }

    const start = typeof segment?.start === 'number' ? segment.start : 0;
    const end = typeof segment?.end === 'number' ? segment.end : start;
    const text = typeof segment?.text === 'string' ? segment.text.trim() : '';
    const words = Array.isArray(segment?.words) ? segment.words : [];
    const wordCount = words.length || (text ? text.split(/\s+/).filter(Boolean).length : 0);
    const segmentId = segment?.id ?? index;

    if (current && current.speaker === speakerId) {
      current.end = Math.max(current.end, end);
      current.text = [current.text, text].filter(Boolean).join(' ').trim();
      current.segmentIds.push(segmentId);
      current.wordCount += wordCount;
    } else {
      if (current) {
        speakerSegments.push(current);
      }
      current = {
        speaker: speakerId,
        start,
        end,
        text,
        segmentIds: [segmentId],
        wordCount,
      };
    }
  });

  if (current) {
    speakerSegments.push(current);
  }

  if (Object.keys(speakers).length === 0) {
    speakers['SPEAKER_00'] = defaultSpeakerLabel(0);
  }

  return { speakers, speakerSegments };
};

const mergeSpeakerMaps = (
  preferred?: { [key: string]: string },
  fallback?: { [key: string]: string }
): { [key: string]: string } => {
  const result: { [key: string]: string } = { ...(fallback || {}) };
  if (preferred && typeof preferred === 'object') {
    Object.entries(preferred).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        result[key] = value;
      }
    });
  }
  return result;
};

class App {
  private mainWindow: BrowserWindow | null = null;
  private transcriptionJobs: Map<string, TranscriptionJob> = new Map();
  private readonly encryptionKey: string;
  private readonly apiKeysPath: string;
  private readonly projectManager: ProjectFileManager;
  private readonly audioAnalyzer: AudioAnalyzer;
  private readonly audioConverter: AudioConverter;
  private readonly userPreferences: UserPreferencesService;
  private readonly projectDataStore: ProjectDataStore;
  private peaksServer: http.Server | null = null;
  private peaksPort: number | null = null;
  private juceClient: JuceClient | null = null;
  private currentClips: any[] = [];

  constructor() {
    // Initialize encryption key (derived from machine-specific info)
    this.encryptionKey = this.generateEncryptionKey();
    
    // Set API keys storage path
    this.apiKeysPath = path.join(app.getPath('userData'), 'api-keys.enc');
    
    // Initialize project manager
    this.projectManager = new ProjectFileManager();
    
    // Initialize audio services
    this.audioAnalyzer = new AudioAnalyzer();
    this.audioConverter = new AudioConverter();
    this.userPreferences = new UserPreferencesService(this.encryptionKey);

    // Initialize project data store using singleton
    this.projectDataStore = ProjectDataStore.getInstance();
    this.setupProjectDataStoreEvents();

    this.initialize();
  }

  private startPeaksServer(): void {
    try {
      const server = http.createServer((req, res) => {
        const parsed = url.parse(req.url || '', true);
        if (parsed.pathname === '/peaks') {
          // Compute or serve cached mono peaks for the given file path
          const src = parsed.query.src as string;
          const spp = Math.max(256, parseInt((parsed.query.samplesPerPixel as string) || '1024', 10));
          res.setHeader('Access-Control-Allow-Origin', '*');
          if (!src) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing src' }));
          }
          const filePath = decodeURIComponent(src);
          if (!fs.existsSync(filePath)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Not found' }));
          }
          // Cache path: same folder, hidden .waveforms directory
          const dir = path.dirname(filePath);
          const base = path.basename(filePath);
          const cacheDir = path.join(dir, '.waveforms');
          const cachePath = path.join(cacheDir, `${base}.peaks.${spp}.json`);
          try {
            if (fs.existsSync(cachePath)) {
              const json = fs.readFileSync(cachePath, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(json);
            }
          } catch {}

          try {
            try { fs.mkdirSync(cacheDir, { recursive: true }); } catch {}
            const ff = spawn('ffmpeg', [
              '-v', 'error',
              '-i', filePath,
              '-f', 's16le',
              '-acodec', 'pcm_s16le',
              '-ac', '1', // mono simplifies peaks
              '-ar', '48000',
              'pipe:1',
            ]);

            const peaks: number[] = [];
            let buffer = Buffer.alloc(0);
            let totalSamplesCount = 0;
            ff.stdout.on('data', (chunk) => {
              buffer = Buffer.concat([buffer, chunk as Buffer]);
              const sampleSize = 2; // s16le
              const totalSamples = Math.floor(buffer.length / sampleSize);
              const windowSize = spp;
              const windows = Math.floor(totalSamples / windowSize);
              let offset = 0;
              for (let w = 0; w < windows; w++) {
                let min = 1.0; let max = -1.0;
                for (let i = 0; i < windowSize; i++) {
                  const s = buffer.readInt16LE(offset) / 32768;
                  if (s < min) min = s;
                  if (s > max) max = s;
                  offset += sampleSize;
                }
                peaks.push(min, max);
                totalSamplesCount += windowSize;
              }
              buffer = buffer.slice(offset);
            });

            ff.on('close', () => {
              if (buffer.length >= 2) {
                let min = 1.0; let max = -1.0;
                for (let off = 0; off + 2 <= buffer.length; off += 2) {
                  const s = buffer.readInt16LE(off) / 32768;
                  if (s < min) min = s;
                  if (s > max) max = s;
                }
                peaks.push(min, max);
                totalSamplesCount += Math.floor(buffer.length / 2);
              }
              const durationSec = totalSamplesCount / 48000;
              const payload = JSON.stringify({ samplesPerPixel: spp, channels: 1, sampleRate: 48000, durationSec, peaks });
              try { fs.writeFileSync(cachePath, payload, 'utf8'); } catch {}
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(payload);
            });

            ff.on('error', (e) => {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(e) }));
            });
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e) }));
          }
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end('Not found');
      });
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr && addr.port) {
          this.peaksServer = server;
          this.peaksPort = addr.port;
          console.log(`📊 Peaks server listening on http://127.0.0.1:${addr.port}`);
        }
      });
    } catch (e) {
      console.error('Failed to start peaks server:', e);
    }
  }

  private setupProjectDataStoreEvents(): void {
    // Forward project updates to all renderer processes
    this.projectDataStore.on('project:updated', (projectData: ProjectData) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('project:updated', projectData);
      }
    });

    this.projectDataStore.on('project:error', (error: Error) => {
      console.error('ProjectDataStore error:', error);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('project:error', error.message);
      }
    });

    this.projectDataStore.on('operation:applied', (operation: EditOperation) => {
      console.log('Edit operation applied:', operation.type, operation.id);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('operation:applied', operation);
      }
    });

    this.projectDataStore.on('operation:failed', (operation: EditOperation, error: Error) => {
      console.error('Edit operation failed:', operation.type, error.message);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('operation:failed', operation, error.message);
      }
    });
  }

  private initialize(): void {
    // Handle app ready
    app.whenReady().then(() => {
      try {
        crashReporter.start({ submitURL: '', uploadToServer: false });
        console.log('🧪 CrashReporter started. Dumps at:', app.getPath('crashDumps'));
      } catch (e) {
        console.error('Failed to start CrashReporter:', e);
      }
      this.createMainWindow();
      this.startPeaksServer();
      this.setupMenu();
      this.setupIPC();
      this.setupJuceTransport();

      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Quit when all windows are closed, except on macOS
    app.on('window-all-closed', () => {
      // Clean up temp files and resources
      this.audioConverter.cleanup().catch(console.error);
      
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    app.on('before-quit', () => {
      // Clean up resources before app quits
      this.audioConverter.cleanup().catch(console.error);
      try { this.peaksServer?.close(); } catch {}
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (_, contents) => {
      contents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
      });

      contents.on('render-process-gone', (_event, details) => {
        console.error('🚨 Renderer process gone:', details);
      });
      // child-process-gone is available at the app level; keep renderer-only here
      contents.on('unresponsive', () => {
        console.error('⚠️ Renderer became unresponsive');
      });
      contents.on('responsive', () => {
        console.log('✅ Renderer responsive again');
      });
    });

    // Capture GPU/utility process exits at the app level
    (app as any).on('child-process-gone', (_event: Electron.Event, details: any) => {
      console.error('🚨 Child process gone:', details);
    });
  }

  private setupJuceTransport(): void {
    try {
      this.juceClient = new JuceClient();
      const edlRevisionById = new Map<string, number>();
      const pendingAppliedById = new Map<string, number>();
      const pendingCountsById = new Map<string, { words: number; spacers: number; total: number }>();
      const generationById = new Map<string, number>();
      const getRev = (id: string) => edlRevisionById.get(id) ?? 0;
      const bumpRev = (id: string) => { const r = getRev(id) + 1; edlRevisionById.set(id, r); return r; };
      const getGeneration = (id: string) => generationById.get(id);
      const summarizeSegments = (clips: EdlClip[]) => {
        const stats = {
          totalSegments: 0,
          wordSegments: 0,
          spacerSegments: 0,
          spacersWithOriginal: 0,
          spacerPreview: [] as Array<{
            clipId: string;
            clipOrder: number;
            start: number;
            end: number;
            duration: number;
            hasOriginal: boolean;
            originalStart?: number;
            originalEnd?: number;
          }>,
        };

        for (const clip of clips) {
          if (!clip?.segments) continue;
          clip.segments.forEach((segment) => {
            stats.totalSegments += 1;
            if (segment.type === 'spacer') {
              stats.spacerSegments += 1;
              if (typeof segment.originalStartSec === 'number' && typeof segment.originalEndSec === 'number') {
                stats.spacersWithOriginal += 1;
              }
              if (stats.spacerPreview.length < 3) {
                stats.spacerPreview.push({
                  clipId: clip.id,
                  clipOrder: clip.order,
                  start: Number(segment.startSec.toFixed(3)),
                  end: Number(segment.endSec.toFixed(3)),
                  duration: Number((segment.endSec - segment.startSec).toFixed(3)),
                  hasOriginal: typeof segment.originalStartSec === 'number' && typeof segment.originalEndSec === 'number',
                  originalStart: typeof segment.originalStartSec === 'number'
                    ? Number(segment.originalStartSec.toFixed(3))
                    : undefined,
                  originalEnd: typeof segment.originalEndSec === 'number'
                    ? Number(segment.originalEndSec.toFixed(3))
                    : undefined,
                });
              }
            } else {
              stats.wordSegments += 1;
            }
          });
        }

        return stats;
      };

      const writeEdlDebug = (id: string, rev: number, clips: any[], stats: ReturnType<typeof summarizeSegments>) => {
        try {
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const base = process.env.EDL_DEBUG_DIR || '/tmp';
          try { fs.mkdirSync(base, { recursive: true }); } catch {}
          const fullPath = path.join(base, `edl_debug_${id}_${rev}_${ts}.json`);
          const latestPath = path.join(base, `edl_debug_latest.json`);
          const payload = {
            timestamp: new Date().toISOString(),
            sessionId: id,
            revision: rev,
            clipCount: Array.isArray(clips) ? clips.length : 0,
            segmentCounts: stats,
            spacerPreview: stats.spacerPreview,
            edl: clips,
          };
          const json = JSON.stringify(payload, null, 2);
          try { fs.writeFileSync(fullPath, json, 'utf8'); } catch {}
          try { fs.writeFileSync(latestPath, json, 'utf8'); } catch {}
        } catch (e) {
          console.error('Failed to write EDL debug file:', e);
        }
      };
      // Forward JUCE events to renderer(s)
      const attachGeneration = <E extends JuceEvent>(evt: E): E | null => {
        const id = (evt as any).id as string | undefined;
        if (!id) {
          return evt;
        }
        const currentGen = generationById.get(id);
        if (currentGen === undefined) {
          return evt;
        }
        const payloadGen = (evt as any).generationId;
        if (typeof payloadGen === 'number') {
          if (payloadGen !== currentGen) {
            console.warn('[Guard] ignoring stale event', {
              id,
              type: (evt as any).type,
              eventGen: payloadGen,
              currentGen,
            });
            return null;
          }
          return evt;
        }
        return { ...(evt as any), generationId: currentGen } as E;
      };

      const emitToWindows = (evt: JuceEvent) => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('juce:event', evt);
          }
        }
      };

      const forward = (evt: JuceEvent) => {
        try {
          const enriched = attachGeneration(evt);
          if (!enriched) {
            return;
          }
          emitToWindows(enriched);
        } catch (e) {
          console.error('Failed forwarding JUCE event:', e);
        }
      };
      this.juceClient.setEventHandlers({
        onLoaded: forward,
        onState: forward,
        onEdlApplied: (e) => {
          const id = (e as any).id as string;
          if (typeof e.revision === 'number') {
            edlRevisionById.set(id, e.revision);
          }
          pendingAppliedById.delete(id);
          const counts = pendingCountsById.get(id);
          const eventWithCounts = {
            ...e,
            wordCount: (e as any).wordCount ?? counts?.words ?? 0,
            spacerCount: (e as any).spacerCount ?? counts?.spacers ?? 0,
          } as JuceEvent;
          const enrichedEvent = attachGeneration(eventWithCounts);
          if (!enrichedEvent) {
            pendingCountsById.delete(id);
            return;
          }
          console.log('[IPC][JUCE] edlApplied event', {
            id,
            revision: (eventWithCounts as any).revision,
            wordCount: (eventWithCounts as any).wordCount,
            spacerCount: (eventWithCounts as any).spacerCount,
            mode: (eventWithCounts as any).mode,
            generation: (enrichedEvent as any).generationId,
          });
          emitToWindows(enrichedEvent);
          pendingCountsById.delete(id);
        },
        onPosition: (e) => {
          const id = (e as any).id as string;
          const rev = getRev(id);
          // If an EDL apply is pending for this id, emit edlApplied first
          if (pendingAppliedById.has(id)) {
            const appliedRev = pendingAppliedById.get(id)!;
            // Ensure our stored rev matches bumped rev
            if (appliedRev === rev) {
              const pendingCounts = pendingCountsById.get(id);
              const synthetic = attachGeneration({
                type: 'edlApplied',
                id,
                revision: appliedRev,
                wordCount: pendingCounts?.words ?? 0,
                spacerCount: pendingCounts?.spacers ?? 0,
              } as any);
              if (synthetic) {
                emitToWindows(synthetic);
              }
              pendingAppliedById.delete(id);
              pendingCountsById.delete(id);
            }
          }
          const enrichedPosition = attachGeneration({ ...(e as any), revision: rev } as any);
          if (enrichedPosition) {
            emitToWindows(enrichedPosition);
          }
        },
        onEnded: forward,
        onError: forward,
      });

      // IPC command handlers
      ipcMain.handle('juce:load', async (_e, id: string, filePath: string, generationId?: number) => {
        try {
          const ext = (path.extname(filePath || '') || '').replace('.', '').toLowerCase() || 'unknown';
          if (typeof generationId === 'number') {
            const prevGen = generationById.get(id);
            if (prevGen !== undefined && prevGen !== generationId) {
              console.log('[Load] supersede', { id, oldGen: prevGen, newGen: generationId });
            }
            generationById.set(id, generationId);
            pendingAppliedById.delete(id);
            pendingCountsById.delete(id);
            edlRevisionById.set(id, 0);
          }
          console.log('[Load] start', { id, gen: generationId, path: filePath, source: ext });
          const result = await this.juceClient!.load(id, filePath, generationId);
          return result;
        }
        catch (e) {
          return { success: false, error: String(e) };
        }
      });
      ipcMain.handle('juce:updateEdl', async (_e, id: string, revisionArg: number | undefined, clips: EdlClip[], generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale updateEdl request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          const prev = getRev(id);
          let incomingRevision = typeof revisionArg === 'number' && Number.isFinite(revisionArg)
            ? Math.floor(revisionArg)
            : undefined;
          if (incomingRevision !== undefined && incomingRevision <= prev) {
            const forced = prev + 1;
            console.warn('[IPC][JUCE] Incoming revision not monotonic, forcing bump', {
              id,
              previous: prev,
              incoming: incomingRevision,
              forced,
            });
            incomingRevision = forced;
          }
          const rev = incomingRevision ?? bumpRev(id);
          edlRevisionById.set(id, rev);
          const stats = summarizeSegments(clips);
          pendingCountsById.set(id, {
            words: stats.wordSegments,
            spacers: stats.spacerSegments,
            total: stats.totalSegments,
          });
          const payloadSize = Buffer.byteLength(JSON.stringify({ clips }));
          console.log('[IPC][JUCE] updateEdl request', {
            id,
            revision: rev,
            clips: clips.length,
            payloadBytes: payloadSize,
            words: stats.wordSegments,
            spacers: stats.spacerSegments,
            spacersWithOriginal: stats.spacersWithOriginal,
            spacerPreview: stats.spacerPreview,
            generation: generationId ?? generationById.get(id),
          });
          if (stats.spacerSegments === 0) {
            console.warn('[IPC][JUCE] ⚠️ No spacers detected in renderer payload for revision', rev);
          }

          const juceResult = await this.juceClient!.updateEdl(id, rev, clips, generationId);
          const ackRevision =
            typeof juceResult?.revision === 'number' && Number.isFinite(juceResult.revision)
              ? Math.floor(juceResult.revision)
              : rev;

          if (ackRevision !== rev) {
            console.warn('[IPC][JUCE] ⚠️ Backend acknowledged different revision than requested', {
              id,
              requested: rev,
              acknowledged: ackRevision,
            });
          }

          if (juceResult?.counts) {
            console.log('[IPC][JUCE] Backend acknowledged counts', {
              id,
              revision: ackRevision,
              counts: juceResult.counts,
            });
          }
          edlRevisionById.set(id, ackRevision);
          pendingAppliedById.set(id, ackRevision);
          // Write full, unfiltered EDL to /tmp for troubleshooting
          writeEdlDebug(id, ackRevision, clips as any, stats);
          return {
            success: true,
            revision: ackRevision,
            counts: {
              words: stats.wordSegments,
              spacers: stats.spacerSegments,
              spacersWithOriginal: stats.spacersWithOriginal,
              total: stats.totalSegments,
            },
          };
        } catch (e) {
          pendingCountsById.delete(id);
          pendingAppliedById.delete(id);
          return { success: false, error: String(e) };
        }
      });
      ipcMain.handle('juce:play', async (_e, id: string, generationId?: number) => {
        try {
          const currentGen = generationById.get(id);
          console.log('[Main] play received', { id, requestedGen: generationId, currentGen });

          if (typeof generationId === 'number') {
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale play request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          const generation = generationId ?? currentGen;
          console.log('[Main] play → JUCE', { id, generation });
          await this.juceClient!.play(id, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:pause', async (_e, id: string, generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale pause request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          const generation = generationId ?? generationById.get(id);
          console.log('[Main] pause → JUCE', { id, generation });
          await this.juceClient!.pause(id, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:stop', async (_e, id: string, generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale stop request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          const generation = generationId ?? generationById.get(id);
          console.log('[Main] stop → JUCE', { id, generation });
          await this.juceClient!.stop(id, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:seek', async (_e, id: string, timeSec: number, generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale seek request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          await this.juceClient!.seek(id, timeSec, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:setRate', async (_e, id: string, rate: number, generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale setRate request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          await this.juceClient!.setRate(id, rate, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:setTimeStretch', async (_e, id: string, ratio: number, generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale setTimeStretch request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          await this.juceClient!.setTimeStretch(id, ratio, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:setVolume', async (_e, id: string, value: number, generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale setVolume request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          await this.juceClient!.setVolume(id, value, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:queryState', async (_e, id: string, generationId?: number) => {
        try {
          if (typeof generationId === 'number') {
            const currentGen = generationById.get(id);
            if (currentGen !== undefined && currentGen !== generationId) {
              console.warn('[Guard] ignoring stale queryState request', { id, eventGen: generationId, currentGen });
              return { success: false, error: 'stale generation' };
            }
          }
          await this.juceClient!.queryState(id, generationId);
          return { success: true };
        }
        catch (e) { return { success: false, error: String(e) }; }
      });
      ipcMain.handle('juce:dispose', async () => {
        try { await this.juceClient?.dispose(); return { success: true }; }
        catch (e) { return { success: false, error: String(e) }; }
        finally {
          edlRevisionById.clear();
          pendingCountsById.clear();
          pendingAppliedById.clear();
          generationById.clear();
        }
      });
    } catch (e) {
      console.error('Failed to initialize JUCE transport:', e);
    }
  }

  private createMainWindow(): void {
    // FIXED: Use static preload path instead of function
    const preloadPath = path.resolve(__dirname, 'preload.js');
    console.log('🔧 MAIN: FIXED - static preload path:', preloadPath);
    console.log('🔧 MAIN: __dirname:', __dirname);
    console.log('🔧 MAIN: File exists:', fs.existsSync(preloadPath));
    
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true, // RESTORE contextIsolation for security
        sandbox: false,
        webSecurity: false, // Keep disabled for debugging
        devTools: true,
        preload: preloadPath, // FIXED: Static path
      },
      // Restore original window configuration  
      titleBarStyle: 'hiddenInset',
      transparent: true,
      vibrancy: 'sidebar',
      backgroundColor: '#00000000',
      movable: true,
      resizable: true,
      show: false // Don't show until ready-to-show
    });

    // Add window event logging
    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log('🔧 MAIN: Window started loading');
    });
    
    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('🔧 MAIN: Window finished loading');
      // Show window after content loads
      this.mainWindow?.show();
      // Only open DevTools if explicitly enabled
      if (process.env.DEVTOOLS_ENABLED === 'true') {
        this.mainWindow?.webContents.openDevTools();
      }
    });
    
    this.mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
      console.log('🔧 MAIN: PRELOAD ERROR:', preloadPath, error);
    });

    // Load the app - use built files but allow testing on localhost in dev
    if (isDev() && process.env.USE_LOCALHOST === 'true') {
      console.log('🔧 MAIN: Loading from localhost for testing...');
      this.mainWindow.loadURL('http://localhost:3000');
    } else {
      const rendererPath = path.join(__dirname, '../../renderer/index.html');
      console.log('🔧 MAIN: Loading renderer from:', rendererPath);
      console.log('🔧 MAIN: Renderer file exists:', fs.existsSync(rendererPath));
      this.mainWindow.loadFile(rendererPath);
    }
    
    // Check environment variable to control DevTools (only in dev mode)
    if (isDev()) {
      const devToolsEnabled = process.env.DEVTOOLS_ENABLED === 'true';
      if (devToolsEnabled) {
        console.log('🧪 Opening DevTools (DEVTOOLS_ENABLED=true)');
        this.mainWindow.webContents.openDevTools();
      } else {
        console.log('✨ DevTools disabled (DEVTOOLS_ENABLED=false or not set)');
      }
    }
    
    // Add event listeners for error handling
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Electron: Page failed to load:', errorCode, errorDescription);
    });

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Project',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-project');
            },
          },
          {
            label: 'Open Project',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              this.mainWindow?.webContents.send('menu-open-project');
            },
          },
          {
            label: 'Save Project',
            accelerator: 'CmdOrCtrl+S',
            click: () => {
              this.mainWindow?.webContents.send('menu-save-project');
            },
          },
          { type: 'separator' },
          {
            label: 'Import Audio',
            accelerator: 'CmdOrCtrl+I',
            click: () => {
              this.mainWindow?.webContents.send('menu-import-audio');
            },
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            },
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          {
            label: 'Open Audio Editor',
            accelerator: 'CmdOrCtrl+Shift+E',
            click: () => {
              this.mainWindow?.webContents.send('open-audio-editor-menu');
            }
          },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          {
            label: 'Toggle Dark Mode',
            accelerator: 'CmdOrCtrl+Shift+D',
            click: () => {
              this.mainWindow?.webContents.send('toggle-theme');
            },
          },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIPC(): void {
    // Handle IPC messages from renderer
    ipcMain.handle('app-version', () => {
      return app.getVersion();
    });

    ipcMain.handle('get-platform', () => {
      return process.platform;
    });

    // Audio file import dialog
    ipcMain.handle('import-audio-dialog', async () => {
      try {
        if (!this.mainWindow) {
          return { success: false, error: 'Main window not available' };
        }
        
        const result = await dialog.showOpenDialog(this.mainWindow, {
          title: 'Import Audio File',
          properties: ['openFile'],
          filters: [
            {
              name: 'Audio Files',
              extensions: ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'wma', 'aac']
            },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
          return {
            success: true,
            filePath: result.filePaths[0],
            fileName: path.basename(result.filePaths[0])
          };
        }

        return { success: false };
      } catch (error) {
        console.error('Dialog error:', error);
        return { 
          success: false, 
          error: `Dialog error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        };
      }
    });

    // Start transcription
    ipcMain.handle('start-transcription', async (event, filePath: string, modelSize: string = 'base') => {
      console.log('🚀 Starting transcription:', { filePath, modelSize });
      
      // Enhanced logging to trace service selection
      console.log('🔍 Transcription service analysis:');
      console.log('  - Received modelSize parameter:', modelSize);
      console.log('  - Service type:', modelSize.startsWith('cloud-') ? 'CLOUD' : 'LOCAL');
      
      // Send debug info to renderer
      this.mainWindow?.webContents.send('debug-log', `Main: Starting transcription with model ${modelSize}`);
      // Validate file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Audio file does not exist' };
      }

      // Validate file extension
      const supportedExtensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.wma', '.aac'];
      const fileExtension = path.extname(filePath).toLowerCase();
      if (!supportedExtensions.includes(fileExtension)) {
        return { 
          success: false, 
          error: `Unsupported file format: ${fileExtension}. Supported formats: ${supportedExtensions.join(', ')}` 
        };
      }

      // Check file size (limit to 500MB)
      const stats = fs.statSync(filePath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      if (fileSizeInMB > 500) {
        return { 
          success: false, 
          error: `File too large: ${fileSizeInMB.toFixed(1)}MB. Maximum size is 500MB.` 
        };
      }

      // Validate model size (including cloud models)
      const validLocalModels = ['tiny', 'base', 'small', 'medium', 'large'];
      const validCloudModels = ['cloud-openai', 'cloud-assemblyai', 'cloud-revai'];
      const allValidModels = [...validLocalModels, ...validCloudModels];
      
      if (!allValidModels.includes(modelSize)) {
        return { success: false, error: `Invalid model size: ${modelSize}` };
      }

      const jobId = Date.now().toString();
      const fileName = path.basename(filePath);
      
      // Check if it's a cloud model
      if (modelSize.startsWith('cloud-')) {
        console.log('Processing cloud transcription...');
        this.mainWindow?.webContents.send('debug-log', `Main: Processing cloud transcription`);
        const provider = modelSize.split('-')[1];
        console.log('Provider:', provider);
        this.mainWindow?.webContents.send('debug-log', `Main: Provider is ${provider}`);
        
        const job: TranscriptionJob = {
          id: jobId,
          filePath,
          fileName,
          status: 'pending',
          progress: 0
        };

        this.transcriptionJobs.set(jobId, job);
        this.mainWindow?.webContents.send('debug-log', `Main: Created cloud job with ID ${jobId}`);

        // Start cloud transcription process
        try {
          this.runCloudTranscription(jobId, filePath, modelSize);
          this.mainWindow?.webContents.send('debug-log', `Main: Called runCloudTranscription`);
        } catch (error) {
          this.mainWindow?.webContents.send('debug-log', `Main: Error calling runCloudTranscription: ${error}`);
        }

        return { success: true, jobId };
      } else {
        console.log('Processing local transcription...');
        
        const job: TranscriptionJob = {
          id: jobId,
          filePath,
          fileName,
          status: 'pending',
          progress: 0
        };

        this.transcriptionJobs.set(jobId, job);

        // Start local transcription process
        this.runTranscription(jobId, filePath, modelSize);

        return { success: true, jobId };
      }
    });

    // Get transcription status
    ipcMain.handle('get-transcription-status', (event, jobId: string) => {
      const job = this.transcriptionJobs.get(jobId);
      return job || null;
    });

    // Get all transcription jobs
    ipcMain.handle('get-all-transcriptions', () => {
      return Array.from(this.transcriptionJobs.values());
    });

    // Get transcription updates for polling
    ipcMain.handle('getTranscriptionUpdates', () => {
      return Array.from(this.transcriptionJobs.values());
    });

    // Cancel transcription
    ipcMain.handle('cancel-transcription', async (event, jobId: string) => {
      try {
        console.log('=== CANCEL TRANSCRIPTION REQUESTED ===');
        console.log('Cancel requested for job ID:', jobId);
        
        const job = this.transcriptionJobs.get(jobId);
        if (!job) {
          console.error('Cancel failed: Job not found:', jobId);
          return { success: false, error: 'Job not found' };
        }

        console.log('Found job to cancel:', { id: job.id, status: job.status, progress: job.progress });

        // Update job status
        job.status = 'error';
        job.error = 'Cancelled by user';
        job.progress = 0;

        console.log('Updated job status to cancelled');

        // Send cancellation event to renderer
        this.mainWindow?.webContents.send('transcription-error', {
          ...this.serializeJob(job),
          errorData: {
            message: 'Transcription cancelled by user',
            code: 'USER_CANCELLED',
            operation: 'transcription'
          }
        });

        console.log('Sent cancellation event to renderer');
        console.log('=== CANCEL TRANSCRIPTION COMPLETED ===');

        return { success: true };
      } catch (error) {
        console.error('Error cancelling transcription:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to cancel transcription' 
        };
      }
    });

    // Audio file handling
    ipcMain.handle('read-audio-file', async (event, filePath: string) => {
      try {
        console.log('IPC: read-audio-file requested for:', filePath);
        
        if (!fs.existsSync(filePath)) {
          console.error('Audio file does not exist at path:', filePath);
          throw new Error(`Audio file does not exist: ${filePath}`);
        }
        
        const stats = await fs.promises.stat(filePath);
        console.log('Audio file found, size:', stats.size, 'bytes');
        
        const audioBuffer = await fs.promises.readFile(filePath);
        console.log('Audio file read successfully, buffer size:', audioBuffer.length);
        return audioBuffer.buffer;
      } catch (error) {
        console.error('Error reading audio file:', error);
        throw error;
      }
    });

    // API key management
    ipcMain.handle('save-api-keys', async (event, apiKeys: { [service: string]: string }) => {
      try {
        const encryptedKeys = this.encryptApiKeys(apiKeys);
        await fs.promises.writeFile(this.apiKeysPath, encryptedKeys);
        return { success: true };
      } catch (error) {
        console.error('Error saving API keys:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to save API keys' 
        };
      }
    });

    ipcMain.handle('get-api-keys', async (event) => {
      try {
        console.log('DEBUG: get-api-keys called');
        console.log('DEBUG: API keys path:', this.apiKeysPath);
        
        if (!fs.existsSync(this.apiKeysPath)) {
          console.log('DEBUG: API keys file does not exist');
          return {}; // Return empty object if no keys file exists
        }
        
        console.log('DEBUG: Reading encrypted API keys file...');
        const encryptedData = await fs.promises.readFile(this.apiKeysPath, 'utf8');
        console.log('DEBUG: Encrypted data length:', encryptedData.length);
        
        const decryptedKeys = this.decryptApiKeys(encryptedData);
        console.log('DEBUG: Decrypted keys count:', Object.keys(decryptedKeys).length);
        return decryptedKeys;
      } catch (error) {
        console.error('Error getting API keys:', error);
        return {}; // Return empty object on error
      }
    });

    // REMOVED - Legacy project handlers causing conflicts

    // Test cloud API connections
    ipcMain.handle('test-cloud-connection', async (event, provider) => {
      try {
        console.log('Testing cloud connection for provider:', provider);
        
        // Get API keys
        const encryptedKeys = fs.existsSync(this.apiKeysPath) 
          ? await fs.promises.readFile(this.apiKeysPath, 'utf8')
          : '{}';
        const apiKeys = encryptedKeys === '{}' ? {} : this.decryptApiKeys(encryptedKeys);

        if (!apiKeys[provider]) {
          return { success: false, error: `API key for ${provider} not configured` };
        }

        const cloudService = new SimpleCloudTranscriptionService(apiKeys);
        
        let result = false;
        switch (provider) {
          case 'openai':
            result = await cloudService.testOpenAIConnection();
            break;
          case 'assemblyai':
            result = await cloudService.testAssemblyAIConnection();
            break;
          default:
            return { success: false, error: `Unknown provider: ${provider}` };
        }
        
        return { success: result, connected: result };
      } catch (error) {
        console.error('Cloud connection test failed:', error);
        return { 
          success: false, 
          connected: false,
          error: error instanceof Error ? error.message : 'Connection test failed' 
        };
      }
    });

    // Project file system handlers
    ipcMain.handle('dialog:openFile', async (event, options) => {
      const result = await dialog.showOpenDialog(this.mainWindow!, options);
      return result;
    });

    ipcMain.handle('dialog:saveFile', async (event, options) => {
      const result = await dialog.showSaveDialog(this.mainWindow!, options);
      return result;
    });

    ipcMain.handle('select-directory', async (event) => {
      try {
        if (!this.mainWindow) {
          return { success: false, error: 'Main window not available' };
        }

        const result = await dialog.showOpenDialog(this.mainWindow, {
          properties: ['openDirectory', 'createDirectory'],
          title: 'Select Project Location'
        });

        if (result.canceled) {
          return { success: false, cancelled: true };
        }

        if (result.filePaths && result.filePaths.length > 0) {
          return { 
            success: true, 
            filePath: result.filePaths[0],
            cancelled: false 
          };
        }

        return { success: false, error: 'No directory selected' };
      } catch (error) {
        console.error('Error in select-directory:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to select directory' 
        };
      }
    });

    ipcMain.handle('project:save', async (_event, projectData: any, filePath: string) => {
      try {
        if (!filePath) throw new Error('No project file path provided');

        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const audioDir = path.join(dir, 'Audio Files');
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.mkdir(audioDir, { recursive: true });

        // Determine source audio path from projectData
        console.log('🔍 Looking for source audio in projectData:', {
          extractedPath: projectData?.project?.audio?.extractedPath,
          embeddedPath: projectData?.project?.audio?.embeddedPath,
          path: projectData?.project?.audio?.path,
          originalFile: projectData?.project?.audio?.originalFile
        });

        let srcAudio = projectData?.project?.audio?.extractedPath
          || projectData?.project?.audio?.embeddedPath
          || projectData?.project?.audio?.path
          || projectData?.project?.audio?.originalFile;

        console.log('🎵 Selected source audio path:', srcAudio);

        // Enhanced fallback path resolution if file doesn't exist
        if (srcAudio && !fs.existsSync(srcAudio)) {
          console.warn('⚠️ Source audio not found at stored path, attempting fallback resolution...');

          // Extract just the filename
          const fileName = path.basename(srcAudio);
          const fallbackPaths = [
            `/Users/chrismcleod/Development/ClaudeAccess/Working Audio/${fileName}`,
            `/Users/chrismcleod/Development/ChatAppAccess/Working Audio/${fileName}`,
            `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/audio/${fileName}`,
            `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/${fileName}`
          ];

          for (const fallbackPath of fallbackPaths) {
            if (fs.existsSync(fallbackPath)) {
              console.log('🔍 Found source audio via fallback at:', fallbackPath);
              srcAudio = fallbackPath;
              break;
            }
          }
        }

        let targetWavPath: string | null = null;
        if (srcAudio && fs.existsSync(srcAudio)) {
          console.log('✅ Source audio file exists, starting WAV conversion...');
          targetWavPath = path.join(audioDir, `${baseName}.wav`);
          try {
            const result = await this.audioConverter.resampleAudio(
              srcAudio,
              48000,
              16,
              'wav',
              {
                outputPath: targetWavPath,
                onProgress: (percent) => {
                  this.mainWindow?.webContents.send('audio-conversion-progress', {
                    percent,
                    status: 'Converting to WAV 48k/16bit',
                  });
                }
              }
            );
            console.log('✅ Saved WAV to:', result.outputPath);
            targetWavPath = result.outputPath;
          } catch (e) {
            console.error('❌ WAV conversion failed, copying original:', e);
            const copyTarget = path.join(audioDir, path.basename(srcAudio));
            await fs.promises.copyFile(srcAudio, copyTarget);
            targetWavPath = copyTarget;
            console.log('📁 Copied original audio to:', copyTarget);
          }
        } else if (srcAudio) {
          console.error('❌ Source audio file does not exist:', srcAudio);
        } else {
          console.error('❌ NO SOURCE AUDIO FOUND - Cannot create WAV file. Check audio path in projectData.');
        }

        // Update projectData to point to WAV path
        projectData = projectData || {};
        projectData.project = projectData.project || {};
        projectData.project.audio = projectData.project.audio || {};
        if (targetWavPath) {
          projectData.project.audio.path = targetWavPath;
          delete projectData.project.audio.embeddedPath;
          delete projectData.project.audio.extractedPath;
        }

        // Write JSON .transcript file
        await fs.promises.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf8');

        // Store project path in ProjectDataStore
        this.projectDataStore.setCurrentProjectPath(filePath);

        return { success: true };
      } catch (error) {
        console.error('Failed to save project:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle('project:load', async (_event, filePath: string) => {
      try {
        if (!fs.existsSync(filePath)) throw new Error('Project file does not exist');
        const json = await fs.promises.readFile(filePath, 'utf8');
        const projectData = JSON.parse(json);
        // Ensure absolute audio path is resolved if relative
        const audio = projectData?.project?.audio;
        if (audio?.path && !path.isAbsolute(audio.path)) {
          const dir = path.dirname(filePath);
          const resolved = path.join(dir, audio.path);
          projectData.project.audio.path = resolved;
        }

        // Store project path in ProjectDataStore
        this.projectDataStore.setCurrentProjectPath(filePath);

        return projectData;
      } catch (error) {
        console.error('Failed to load project:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Cross-window clip sync
    ipcMain.handle('clips:get', async () => {
      return this.currentClips || [];
    });
    ipcMain.handle('clips:set', async (_e, clips: any[]) => {
      try {
        this.currentClips = Array.isArray(clips) ? clips : [];
        // Broadcast to all windows
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send('clips:changed', this.currentClips);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Open/close isolated Audio Editor window
    ipcMain.handle('open-audio-editor', async (_event, audioPath: string) => {
      try {
        if (!audioPath || typeof audioPath !== 'string') {
          throw new Error('audioPath is required');
        }

        // Reuse editor window if already open
        const existing = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Audio Editor');
        if (existing && !existing.isDestroyed()) {
          existing.focus();
          return { success: true };
        }

        const editorWin = new BrowserWindow({
          width: 1100,
          height: 600,
          title: 'Audio Editor',
          parent: this.mainWindow || undefined,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.resolve(__dirname, 'preload.js'),
            webSecurity: false,
          },
        });

        // Use direct file URL since JUCE handles audio directly
        const fileUrl = pathToFileURL(audioPath).toString();
        const editorUrl = (isDev() && process.env.USE_LOCALHOST === 'true')
          ? `http://localhost:3000/?audioEditor=1&src=${encodeURIComponent(fileUrl)}&peaksPort=${this.peaksPort}`
          : `file://${path.join(__dirname, '../../renderer/index.html')}?audioEditor=1&src=${encodeURIComponent(fileUrl)}&peaksPort=${this.peaksPort}`;

        await editorWin.loadURL(editorUrl);
        return { success: true };
      } catch (error) {
        console.error('Failed to open audio editor:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle('close-audio-editor', async () => {
      try {
        const existing = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'Audio Editor');
        if (existing && !existing.isDestroyed()) existing.close();
        return { success: true };
      } catch (error) {
        console.error('Failed to close audio editor:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Check if a file exists
    ipcMain.handle('checkFileExists', async (event, filePath) => {
      try {
        return fs.existsSync(filePath);
      } catch (error) {
        console.error('Error checking file existence:', error);
        return false;
      }
    });

    // Compute audio peaks via ffmpeg (IPC version of /peaks route)
    ipcMain.handle('audio:peaks', async (_event, filePath: string, samplesPerPixel?: number) => {
      try {
        if (!filePath || !fs.existsSync(filePath)) throw new Error('File not found');
        const spp = Math.max(256, parseInt(String(samplesPerPixel || 1024), 10));
        const ff = spawn('ffmpeg', [
          '-v', 'error',
          '-i', filePath,
          '-f', 's16le',
          '-acodec', 'pcm_s16le',
          '-ac', '1',
          '-ar', '48000',
          'pipe:1',
        ]);
        const peaks: number[] = [];
        let buffer = Buffer.alloc(0);
        let totalSamplesCount = 0;
        await new Promise<void>((resolve, reject) => {
          ff.stdout.on('data', (chunk) => {
            buffer = Buffer.concat([buffer, chunk as Buffer]);
            const sampleSize = 2;
            const totalSamples = Math.floor(buffer.length / sampleSize);
            const windowSize = spp;
            const windows = Math.floor(totalSamples / windowSize);
            let offset = 0;
            for (let w = 0; w < windows; w++) {
              let min = 1.0; let max = -1.0;
              for (let i = 0; i < windowSize; i++) {
                const s = buffer.readInt16LE(offset) / 32768;
                if (s < min) min = s;
                if (s > max) max = s;
                offset += sampleSize;
              }
              peaks.push(min, max);
              totalSamplesCount += windowSize;
            }
            buffer = buffer.slice(offset);
          });
          ff.on('close', () => {
            if (buffer.length >= 2) {
              let min = 1.0; let max = -1.0;
              for (let off = 0; off + 2 <= buffer.length; off += 2) {
                const s = buffer.readInt16LE(off) / 32768;
                if (s < min) min = s;
                if (s > max) max = s;
              }
              peaks.push(min, max);
              totalSamplesCount += Math.floor(buffer.length / 2);
            }
            resolve();
          });
          ff.on('error', (e) => reject(e));
        });
        const durationSec = totalSamplesCount / 48000;
        return { samplesPerPixel: spp, channels: 1, sampleRate: 48000, durationSec, peaks };
      } catch (e) {
        console.error('audio:peaks failed:', e);
        return { error: String(e) };
      }
    });
    
    // Convenience handlers for project file dialogs
    ipcMain.handle('openProjectDialog', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        title: 'Open Transcription Project',
        filters: [
          { name: 'Transcription Projects', extensions: ['transcript'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      return result;
    });

    ipcMain.handle('saveProjectDialog', async (event, defaultName) => {
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        title: 'Save Transcription Project',
        defaultPath: defaultName || 'Untitled.transcript',
        filters: [
          { name: 'Transcription Projects', extensions: ['transcript'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      return result;
    });

    // Audio analysis handlers
    ipcMain.handle('analyze-audio', async (event, filePath: string) => {
      try {
        console.log('Analyzing audio file:', filePath);
        const analysis = await this.audioAnalyzer.analyze(filePath);
        console.log('Audio analysis complete:', analysis);
        return analysis;
      } catch (error) {
        console.error('Audio analysis failed:', error);
        throw new Error(`Failed to analyze audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('get-audio-recommendation', async (event, analysis: any) => {
      try {
        const recommendation = this.audioAnalyzer.generateRecommendation(analysis);
        console.log('Generated recommendation:', recommendation);
        return recommendation;
      } catch (error) {
        console.error('Failed to generate recommendation:', error);
        throw new Error(`Failed to generate recommendation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('get-smart-project-settings', async (event, analysis: any) => {
      try {
        const settings = this.audioAnalyzer.determineProjectSettings(analysis);
        console.log('Generated smart settings:', settings);
        return settings;
      } catch (error) {
        console.error('Failed to generate smart settings:', error);
        throw new Error(`Failed to generate settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('convert-audio', async (event, inputPath: string, options: any) => {
      try {
        console.log('Converting audio:', inputPath, options);
        
        // Progress callback to send updates to renderer
        const onProgress = (percent: number, status: string) => {
          this.mainWindow?.webContents.send('audio-conversion-progress', {
            percent,
            status
          });
        };

        let result;
        // Force WAV (48k/16-bit) for the simplified import flow
        const sr = options.targetSampleRate || 48000;
        const bd = options.targetBitDepth || 16;
        result = await this.audioConverter.resampleAudio(
          inputPath,
          sr,
          bd,
          'wav',
          { onProgress }
        );

        console.log('Audio conversion complete:', result);
        return result;
      } catch (error) {
        console.error('Audio conversion failed:', error);
        throw new Error(`Failed to convert audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // User preferences management
    ipcMain.handle('load-user-preferences', async (event) => {
      try {
        const preferences = await this.userPreferences.loadPreferences();
        console.log('Loaded user preferences:', preferences);
        return preferences;
      } catch (error) {
        console.error('Failed to load user preferences:', error);
        throw new Error(`Failed to load preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('save-user-preferences', async (event, preferences: any) => {
      try {
        await this.userPreferences.savePreferences(preferences);
        console.log('Saved user preferences:', preferences);
        return { success: true };
      } catch (error) {
        console.error('Failed to save user preferences:', error);
        throw new Error(`Failed to save preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('reset-user-preferences', async (event) => {
      try {
        const defaultPreferences = await this.userPreferences.resetToDefaults();
        console.log('Reset user preferences to defaults:', defaultPreferences);
        return defaultPreferences;
      } catch (error) {
        console.error('Failed to reset user preferences:', error);
        throw new Error(`Failed to reset preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    ipcMain.handle('get-transcription-service', async (event, uiSettings: any) => {
      try {
        console.log('🎯 get-transcription-service IPC called with UI settings:', uiSettings);
        
        // Load stored preferences as fallback
        const storedPreferences = await this.userPreferences.loadPreferences();
        console.log('📂 Loaded stored preferences for fallback:', storedPreferences);
        
        // Get service name using UI settings first, stored preferences as fallback
        const service = this.userPreferences.getTranscriptionService(uiSettings, storedPreferences);
        console.log('✅ Generated transcription service:', service);
        
        return service;
      } catch (error) {
        console.error('❌ Failed to get transcription service:', error);
        throw new Error(`Failed to get transcription service: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // ==================== V2.0 Project Data Store IPC Handlers ====================

    // Apply edit operation
    ipcMain.handle('project:applyEdit', async (_event, operation: EditOperation) => {
      try {
        await this.projectDataStore.applyEditOperation(operation);
        return { success: true };
      } catch (error) {
        console.error('Failed to apply edit operation:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get current project state
    ipcMain.handle('project:getState', async (_event) => {
      try {
        const projectData = this.projectDataStore.getProjectData();
        return { success: true, data: projectData };
      } catch (error) {
        console.error('Failed to get project state:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Load project into data store
    ipcMain.handle('project:loadIntoStore', async (_event, projectData: ProjectData) => {
      try {
        this.projectDataStore.loadProject(projectData);
        return { success: true };
      } catch (error) {
        console.error('Failed to load project into store:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get current clips
    ipcMain.handle('project:getClips', async (_event) => {
      try {
        const clips = this.projectDataStore.getClips();
        return { success: true, data: clips };
      } catch (error) {
        console.error('Failed to get clips:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Validate project
    ipcMain.handle('project:validate', async (_event) => {
      try {
        const validation = this.projectDataStore.validateProject();
        return { success: true, data: validation };
      } catch (error) {
        console.error('Failed to validate project:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get operation history
    ipcMain.handle('project:getHistory', async (_event) => {
      try {
        const history = this.projectDataStore.getOperationHistory();
        return { success: true, data: history };
      } catch (error) {
        console.error('Failed to get operation history:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // ==================== v2.0 Transcription IPC Handlers ====================

    // EventEmitter adapter to bridge TranscriptionServiceV2 and App's webContents.send()
    class EventEmitterAdapter {
      constructor(private app: App) {}

      emit(event: string, data: any): void {
        console.log('🔄 EventEmitterAdapter: Emitting', event, data);

        // Map TranscriptionServiceV2 events to webContents events
        switch (event) {
          case 'transcription:progress':
            this.app.mainWindow?.webContents.send('transcription-progress', data);
            break;
          case 'transcription:completed':
            this.app.mainWindow?.webContents.send('transcription-complete', data);
            break;
          case 'transcription:error':
            this.app.mainWindow?.webContents.send('transcription-error', data);
            break;
          default:
            console.warn('🚨 EventEmitterAdapter: Unknown event:', event);
        }
      }
    }

    // Initialize TranscriptionServiceV2 with event emitter adapter
    const eventAdapter = new EventEmitterAdapter(this);
    TranscriptionServiceV2.setEventEmitter(eventAdapter);

    // Load and set API keys for TranscriptionServiceV2
    const loadApiKeysForV2 = async () => {
      try {
        console.log('🔑 Loading API keys for TranscriptionServiceV2...');
        if (fs.existsSync(this.apiKeysPath)) {
          const encryptedData = await fs.promises.readFile(this.apiKeysPath, 'utf8');
          const apiKeys = this.decryptApiKeys(encryptedData);
          TranscriptionServiceV2.setApiKeys(apiKeys);
          console.log('✅ API keys loaded for TranscriptionServiceV2');
        } else {
          console.log('⚠️  No API keys file found, using empty keys');
          TranscriptionServiceV2.setApiKeys({});
        }
      } catch (error) {
        console.error('❌ Failed to load API keys for TranscriptionServiceV2:', error);
        TranscriptionServiceV2.setApiKeys({});
      }
    };
    loadApiKeysForV2();

    // Start v2.0 transcription
    ipcMain.handle('transcription:startV2', async (_event, filePath: string, options: any) => {
      try {
        console.log('🎬 IPC Handler: transcription:startV2 called with:', { filePath, options });
        console.log('🔧 IPC Handler: About to call TranscriptionServiceV2.startTranscription...');

        const result = await TranscriptionServiceV2.startTranscription(filePath, options);

        console.log('✅ IPC Handler: TranscriptionServiceV2.startTranscription returned:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC Handler: Failed to start v2.0 transcription:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get v2.0 transcription job
    ipcMain.handle('transcription:getJobV2', async (_event, jobId: string) => {
      try {
        const job = TranscriptionServiceV2.getJob(jobId);
        return { success: true, data: job };
      } catch (error) {
        console.error('Failed to get v2.0 transcription job:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Get all v2.0 transcription jobs
    ipcMain.handle('transcription:getAllJobsV2', async (_event) => {
      try {
        const jobs = TranscriptionServiceV2.getAllJobs();
        return { success: true, data: jobs };
      } catch (error) {
        console.error('Failed to get v2.0 transcription jobs:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Cancel v2.0 transcription job
    ipcMain.handle('transcription:cancelV2', async (_event, jobId: string) => {
      try {
        const result = await TranscriptionServiceV2.cancelJob(jobId);
        return result;
      } catch (error) {
        console.error('Failed to cancel v2.0 transcription:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Import v2.0 transcription result using TranscriptionImportService
    ipcMain.handle('transcription:importV2', async (_event, segments: any[], speakers: any, audioMetadata: any) => {
      try {
        console.log('📝 Importing v2.0 transcription result using TranscriptionImportService');
        console.log('🎵 Audio metadata received:', audioMetadata);
        console.log('📄 Segments received:', segments.length);

        // Import required service
        const { TranscriptionImportService } = await import('../renderer/services/TranscriptionImportService');

        // Create transcription result structure for the import service
        const transcriptionResult = {
          segments: segments,
          speakers: speakers || {},
          speakerSegments: [], // Will be built by the import service
          language: 'en'
        };

        // Create proper audio metadata with path for WAV conversion
        let audioPath = audioMetadata.audioPath || audioMetadata.originalPath || audioMetadata.fileName;

        // Enhanced path resolution - ensure we have a valid absolute path to source audio
        if (audioPath && !audioPath.startsWith('/')) {
          // If it's just a filename, try to find it in common locations
          const possiblePaths = [
            `/Users/chrismcleod/Development/ClaudeAccess/Working Audio/${audioPath}`,
            `/Users/chrismcleod/Development/ChatAppAccess/Working Audio/${audioPath}`,
            `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/${audioPath}`,
            `/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/audio/${audioPath}`
          ];

          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              console.log('🔍 Found source audio at:', possiblePath);
              audioPath = possiblePath;
              break;
            }
          }
        }

        // Verify the resolved path exists
        if (audioPath && audioPath !== 'unknown' && !fs.existsSync(audioPath)) {
          console.warn('⚠️ Source audio file not found at resolved path:', audioPath);
          console.log('🔍 Available audio files in Working Audio:');
          const workingAudioDir = '/Users/chrismcleod/Development/ClaudeAccess/Working Audio';
          try {
            const files = fs.readdirSync(workingAudioDir);
            files.forEach(file => console.log('  -', file));
          } catch (e) {
            console.log('  Directory not accessible:', e instanceof Error ? e.message : String(e));
          }
        }

        const properAudioMetadata = {
          originalFile: audioPath || 'unknown',
          originalName: audioMetadata.fileName || 'Untitled Audio',
          embeddedPath: undefined,
          path: audioPath, // This is critical for WAV conversion during save
          duration: audioMetadata.duration || 0,
          format: audioMetadata.format || 'unknown',
          size: audioMetadata.size || 0,
          embedded: false
        };

        console.log('🎵 Processed audio metadata with resolved path:', {
          original: audioMetadata.audioPath,
          resolved: audioPath,
          exists: audioPath && audioPath !== 'unknown' ? fs.existsSync(audioPath) : false
        });

        // Use TranscriptionImportService to create proper ProjectData with segments
        const projectData = TranscriptionImportService.importTranscription(
          transcriptionResult,
          audioPath,
          properAudioMetadata
        );

        console.log('✅ TranscriptionImportService created project with', projectData.clips.clips.length, 'clips');

        // Load into ProjectDataStore
        this.projectDataStore.loadProject(projectData);

        return { success: true };

      } catch (error) {
        console.error('Failed to import v2.0 transcription:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // REMOVED - Duplicate handlers, using clean project:save and project:load instead
  }

  private serializeJob(job: TranscriptionJob): any {
    // Create a clean serializable version of the job
    const serialized = {
      id: job.id,
      filePath: job.filePath,
      fileName: job.fileName,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      speakerNames: job.speakerNames,
      speakerMerges: job.speakerMerges,
      speakerSegments: job.speakerSegments || job.result?.speakerSegments
    };
    
    console.log('DEBUG: Serializing job:', job);
    console.log('DEBUG: Serialized result:', serialized);
    console.log('DEBUG: Serialized JSON:', JSON.stringify(serialized));
    
    return serialized;
  }

  private generateEncryptionKey(): string {
    // Generate a machine-specific key using more stable identifiers
    // Use userData path instead of exe path for consistency across dev/prod
    const machineId = process.platform + app.getVersion() + app.getPath('userData');
    return crypto.createHash('sha256').update(machineId).digest('hex'); // Full 64 character hex = 32 bytes
  }

  private encryptApiKeys(apiKeys: { [service: string]: string }): string {
    try {
      const text = JSON.stringify(apiKeys);
      const algorithm = 'aes-256-cbc';
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex').subarray(0, 32); // Ensure exactly 32 bytes
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      throw new Error('Failed to encrypt API keys');
    }
  }

  private decryptApiKeys(encryptedData: string): { [service: string]: string } {
    const algorithm = 'aes-256-cbc';
    const parts = encryptedData.split(':');

    if (parts.length !== 2) {
      console.error('Invalid encrypted data format');
      return {};
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];

    // Try current encryption key first
    try {
      const key = Buffer.from(this.encryptionKey, 'hex').subarray(0, 32);
      const decipher = crypto.createDecipheriv(algorithm, key, iv);

      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      const result = JSON.parse(decrypted);
      console.log('✅ Successfully decrypted API keys with current key:', Object.keys(result));
      return result;
    } catch (currentKeyError) {
      console.log('❌ Current key failed, trying legacy key...');

      // Try legacy encryption key (with exe path)
      try {
        const legacyMachineId = process.platform + app.getVersion() + app.getPath('exe');
        const legacyKey = crypto.createHash('sha256').update(legacyMachineId).digest('hex');
        const key = Buffer.from(legacyKey, 'hex').subarray(0, 32);
        const decipher = crypto.createDecipheriv(algorithm, key, iv);

        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const result = JSON.parse(decrypted);
        console.log('✅ Successfully decrypted API keys with legacy key:', Object.keys(result));

        // Re-encrypt with new key for future use
        console.log('🔄 Re-encrypting API keys with new stable key...');
        try {
          const newEncryptedData = this.encryptApiKeys(result);
          fs.writeFileSync(this.apiKeysPath, newEncryptedData);
          console.log('✅ API keys re-encrypted with stable key');
        } catch (reEncryptError) {
          console.warn('⚠️  Failed to re-encrypt keys, but decryption successful');
        }

        return result;
      } catch (legacyKeyError) {
        console.error('❌ Both current and legacy decryption failed');
        console.error('Current key error:', currentKeyError);
        console.error('Legacy key error:', legacyKeyError);
        console.log('🔧 Machine ID components:', {
          platform: process.platform,
          version: app.getVersion(),
          userData: app.getPath('userData'),
          exe: app.getPath('exe')
        });

        // Return empty object - user will need to re-enter API keys
        return {};
      }
    }
  }

  private async runCloudTranscription(jobId: string, filePath: string, modelSize: string): Promise<void> {
    console.log('DEBUG: runCloudTranscription called with jobId:', jobId);
    this.mainWindow?.webContents.send('debug-log', `Main: runCloudTranscription called with jobId ${jobId}`);
    console.log('DEBUG: Available job IDs:', Array.from(this.transcriptionJobs.keys()));
    this.mainWindow?.webContents.send('debug-log', `Main: Available job IDs: ${Array.from(this.transcriptionJobs.keys()).join(', ')}`);
    const job = this.transcriptionJobs.get(jobId);
    console.log('DEBUG: Found job:', job);
    this.mainWindow?.webContents.send('debug-log', `Main: Found job: ${job ? 'YES' : 'NO'}`);
    if (!job) {
      console.error('ERROR: Job not found for ID:', jobId);
      this.mainWindow?.webContents.send('debug-log', `Main: ERROR - Job not found for ID ${jobId}`);
      return;
    }

    // Extract provider before try block so it's available in catch
    const provider = modelSize.split('-')[1]; // Extract provider from 'cloud-openai'

    try {
      console.log('Cloud transcription starting for job:', jobId);
      
      // Get API keys
      const encryptedKeys = fs.existsSync(this.apiKeysPath) 
        ? await fs.promises.readFile(this.apiKeysPath, 'utf8')
        : '{}';
      const apiKeys = encryptedKeys === '{}' ? {} : this.decryptApiKeys(encryptedKeys);
      console.log('Provider:', provider);
      console.log('API keys available:', Object.keys(apiKeys));
      console.log('OpenAI key exists:', !!apiKeys.openai);
      console.log('OpenAI key length:', apiKeys.openai?.length || 0);
      this.mainWindow?.webContents.send('debug-log', `Main: API keys loaded: ${Object.keys(apiKeys).join(', ')}`);
      
      if (!apiKeys[provider]) {
        const error = new Error(`API key for ${provider} not configured`);
        (error as any).code = 'INVALID_API_KEY';
        throw error;
      }

      job.progress = 20;
      console.log('DEBUG: Sending progress event (cloud 20%):', job);
      
      // Create a clean serializable object
      const progressData = {
        id: job.id,
        filePath: job.filePath,
        fileName: job.fileName,
        status: job.status,
        progress: job.progress,
        error: job.error
      };
      
      console.log('DEBUG: Serializable progress data:', JSON.stringify(progressData));
      this.mainWindow?.webContents.send('debug-log', `Main: Sending progress event with job id ${job.id}`);
      
      // Test with a simple object first
      const testData = { test: 'hello', id: job.id };
      console.log('DEBUG: Sending test data:', testData);
      this.mainWindow?.webContents.send('debug-log', `Main: Test data: ${JSON.stringify(testData)}`);
      
      // Try sending the serialized job
      const serializedJob = this.serializeJob(job);
      this.mainWindow?.webContents.send('debug-log', `Main: Serialized job: ${JSON.stringify(serializedJob)}`);
      this.mainWindow?.webContents.send('transcription-progress', serializedJob);

      // Create cloud transcription service instance
      const cloudService = new SimpleCloudTranscriptionService(apiKeys);
      
      const progressCallback = (progress: { progress: number; status: string }) => {
        console.log('Progress update:', progress);
        job.progress = progress.progress;
        const progressEvent = {
          ...job,
          progress: progress.progress,
          status: progress.status
        };
        console.log('DEBUG: Sending progress event (cloud callback):', progressEvent);
        this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));
      };

      let result;
      console.log('=== CALLING TRANSCRIPTION SERVICE ===');
      this.mainWindow?.webContents.send('debug-log', `Main: Calling ${provider} transcription service`);
      
      switch (provider) {
        case 'openai':
          console.log('Using OpenAI transcription with file:', filePath);
          this.mainWindow?.webContents.send('debug-log', `Main: Starting OpenAI transcription`);
          try {
            result = await cloudService.transcribeWithOpenAI(filePath, progressCallback);
            console.log('OpenAI transcription call completed. Result:', {
              hasResult: !!result,
              resultType: typeof result,
              keys: result ? Object.keys(result) : []
            });
            this.mainWindow?.webContents.send('debug-log', `Main: OpenAI call completed successfully`);
          } catch (openaiError) {
            console.error('OpenAI transcription failed:', openaiError);
            this.mainWindow?.webContents.send('debug-log', `Main: OpenAI failed: ${openaiError}`);
            throw openaiError;
          }
          break;
        case 'assemblyai':
          console.log('Using AssemblyAI transcription');
          this.mainWindow?.webContents.send('debug-log', `Main: Starting AssemblyAI transcription`);
          result = await cloudService.transcribeWithAssemblyAI(filePath, progressCallback);
          break;
        case 'revai':
          console.log('Using Rev.ai transcription (simulated)');
          this.mainWindow?.webContents.send('debug-log', `Main: Starting Rev.ai simulation`);
          // For now, use simulation for Rev.ai since we don't have the full implementation
          result = await this.simulateCloudTranscription(filePath, provider, apiKeys[provider]);
          break;
        default:
          throw new Error(`Unknown cloud provider: ${provider}`);
      }

      console.log('=== TRANSCRIPTION SERVICE COMPLETED ===');
      console.log('Cloud transcription completed:', {
        hasResult: !!result,
        resultType: typeof result,
        segmentCount: result?.segments?.length || 0,
        firstSegmentText: result?.segments?.[0]?.text || 'No text',
        resultKeys: result ? Object.keys(result) : []
      });
      this.mainWindow?.webContents.send('debug-log', `Main: Transcription completed with ${result?.segments?.length || 0} segments`);

      if (!result) {
        throw new Error('Transcription service returned empty result');
      }

      const metadata = buildSpeakerMetadata(result.segments || []);
      const mergedSpeakers = Object.keys(result?.speakers || {}).length > 0
        ? mergeSpeakerMaps(result.speakers, metadata.speakers)
        : metadata.speakers;
      const speakerSegments = Array.isArray(result?.speakerSegments) && result.speakerSegments.length > 0
        ? result.speakerSegments
        : metadata.speakerSegments;

      result = {
        ...result,
        speakers: mergedSpeakers,
        speakerSegments,
      };

      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.speakerNames = { ...mergedSpeakers };
      job.speakerSegments = speakerSegments;
      console.log('=== SENDING COMPLETION EVENT ===');
      console.log('DEBUG: Sending completion event (cloud). Job status:', job.status, 'Progress:', job.progress);
      this.mainWindow?.webContents.send('debug-log', `Main: Sending completion event to renderer`);
      this.mainWindow?.webContents.send('transcription-complete', this.serializeJob(job));
      console.log('=== COMPLETION EVENT SENT ===');

    } catch (error: any) {
      console.error('Cloud transcription failed:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      job.status = 'error';
      job.progress = 0;
      
      // Structure the error for frontend processing
      const errorData = {
        message: error instanceof Error ? error.message : 'Cloud transcription failed',
        code: error.code || 'TRANSCRIPTION_FAILED',
        operation: 'transcription',
        provider: provider,
        originalError: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
      
      job.error = errorData.message;
      
      // Send structured error to frontend for proper handling
      this.mainWindow?.webContents.send('transcription-error', {
        ...this.serializeJob(job),
        errorData
      });
    }
  }

  private async simulateCloudTranscription(filePath: string, provider: string, apiKey: string): Promise<any> {
    // This is a placeholder for cloud transcription
    // In a real implementation, this would call the actual cloud APIs
    return new Promise((resolve) => {
      setTimeout(() => {
        const simulatedSegments = [
          {
            id: 0,
            start: 0.0,
            end: 5.0,
            text: `This is a simulated transcription from ${provider} using cloud API.`,
            words: [
              { start: 0.0, end: 0.5, word: "This", score: 0.99, speaker: 'SPEAKER_00' },
              { start: 0.5, end: 0.7, word: "is", score: 0.98, speaker: 'SPEAKER_00' },
              { start: 0.7, end: 0.9, word: "a", score: 0.97, speaker: 'SPEAKER_00' },
              { start: 0.9, end: 1.5, word: "simulated", score: 0.96, speaker: 'SPEAKER_00' },
              { start: 1.5, end: 2.2, word: "transcription", score: 0.95, speaker: 'SPEAKER_00' }
            ],
            speaker: 'SPEAKER_00'
          }
        ];
        const metadata = buildSpeakerMetadata(simulatedSegments);

        resolve({
          status: 'success',
          segments: simulatedSegments,
          language: 'en',
          word_segments: simulatedSegments[0]?.words || [],
          speakers: metadata.speakers,
          speakerSegments: metadata.speakerSegments
        });
      }, 3000); // Simulate 3 second cloud processing time
    });
  }

  private async runTranscription(jobId: string, filePath: string, modelSize: string): Promise<void> {
    console.log('DEBUG: runTranscription called with:', { jobId, filePath, modelSize });
    const job = this.transcriptionJobs.get(jobId);
    if (!job) {
      console.log('ERROR: Job not found for ID:', jobId);
      return;
    }

    try {
      console.log('DEBUG: Starting transcription process for job:', job);
      job.status = 'processing';
      job.progress = 10;
      this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));

      // Check if this is a cloud transcription
      if (modelSize.startsWith('cloud-')) {
        await this.runCloudTranscription(jobId, filePath, modelSize);
        return;
      }

      // Handle local transcription
      // In development: __dirname is build/main/main, so we need to go up to project root
      // In production: __dirname is build/main, so we need to go up to project root
      const projectRoot = app.getAppPath();
      const whisperServicePath = path.join(projectRoot, 'whisper_service.py');
      
      console.log('Main process __dirname:', __dirname);
      console.log('Whisper service path:', whisperServicePath);
      console.log('File exists:', fs.existsSync(whisperServicePath));
      
      console.log('DEBUG: Spawning Python process with args:', [whisperServicePath, 'transcribe', filePath, '--model', modelSize, '--language', 'en']);
      const pythonProcess = spawn('python3', [whisperServicePath, 'transcribe', filePath, '--model', modelSize, '--language', 'en'], {
        env: process.env,
      });
      console.log('DEBUG: Python process spawned with PID:', pythonProcess.pid);
      
      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        job.progress = Math.min(job.progress + 10, 90);
        this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));
      });

      pythonProcess.stderr.on('data', (data) => {
        const stderrData = data.toString();
        errorOutput += stderrData;
        
        // Parse progress updates from stderr (format: PROGRESS:XX)
        const progressMatch = stderrData.match(/PROGRESS:(\d+)/);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1]);
          job.progress = progress;
          this.mainWindow?.webContents.send('transcription-progress', this.serializeJob(job));
          console.log(`Transcription progress: ${progress}%`);
        }
      });

      pythonProcess.on('close', (code) => {
        console.log('Python process closed with code:', code);
        console.log('Raw output:', output);
        console.log('Raw error output:', errorOutput);
        
        if (code === 0) {
          try {
            // Try to extract JSON from the output (may have extra logging)
            let jsonResult = output.trim();
            
            // If output starts with non-JSON content, try to find the JSON part
            const jsonStart = jsonResult.indexOf('{');
            const jsonEnd = jsonResult.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
              jsonResult = jsonResult.substring(jsonStart, jsonEnd + 1);
            }
            
            let result = JSON.parse(jsonResult);

            if (result.status === 'success') {
              const metadata = buildSpeakerMetadata(result.segments || []);
              const mergedSpeakers = Object.keys(result?.speakers || {}).length > 0
                ? mergeSpeakerMaps(result.speakers, metadata.speakers)
                : metadata.speakers;
              const speakerSegments = Array.isArray(result?.speakerSegments) && result.speakerSegments.length > 0
                ? result.speakerSegments
                : metadata.speakerSegments;

              result = {
                ...result,
                speakers: mergedSpeakers,
                speakerSegments,
              };

              job.status = 'completed';
              job.progress = 100;
              job.result = result;
              job.speakerNames = { ...mergedSpeakers };
              job.speakerSegments = speakerSegments;
              this.mainWindow?.webContents.send('transcription-complete', this.serializeJob(job));
            } else {
              job.status = 'error';
              job.error = result.message || 'Transcription failed with unknown error';
              
              // Show error dialog to user
              dialog.showErrorBox(
                'Transcription Failed',
                `Failed to transcribe "${job.fileName}":\n\n${job.error}`
              );
              
              this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
            }
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            job.status = 'error';
            job.error = 'Failed to parse transcription result. Raw output: ' + output.substring(0, 300);
            
            // Show error dialog to user
            dialog.showErrorBox(
              'Transcription Parse Error',
              `Failed to parse transcription result for "${job.fileName}":\n\n${job.error}`
            );
            
            this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
          }
        } else {
          job.status = 'error';
          let errorMessage = 'Transcription process failed';
          
          const combinedError = errorOutput + output; // Sometimes errors go to stdout
          
          if (combinedError.includes('ModuleNotFoundError')) {
            errorMessage = 'WhisperX is not properly installed. Please run: pip3 install whisperx';
          } else if (combinedError.includes('FileNotFoundError')) {
            errorMessage = 'Audio file not found or cannot be accessed';
          } else if (combinedError.includes('OutOfMemoryError') || combinedError.includes('CUDA out of memory')) {
            errorMessage = 'Out of memory. Try using a smaller model size or a shorter audio file';
          } else if (combinedError.includes('UnsupportedFormat')) {
            errorMessage = 'Unsupported audio format. Please convert to WAV, MP3, or another supported format';
          } else if (combinedError) {
            errorMessage = combinedError.substring(0, 300);
          }
          
          job.error = errorMessage;
          
          // Show error dialog to user
          dialog.showErrorBox(
            'Transcription Process Failed',
            `Failed to transcribe "${job.fileName}":\n\n${errorMessage}`
          );
          
          this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
        }
      });

    } catch (error) {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Show error dialog to user
      dialog.showErrorBox(
        'Transcription Error',
        `An unexpected error occurred while transcribing "${job.fileName}":\n\n${job.error}`
      );
      
      this.mainWindow?.webContents.send('transcription-error', this.serializeJob(job));
    }
  }
}

// Initialize the app
new App();
