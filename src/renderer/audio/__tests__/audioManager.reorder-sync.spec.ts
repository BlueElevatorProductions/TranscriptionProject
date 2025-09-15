import { jest } from '@jest/globals';
import { AudioManager } from '../AudioManager';
import { SimpleClipSequencer } from '../SimpleClipSequencer';
import type { Clip, Word } from '../../types';

declare global {
  // eslint-disable-next-line no-var
  var Audio: any;
}

class MockAudioElement {
  public preload: string = 'auto';
  public src: string = '';
  public currentTime: number = 0;
  public readyState: number = 0;
  public paused: boolean = true;
  public volume: number = 1;
  public playbackRate: number = 1;
  private listeners: Record<string, Array<(event?: any) => void>> = {};

  addEventListener(event: string, handler: (event?: any) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  removeEventListener(event: string, handler: (event?: any) => void): void {
    this.listeners[event] = (this.listeners[event] || []).filter((h) => h !== handler);
  }

  load(): void {}

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  dispatch(event: string, payload?: any): void {
    (this.listeners[event] || []).forEach((handler) => handler(payload));
  }
}

const createWord = (start: number, end: number, label: string): Word => ({
  start,
  end,
  word: label,
  score: 1,
});

const createClip = (id: string, start: number, duration: number): Clip => {
  const end = start + duration;
  return {
    id,
    speaker: 'S',
    startTime: start,
    endTime: end,
    startWordIndex: 0,
    endWordIndex: 0,
    words: [createWord(start, end, `${id}-word`)],
    type: 'transcribed',
    text: id,
    duration,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    order: 0,
    status: 'active',
  };
};

describe('AudioManager clip reordering synchronisation', () => {
  beforeAll(() => {
    global.Audio = jest.fn(() => new MockAudioElement());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createManager = () =>
    new AudioManager({
      onStateChange: () => {},
      onError: () => {},
      onWordHighlight: () => {},
      onClipChange: () => {},
    });

  test('updateClips keeps sequencer input order and sequential indices', () => {
    const sequencerSpy = jest.spyOn(SimpleClipSequencer.prototype, 'updateClips');
    const manager = createManager();
    const clips = [
      createClip('clip-A', 0, 2),
      createClip('clip-B', 2, 3),
      createClip('clip-C', 5, 4),
    ];

    manager.updateClips(clips);

    expect(sequencerSpy).toHaveBeenCalledWith(clips);

    const state = manager.getState();
    expect(state.timeline.clips).toBe(clips);
    expect(state.timeline.reorderIndices).toEqual([0, 1, 2]);
    expect(state.timeline.totalDuration).toBeCloseTo(9, 5);

    const sequencerOrder = (manager as any).sequencer.getReorderedClips().map((clip: Clip) => clip.id);
    const timelineOrder = state.timeline.reorderIndices
      .map((idx) => state.timeline.clips[idx])
      .filter((clip) => clip && state.timeline.activeClipIds.has(clip.id))
      .map((clip) => clip.id);
    expect(sequencerOrder).toEqual(timelineOrder);
  });

  test('reorderClips keeps playback and EDL order synchronised', () => {
    const manager = createManager();
    const clips = [
      createClip('clip-1', 0, 1),
      createClip('clip-2', 1, 1.5),
      createClip('clip-3', 2.5, 0.5),
    ];

    manager.updateClips(clips);

    // Simulate drag-and-drop moving the last clip to the front
    manager.reorderClips(2, 0);

    const state = manager.getState();
    expect(state.timeline.reorderIndices).toEqual([2, 0, 1]);

    const timelineOrder = state.timeline.reorderIndices
      .map((idx) => state.timeline.clips[idx])
      .filter((clip) => clip && state.timeline.activeClipIds.has(clip.id))
      .map((clip) => clip.id);
    const sequencerOrder = (manager as any).sequencer.getReorderedClips().map((clip: Clip) => clip.id);

    expect(sequencerOrder).toEqual(['clip-3', 'clip-1', 'clip-2']);
    expect(timelineOrder).toEqual(sequencerOrder);

    const expectedDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
    expect(state.timeline.totalDuration).toBeCloseTo(expectedDuration, 5);
  });
});

