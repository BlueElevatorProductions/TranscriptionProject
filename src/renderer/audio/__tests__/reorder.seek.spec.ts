import { jest } from '@jest/globals';
import JuceAudioManager from '../../audio/JuceAudioManager';

declare global {
  // eslint-disable-next-line no-var
  var window: any;
}

function makeClips() {
  const now = Date.now();
  const mk = (id: string, start: number, end: number) => ({
    id,
    speaker: 'S',
    startTime: start,
    endTime: end,
    startWordIndex: 0,
    endWordIndex: 0,
    words: [{ start, end, word: id }],
    text: '',
    confidence: 1,
    type: 'transcribed' as const,
    duration: end - start,
    order: 0,
    createdAt: now,
    modifiedAt: now,
    status: 'active' as const,
  });
  const clipA = mk('clipA', 0, 1);
  const clipB = mk('clipB', 1, 2);
  return [clipA, clipB];
}

function setupTransportMock() {
  let cb: any = null;
  const calls: any[] = [];
  (global as any).window = (global as any).window || {};
  (global as any).window.juceTransport = {
    load: async () => ({ success: true }),
    updateEdl: async (_id: string, revision: number) => ({ success: true, revision }),
    play: async () => ({ success: true }),
    pause: async () => ({ success: true }),
    stop: async () => ({ success: true }),
    seek: async (_id: string, t: number) => {
      calls.push(['seek', t]);
      return { success: true };
    },
    setRate: async () => ({ success: true }),
    setVolume: async () => ({ success: true }),
    queryState: async () => ({ success: true }),
    onEvent: (fn: any) => { cb = fn; },
    offEvent: () => { cb = null; },
  };
  return { emit: (evt: any) => cb && cb(evt), calls };
}

describe('clip reordering seek behaviour', () => {
  test('clicking a word after reordering seeks into the correct clip position', () => {
    const { emit, calls } = setupTransportMock();
    const mgr = new (JuceAudioManager as any)({
      onStateChange: () => {},
      onError: () => {},
      onWordHighlight: () => {},
      onClipChange: () => {},
    });

    // Bypass full initialization but mark audio ready
    (mgr as any).state.isInitialized = true;
    (mgr as any).state.playback.isReady = true;

    const clips = makeClips(); // [A,B]
    mgr.updateClips(clips);
    emit({ type: 'edlApplied', id: 'default', revision: 1 });

    // Move clipB before clipA
    mgr.reorderClips(1, 0);
    emit({ type: 'edlApplied', id: 'default', revision: 2 });

    // Seek to the word in clipA (which is now second in sequence)
    mgr.seekToWord('clipA', 0);

    const seekCall = calls.filter(c => c[0] === 'seek').pop();
    expect(seekCall).toBeDefined();
    // After reordering, clipA should start at t=1 (duration of clipB)
    expect(seekCall[1]).toBeCloseTo(1, 5);
  });
});

