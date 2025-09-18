import { jest } from '@jest/globals';
import JuceAudioManager from '../../audio/JuceAudioManager';
import type { Clip } from '../../types';

declare global {
  // eslint-disable-next-line no-var
  var window: any;
}

function mkClip(id: string, start: number, end: number, type: Clip['type'] = 'transcribed'): Clip {
  const now = Date.now();
  return {
    id,
    speaker: 'S',
    startTime: start,
    endTime: end,
    startWordIndex: 0,
    endWordIndex: 0,
    words: [{ start, end, word: id }],
    type,
    text: id,
    duration: end - start,
    order: 0,
    createdAt: now,
    modifiedAt: now,
    status: 'active',
  } as any;
}

function setupTransportMock() {
  let cb: any = null;
  const calls: any[] = [];
  (global as any).window = (global as any).window || {};
  (global as any).window.juceTransport = {
    load: async () => ({ success: true }),
    updateEdl: async (_id: string, edl: any[]) => { calls.push(['edl', edl]); return { success: true }; },
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

describe('JUCE text-only deletions', () => {
  test('deleting words does not change duration and EDL has no per-word deletions', () => {
    const { emit, calls } = setupTransportMock();
    const mgr = new (JuceAudioManager as any)({ onStateChange: () => {}, onError: () => {}, onWordHighlight: () => {}, onClipChange: () => {} });

    // Initialize lightweight state
    (mgr as any).state.isInitialized = true;
    (mgr as any).state.playback.isReady = true;

    const clips = [mkClip('A', 0, 2), mkClip('B', 2, 5)];
    mgr.updateClips(clips);
    emit({ type: 'edlApplied', id: 'default', revision: 1 });

    const before = (mgr as any).state.timeline.totalDuration;

    // Delete the only word in clip B
    const wordId = `${clips[1].id}-word-0`;
    mgr.deleteWords([wordId]);
    emit({ type: 'edlApplied', id: 'default', revision: 2 });

    // Duration unchanged
    const after = (mgr as any).state.timeline.totalDuration;
    expect(after).toBeCloseTo(before, 5);

    // Last EDL sent should not include a "deleted" field on segments
    const edlCall = calls.filter((c) => c[0] === 'edl').pop();
    expect(edlCall).toBeDefined();
    const edl = edlCall[1] as any[];
    expect(Array.isArray(edl)).toBe(true);
    for (const seg of edl) {
      expect('deleted' in seg).toBe(false);
    }
  });
});

