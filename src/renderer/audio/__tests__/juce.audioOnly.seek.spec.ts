import { jest } from '@jest/globals';
import JuceAudioManager from '../../audio/JuceAudioManager';
import type { Clip } from '../../types';

declare global { var window: any; }

function mkClip(id: string, start: number, end: number, type: Clip['type'] = 'transcribed'): Clip {
  const now = Date.now();
  return {
    id,
    speaker: 'S',
    startTime: start,
    endTime: end,
    startWordIndex: 0,
    endWordIndex: 0,
    words: type === 'audio-only' ? [] : [{ start, end, word: id }],
    type,
    text: id,
    duration: end - start,
    order: 0,
    createdAt: now,
    modifiedAt: now,
    status: 'active' as const,
  } as any;
}

function setupTransportMock() {
  let cb: any = null;
  const calls: any[] = [];
  (global as any).window = (global as any).window || {};
  (global as any).window.juceTransport = {
    load: async () => ({ success: true }),
    updateEdl: async () => ({ success: true }),
    play: async () => ({ success: true }),
    pause: async () => ({ success: true }),
    stop: async () => ({ success: true }),
    seek: async (_id: string, t: number) => { calls.push(['seek', t]); return { success: true }; },
    setRate: async () => ({ success: true }),
    setVolume: async () => ({ success: true }),
    queryState: async () => ({ success: true }),
    onEvent: (fn: any) => { cb = fn; },
    offEvent: () => { cb = null; },
  };
  return { emit: (evt: any) => cb && cb(evt), calls };
}

describe('Audio-only seek mapping', () => {
  test('seekToOriginalTime maps into audio-only clip correctly', () => {
    const { emit, calls } = setupTransportMock();
    const mgr = new (JuceAudioManager as any)({ onStateChange: () => {}, onError: () => {}, onWordHighlight: () => {}, onClipChange: () => {} });
    (mgr as any).state.isInitialized = true;
    (mgr as any).state.playback.isReady = true;

    // Build clips: A (0-1) | GAP (1-3, audio-only) | B (3-4); edited order is [A, GAP, B]
    const A = mkClip('A', 0, 1, 'transcribed');
    const GAP = mkClip('G', 1, 3, 'audio-only');
    const B = mkClip('B', 3, 4, 'transcribed');
    mgr.updateClips([A, GAP, B]);
    emit({ type: 'edlApplied', id: 'default', revision: 1 });

    // Seek into the middle of GAP at original 2.0s; edited time should be ~1.0 + (2.0 - 1.0) = 2.0
    mgr.seekToOriginalTime(2.0);
    const seekCall = calls.find((c) => c[0] === 'seek');
    expect(seekCall).toBeDefined();
    const editedT = seekCall![1];
    expect(editedT).toBeGreaterThan(1.9);
    expect(editedT).toBeLessThan(2.1);
  });
});

