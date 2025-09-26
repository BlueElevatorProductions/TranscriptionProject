import * as React from "react";
import * as Slider from "@radix-ui/react-slider";
import { Play, Pause, SkipBack, SkipForward, Volume2, X } from "lucide-react";

/**
 * GlassAudioPlayer
 * - Minimal, translucent bottom bar with frosted glass effect
 * - Integrates with existing audio state and clip system
 * - Provides word-level seeking and clip navigation
 */
export interface GlassAudioPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume?: number;
  onPlayPause: () => void;
  onSeek: (t: number) => void;
  onSkipToClipStart: () => void;
  onSkipToClipEnd: () => void;
  onVolume?: (v: number) => void;
  speed?: number;
  onSpeedChange?: (s: number) => void;
  onClose?: () => void;
  isVisible?: boolean;
  fileName?: string;
  isTransportReady?: boolean;
  readyStatus?: 'idle' | 'loading' | 'waiting-edl' | 'ready' | 'fallback';
}

export function GlassAudioPlayer({
  isPlaying,
  currentTime,
  duration,
  volume = 1,
  onPlayPause,
  onSeek,
  onSkipToClipStart,
  onSkipToClipEnd,
  onVolume,
  speed = 1,
  onSpeedChange,
  onClose,
  isVisible = false,
  fileName = "Audio",
  isTransportReady = true,
  readyStatus = 'ready'
}: GlassAudioPlayerProps) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const statusMessages: Record<NonNullable<GlassAudioPlayerProps['readyStatus']>, string> = {
    idle: 'Preparing audio…',
    loading: 'Loading audio…',
    'waiting-edl': 'Syncing playback engine…',
    ready: '',
    fallback: '⚠️ Playback enabled after sync timeout'
  };
  const showOverlay = !isTransportReady && (readyStatus === 'idle' || readyStatus === 'loading' || readyStatus === 'waiting-edl');
  const overlayMessage = statusMessages[readyStatus] || 'Preparing audio…';
  const showFallbackBanner = readyStatus === 'fallback';
  const controlsDisabledClass = !isTransportReady ? 'opacity-50 cursor-not-allowed' : '';

  // Format time helper
  const fmt = (t: number) => {
    if (!Number.isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.offsetHeight || 0;
      document.documentElement.style.setProperty('--player-height', `${h}px`);
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => ro.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={wrapperRef}
      className={[
        // Positioning - fixed at bottom of window with slide animation
        "fixed bottom-0 left-0 right-0 z-50",
        "transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full",
        // Container padding to give some space from edges
        "p-4"
      ].join(" ")}
    >
      <div
        className={[
          // Layout & spacing
          "relative w-full max-w-6xl mx-auto",
          "flex items-center gap-3 px-6 py-4",
          "rounded-[var(--radius-lg)]",
          // Glass styling - transparent glass effect
          "backdrop-blur-md border",
          "bg-[hsl(var(--surface)_/_var(--opacity-glass-medium))] border-[hsl(var(--glass-border-subtle))]",
          // Subtle elevation
          "shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
        ].join(" ")}
        role="region"
        aria-label="Audio player"
        aria-busy={!isTransportReady}
      >
        {showFallbackBanner && (
          <div className="absolute top-3 right-4 text-xs font-medium px-3 py-1 rounded-full bg-amber-500/20 text-amber-100 border border-amber-400/50">
            {statusMessages.fallback}
          </div>
        )}

        {showOverlay && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-black/45 text-white">
            <div className="size-6 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium" aria-live="polite">{overlayMessage}</p>
            <p className="text-xs text-white/70">{fileName}</p>
          </div>
        )}

        {/* Transport Controls */}
        <div className="flex items-center gap-1">
          <button
            aria-label="Skip to clip start"
            onClick={onSkipToClipStart}
            className={`p-2 rounded-md transition-colors ${controlsDisabledClass} ${isTransportReady ? 'hover:bg-[hsl(var(--glass-hover))]' : ''}`}
            disabled={!isTransportReady}
          >
            <SkipBack className="w-5 h-5" style={{color: 'hsl(var(--glass-text))'}} />
          </button>
          <button
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={onPlayPause}
            className={`p-2.5 rounded-md transition-colors ${controlsDisabledClass} ${isTransportReady ? 'hover:bg-[hsl(var(--glass-hover))]' : ''}`}
            disabled={!isTransportReady}
          >
            {isPlaying ? <Pause className="w-5 h-5" style={{color: 'hsl(var(--glass-text))'}} /> : <Play className="w-5 h-5" style={{color: 'hsl(var(--glass-text))'}} />}
          </button>
          <button
            aria-label="Skip to clip end"
            onClick={onSkipToClipEnd}
            className={`p-2 rounded-md transition-colors ${controlsDisabledClass} ${isTransportReady ? 'hover:bg-[hsl(var(--glass-hover))]' : ''}`}
            disabled={!isTransportReady}
          >
            <SkipForward className="w-5 h-5" style={{color: 'hsl(var(--glass-text))'}} />
          </button>
        </div>

        {/* Timeline */}
        <time className="tabular-nums text-xs min-w-[45px] text-right" style={{color: 'hsl(var(--glass-text))'}}>
          {fmt(currentTime)}
        </time>
        <div className="flex-1">
          <Slider.Root
            value={[pct]}
            max={100}
            step={0.1}
            onValueChange={(v) => onSeek(((v?.[0] ?? 0) / 100) * duration)}
            className="relative flex h-8 items-center select-none cursor-pointer"
            aria-label="Seek"
            disabled={!isTransportReady}
          >
            <Slider.Track className="relative h-1 grow rounded-full bg-[hsl(var(--glass-track))]">
              <Slider.Range className="absolute h-1 rounded-full bg-[hsl(var(--accent))]" />
            </Slider.Track>
            <Slider.Thumb className="block size-3 rounded-full bg-[hsl(var(--accent))] outline-none focus:ring-2 focus:ring-[hsl(var(--accent))]/40 cursor-grab active:cursor-grabbing" />
          </Slider.Root>
        </div>
        <time className="tabular-nums text-xs min-w-[45px]" style={{color: 'hsl(var(--glass-text))'}}>
          {fmt(duration)}
        </time>

        {/* Speed Control */}
        <select
          value={String(speed)}
          onChange={(e) => onSpeedChange?.(Number(e.target.value))}
          className="ml-2 rounded-md bg-transparent border border-[hsl(var(--glass-border))] px-2 py-1 text-xs hover:bg-[hsl(var(--glass-hover))] transition-colors cursor-pointer"
          style={{color: 'hsl(var(--glass-text))'}}
          aria-label="Playback speed"
          disabled={!isTransportReady}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
            <option key={s} value={s} className="bg-white text-black">
              {s}×
            </option>
          ))}
        </select>

        {/* Volume Control */}
        <div className="flex items-center gap-2 min-w-[120px] ml-2">
          <Volume2 className="w-4 h-4" style={{color: 'hsl(var(--glass-text))'}} />
          <Slider.Root
            value={[Math.round((volume ?? 1) * 100)]}
            max={100}
            step={1}
            onValueChange={(v) => onVolume?.((v?.[0] ?? 0) / 100)}
            className="relative flex h-8 items-center w-[80px] select-none cursor-pointer"
            aria-label="Volume"
            disabled={!isTransportReady}
          >
            <Slider.Track className="relative h-1 grow rounded-full bg-[hsl(var(--glass-track))]">
              <Slider.Range className="absolute h-1 rounded-full bg-[hsl(var(--accent))]" />
            </Slider.Track>
            <Slider.Thumb className="block size-2.5 rounded-full bg-[hsl(var(--accent))] outline-none cursor-grab active:cursor-grabbing" />
          </Slider.Root>
        </div>

        {/* Close button */}
        {onClose && (
          <button
            aria-label="Close player"
            onClick={onClose}
            className="ml-2 p-2 rounded-md hover:bg-[hsl(var(--glass-hover))] transition-colors"
          >
            <X className="w-4 h-4" style={{color: 'hsl(var(--glass-text))'}} />
          </button>
        )}
      </div>
    </div>
  );
}
