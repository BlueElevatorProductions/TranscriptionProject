import { jest } from '@jest/globals';
import JuceAudioManager from '../../audio/JuceAudioManager';
import type { Clip } from '../../types';

declare global { var window: any; }

function mkClip(id: string, start: number, end: number): Clip {
  const now = Date.now();
  return {
    id,
    speaker: 'S',
    startTime: start,
    endTime: end,
    startWordIndex: 0,
    endWordIndex: 0,
    words: [{ start, end, word: id }],
    type: 'transcribed' as const,
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
  (global as any).window = (global as any).window || {};
  (global as any).window.juceTransport = {
    load: async () => ({ success: true }),
    updateEdl: async (_id: string, revision: number) => ({ success: true, revision }),
    play: async () => ({ success: true }),
    pause: async () => ({ success: true }),
    stop: async () => ({ success: true }),
    seek: async () => ({ success: true }),
    setRate: async () => ({ success: true }),
    setVolume: async () => ({ success: true }),
    queryState: async () => ({ success: true }),
    onEvent: (fn: any) => { cb = fn; },
    offEvent: () => { cb = null; },
  };
  return { emit: (evt: any) => cb && cb(evt) };
}

describe('Sequencer stays aligned with active timeline', () => {
  test('delete and restore clip update sequencer to match active clips', () => {
    const { emit } = setupTransportMock();
    const mgr = new (JuceAudioManager as any)({ onStateChange: () => {}, onError: () => {}, onWordHighlight: () => {}, onClipChange: () => {} });
    (mgr as any).state.isInitialized = true;
    (mgr as any).state.playback.isReady = true;

    const clips = [mkClip('A', 0, 1), mkClip('B', 1, 2), mkClip('C', 2, 3)];
    mgr.updateClips(clips);
    emit({ type: 'edlApplied', id: 'default', revision: 1 });

    // Delete middle clip B
    mgr.deleteClip('B');
    const orderAfterDelete = (mgr as any).sequencer.getReorderedClips().map((c: Clip) => c.id);
    expect(orderAfterDelete).toEqual(['A', 'C']);

    // Restore B
    mgr.restoreClip('B');
    const orderAfterRestore = (mgr as any).sequencer.getReorderedClips().map((c: Clip) => c.id);
    expect(orderAfterRestore).toEqual(['A', 'B', 'C']);
  });
});

