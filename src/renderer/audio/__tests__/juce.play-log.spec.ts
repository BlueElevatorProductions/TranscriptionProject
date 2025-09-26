import { JuceAudioManagerV2 } from '../JuceAudioManagerV2';

const noop = () => undefined;

describe('JuceAudioManagerV2 play logging', () => {
  beforeEach(() => {
    const transportStub = {
      load: jest.fn().mockResolvedValue({ success: true }),
      updateEdl: jest.fn().mockResolvedValue({ success: true, revision: 1 }),
      play: jest.fn().mockResolvedValue({ success: true }),
      pause: jest.fn().mockResolvedValue({ success: true }),
      stop: jest.fn().mockResolvedValue({ success: true }),
      seek: jest.fn().mockResolvedValue({ success: true }),
      setRate: jest.fn().mockResolvedValue({ success: true }),
      setTimeStretch: jest.fn().mockResolvedValue({ success: true }),
      setVolume: jest.fn().mockResolvedValue({ success: true }),
      queryState: jest.fn().mockResolvedValue({ success: true }),
      dispose: jest.fn().mockResolvedValue({ success: true }),
      onEvent: jest.fn(),
      offEvent: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    Object.assign(window as any, { juceTransport: transportStub });
  });

  afterEach(() => {
    delete (window as any).juceTransport;
    jest.restoreAllMocks();
  });

  it('emits a [CMD] play log within 200ms when playback is triggered', async () => {
    const transport = (window as any).juceTransport;
    const consoleLogSpy = jest.spyOn(console, 'log');
    const capturedLogs: Array<{ message: string; time: number }> = [];
    consoleLogSpy.mockImplementation((message?: unknown) => {
      const text = typeof message === 'string' ? message : String(message);
      capturedLogs.push({ message: text, time: Date.now() });
      return noop();
    });

    const manager = new JuceAudioManagerV2({
      callbacks: {
        onStateChange: noop,
        onSegmentHighlight: noop,
        onError: noop,
      },
    });

    manager['updateState']({ isReady: true, readyStatus: 'ready' });
    manager['currentGenerationId'] = 5;
    manager['readyGenerationId'] = 5;
    manager['loadedGenerationId'] = 5;

    const clickTime = Date.now();
    await manager.play();

    const playLog = capturedLogs.find(entry => entry.message === '[CMD] play');
    expect(playLog).toBeDefined();
    expect(playLog && playLog.time - clickTime).toBeLessThanOrEqual(200);
    expect(transport.play).toHaveBeenCalledWith('audio-session', 5);
  });
});
