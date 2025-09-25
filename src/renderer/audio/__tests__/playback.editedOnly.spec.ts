import { jest } from '@jest/globals';
import JuceAudioManager from '../../audio/JuceAudioManager';

declare global {
  // eslint-disable-next-line no-var
  var window: any;
}

function makeClipsReordered() {
  // Two speech clips with original times:
  // A: 2.88 - 12.48 (dur 9.6)
  // B: 13.44 - 23.27 (dur ~9.83)
  const now = Date.now();
  const mk = (id: string, speaker: string, start: number, end: number) => ({
    id,
    speaker,
    startTime: start,
    endTime: end,
    startWordIndex: 0,
    endWordIndex: 0,
    words: [],
    text: '',
    confidence: 1,
    type: 'transcribed' as const,
    duration: end - start,
    order: 0,
    createdAt: now,
    modifiedAt: now,
    status: 'active' as const,
  });
  const clipA = mk('clipA', 'S1', 2.88, 12.48);
  const clipB = mk('clipB', 'S2', 13.44, 23.27);
  // Reordered: B then A in edited sequence
  return [clipB, clipA];
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
    seek: async (_id: string, t: number) => { calls.push(['seek', t]); return { success: true }; },
    setRate: async () => ({ success: true }),
    setVolume: async () => ({ success: true }),
    queryState: async () => ({ success: true }),
    onEvent: (fn: any) => { cb = fn; },
    offEvent: () => { cb = null; },
  };
  return { emit: (evt: any) => cb && cb(evt), calls };
}

describe('JuceAudioManager edited-only transport', () => {
  test('queues seek until edlApplied, then seeks edited time', async () => {
    const { emit, calls } = setupTransportMock();
    const mgr = new (JuceAudioManager as any)({
      onStateChange: () => {},
      onError: () => {},
      onWordHighlight: () => {},
      onClipChange: () => {},
    });
    // Initialize with no audio path resolution (skip actual load validation)
    (mgr as any).state.isInitialized = true;
    const clips = makeClipsReordered();
    mgr.updateClips(clips);
    (mgr as any).state.playback.isReady = true;
    (mgr as any).state.playback.duration = clips.reduce((acc: number, clip: any) => acc + clip.duration, 0);
    // edlApplying set true; seek should be queued
    mgr.seekToEditedTime(5);
    expect(calls.find(c => c[0] === 'seek')).toBeUndefined();
    // Emit edlApplied
    emit({ type: 'edlApplied', id: 'default', revision: 1 });
    // Now queued seek should flush
    expect(calls.find(c => c[0] === 'seek')).toBeDefined();
  });

  test('seekToOriginalTime maps original to edited and calls edited seek', () => {
    const { emit, calls } = setupTransportMock();
    const mgr = new (JuceAudioManager as any)({ onStateChange: () => {}, onError: () => {}, onWordHighlight: () => {}, onClipChange: () => {} });
    (mgr as any).state.isInitialized = true;
    const clips = makeClipsReordered();
    mgr.updateClips(clips);
    (mgr as any).state.playback.isReady = true;
    (mgr as any).state.playback.duration = clips.reduce((acc: number, clip: any) => acc + clip.duration, 0);
    emit({ type: 'edlApplied', id: 'default', revision: 2 });
    // Click within original clipA at 6.0s; in reordered [B,A], B dur ~9.83, so edited target ≈ 9.83 + (6.0 - 2.88) = 12.95
    mgr.seekToOriginalTime(6.0);
    const seekCall = calls.find(c => c[0] === 'seek');
    expect(seekCall).toBeDefined();
    const editedSec = seekCall[1];
    expect(editedSec).toBeGreaterThan(12.9);
    expect(editedSec).toBeLessThan(13.1);
  });

  test('seekToEditedTime always issues edited seconds even when preferOriginalSeek is true', async () => {
    const { emit, calls } = setupTransportMock();
    const mgr = new (JuceAudioManager as any)({
      onStateChange: () => {},
      onError: () => {},
      onWordHighlight: () => {},
      onClipChange: () => {},
    });

    (mgr as any).state.isInitialized = true;
    const clips = makeClipsReordered();
    mgr.updateClips(clips);
    emit({ type: 'edlApplied', id: 'default', revision: 3 });

    (mgr as any).state.playback.isReady = true;
    (mgr as any).state.playback.duration = clips.reduce((acc: number, clip: any) => acc + clip.duration, 0);

    // Sanity check: sequencer maps edited time to a different original time when reordered
    const sequencer = (mgr as any).sequencer;
    const mapped = sequencer.editedTimeToOriginalTime(5);
    expect(mapped).toBeDefined();
    expect(mapped.originalTime).not.toBeCloseTo(5);

    expect((mgr as any).preferOriginalSeek).toBe(true);

    await mgr.seekToEditedTime(5);
    const seekCalls = calls.filter((c: any[]) => c[0] === 'seek');
    expect(seekCalls.length).toBeGreaterThan(0);
    const [, issuedSec] = seekCalls[seekCalls.length - 1];
    expect(issuedSec).toBeCloseTo(5, 5);
  });

  test('drops stale position events by revision', () => {
    const { emit } = setupTransportMock();
    let received: any = null;
    const mgr = new (JuceAudioManager as any)({
      onStateChange: (s: any) => { received = s.playback.currentTime; },
      onError: () => {}, onWordHighlight: () => {}, onClipChange: () => {}
    });
    (mgr as any).state.isInitialized = true;
    emit({ type: 'edlApplied', id: 'default', revision: 3 });
    // Stale rev=2 should be ignored
    emit({ type: 'position', id: 'default', editedSec: 99, originalSec: 99, revision: 2 });
    expect(received).not.toBe(99);
    // Current rev=3 accepted
    emit({ type: 'position', id: 'default', editedSec: 5, originalSec: 5, revision: 3 });
    expect(received).toBe(5);
  });
});

