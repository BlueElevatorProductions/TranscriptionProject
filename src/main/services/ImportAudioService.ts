import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface PreparedAudioResult {
  originalPath: string | null;
  resolvedPath: string;
  metadata: WavMetadata;
  wasConverted: boolean;
}

export interface WavMetadata {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  durationSec: number;
}

const WAV_EXTENSION = '.wav';
const TARGET_SAMPLE_RATE = 48000;
const TARGET_CHANNELS = 2;
const ALLOWED_BIT_DEPTHS = new Set([16, 24, 32]);

export async function prepareAudioForImport(
  incomingPath: string | undefined,
  audioMetadata: any
): Promise<PreparedAudioResult> {
  const candidates = collectCandidates(incomingPath, audioMetadata);
  const probedDirs = Array.from(new Set(candidates.map(candidate => path.dirname(candidate))));

  const resolvedPath = candidates.find(candidate => fs.existsSync(candidate)) || null;
  if (!resolvedPath) {
    console.error('[Import][Error] NO SOURCE AUDIO FOUND', {
      projectData: {
        incomingPath,
        audioMetadata,
      },
      probedDirs,
    });
    throw new Error('NO SOURCE AUDIO FOUND');
  }

  const originalPath = resolvedPath;

  let finalPath = resolvedPath;
  let wasConverted = false;

  let inspection = inspectWavHeaderSafe(resolvedPath);
  if (!inspection || !isTargetWav(inspection)) {
    const convertedPath = await convertToTargetWav(resolvedPath);
    wasConverted = true;
    console.log('[Import][Audio] converted', {
      originalPath: resolvedPath,
      convertedPath,
    });
    inspection = inspectWavHeaderSafe(convertedPath);
    if (!inspection) {
      console.error('[Import][Error] Audio validation failed', {
        originalPath,
        resolvedPath: convertedPath,
        reason: 'Converted file is not a valid WAV',
      });
      throw new Error('Audio validation failed');
    }
    if (!isTargetWav(inspection)) {
      console.error('[Import][Error] Audio validation failed', {
        originalPath,
        resolvedPath: convertedPath,
        reason: `Converted WAV does not meet 48kHz stereo requirements (rate=${inspection.sampleRate}, channels=${inspection.channels}, bitDepth=${inspection.bitDepth})`,
      });
      throw new Error('Audio validation failed');
    }
    finalPath = convertedPath;
  }

  console.log('[Import][Audio] resolved', {
    originalPath,
    resolvedPath: finalPath,
    exists: fs.existsSync(finalPath),
    sampleRate: inspection.sampleRate,
    channels: inspection.channels,
    bitDepth: inspection.bitDepth,
    durationSec: Number(inspection.durationSec.toFixed(3)),
  });

  return {
    originalPath,
    resolvedPath: finalPath,
    metadata: inspection,
    wasConverted,
  };
}

function collectCandidates(incomingPath: string | undefined, audioMetadata: any): string[] {
  const candidates: string[] = [];
  const possibleFields = [
    incomingPath,
    audioMetadata?.audioPath,
    audioMetadata?.originalPath,
    audioMetadata?.path,
    audioMetadata?.embeddedPath,
    audioMetadata?.fileName,
  ];

  const baseDirs = [
    process.cwd(),
    '/Users/chrismcleod/Development/ClaudeAccess/Working Audio',
    '/Users/chrismcleod/Development/ChatAppAccess/Working Audio',
    '/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject',
    '/Users/chrismcleod/Development/ClaudeAccess/ClaudeTranscriptionProject/audio',
  ];

  possibleFields.forEach(field => {
    if (!field || typeof field !== 'string') {
      return;
    }

    if (field.startsWith('file://')) {
      const filePath = new URL(field).pathname;
      candidates.push(path.normalize(filePath));
      return;
    }

    if (path.isAbsolute(field)) {
      candidates.push(path.normalize(field));
      return;
    }

    const relative = field.replace(/^\.\//, '').replace(/^Audio Files[\/\\]/i, '');
    baseDirs.forEach(dir => {
      candidates.push(path.normalize(path.join(dir, relative)));
    });
  });

  return Array.from(new Set(candidates));
}

function inspectWavHeaderSafe(filePath: string): WavMetadata | null {
  try {
    return inspectWavHeader(filePath);
  } catch (error) {
    return null;
  }
}

function inspectWavHeader(filePath: string): WavMetadata {
  const fd = fs.openSync(filePath, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const riffHeader = Buffer.alloc(12);
    fs.readSync(fd, riffHeader, 0, 12, 0);
    if (riffHeader.toString('ascii', 0, 4) !== 'RIFF' || riffHeader.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Not a WAV file');
    }

    let offset = 12;
    let fmtChunk: { sampleRate: number; channels: number; bitsPerSample: number; byteRate: number } | null = null;
    let dataSize: number | null = null;

    while (offset + 8 <= stat.size) {
      const chunkHeader = Buffer.alloc(8);
      fs.readSync(fd, chunkHeader, 0, 8, offset);
      const chunkId = chunkHeader.toString('ascii', 0, 4);
      const chunkSize = chunkHeader.readUInt32LE(4);
      offset += 8;

      if (chunkId === 'fmt ') {
        const fmtBuffer = Buffer.alloc(chunkSize);
        fs.readSync(fd, fmtBuffer, 0, chunkSize, offset);
        const audioFormat = fmtBuffer.readUInt16LE(0);
        if (audioFormat !== 1 && audioFormat !== 3) {
          throw new Error(`Unsupported WAV format: ${audioFormat}`);
        }
        const channels = fmtBuffer.readUInt16LE(2);
        const sampleRate = fmtBuffer.readUInt32LE(4);
        const byteRate = fmtBuffer.readUInt32LE(8);
        const bitsPerSample = fmtBuffer.readUInt16LE(14);
        fmtChunk = { sampleRate, channels, bitsPerSample, byteRate };
      } else if (chunkId === 'data') {
        dataSize = chunkSize;
        break;
      }

      offset += chunkSize + (chunkSize % 2);
    }

    if (!fmtChunk || dataSize === null) {
      throw new Error('Incomplete WAV header');
    }

    const bytesPerSample = fmtChunk.bitsPerSample / 8;
    const duration = dataSize / (fmtChunk.sampleRate * fmtChunk.channels * bytesPerSample);

    return {
      sampleRate: fmtChunk.sampleRate,
      channels: fmtChunk.channels,
      bitDepth: fmtChunk.bitsPerSample,
      durationSec: duration,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function isTargetWav(metadata: WavMetadata): boolean {
  return (
    metadata.sampleRate === TARGET_SAMPLE_RATE &&
    metadata.channels === TARGET_CHANNELS &&
    ALLOWED_BIT_DEPTHS.has(metadata.bitDepth)
  );
}

async function convertToTargetWav(sourcePath: string): Promise<string> {
  const directory = path.dirname(sourcePath);
  const baseName = path.parse(sourcePath).name;
  const targetPath = path.join(directory, `${baseName}_48000hz${WAV_EXTENSION}`);

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', sourcePath,
      '-ar', TARGET_SAMPLE_RATE.toString(),
      '-ac', TARGET_CHANNELS.toString(),
      '-sample_fmt', 's16',
      '-y',
      targetPath,
    ]);

    ffmpeg.stderr.on('data', () => {
      // consume stderr to avoid buffer overflow
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });

  if (!fs.existsSync(targetPath)) {
    throw new Error('Converted WAV was not created');
  }

  return targetPath;
}
