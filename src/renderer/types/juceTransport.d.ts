import type { JuceEvent, EdlClip } from '../../shared/types/transport';

declare global {
  interface Window {
    juceTransport: {
      load: (id: string, path: string) => Promise<{ success: boolean; error?: string }>;
      updateEdl: (id: string, clips: EdlClip[]) => Promise<{ success: boolean; error?: string }>;
      play: (id: string) => Promise<{ success: boolean; error?: string }>;
      pause: (id: string) => Promise<{ success: boolean; error?: string }>;
      stop: (id: string) => Promise<{ success: boolean; error?: string }>;
      seek: (id: string, timeSec: number) => Promise<{ success: boolean; error?: string }>;
      setRate: (id: string, rate: number) => Promise<{ success: boolean; error?: string }>;
      setVolume: (id: string, value: number) => Promise<{ success: boolean; error?: string }>;
      queryState: (id: string) => Promise<{ success: boolean; error?: string }>;
      dispose: () => Promise<{ success: boolean; error?: string }>;
      onEvent: (cb: (evt: JuceEvent) => void) => void;
      offEvent: (cb: (evt: JuceEvent) => void) => void;
      removeAllListeners: () => void;
    };
  }
}

export {};

