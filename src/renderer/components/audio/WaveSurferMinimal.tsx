import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface Props {
  src: string; // file:// URL
}

const WaveSurferMinimal: React.FC<Props> = ({ src }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [status, setStatus] = useState<string>('Initializing…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setStatus('Creating player…');
    // Build a media element first to ensure file:// works reliably
    const audioEl = document.createElement('audio');
    audioEl.src = src; // already a file:// URL
    audioEl.preload = 'auto';
    audioEl.addEventListener('loadedmetadata', () => { console.log('[WS] media loadedmetadata'); setStatus('Metadata loaded'); setIsReady(true); });
    audioEl.addEventListener('canplay', () => { console.log('[WS] media canplay'); setStatus('Can play'); setIsReady(true); });
    audioEl.addEventListener('canplaythrough', () => { console.log('[WS] media canplaythrough'); setStatus('Can play through'); setIsReady(true); });
    audioEl.addEventListener('play', () => { console.log('[WS] media play'); setIsPlaying(true); });
    audioEl.addEventListener('pause', () => { console.log('[WS] media pause'); setIsPlaying(false); });
    audioEl.addEventListener('error', () => { 
      const err = (audioEl as any).error;
      console.error('[WS] media error', err);
      setError(err ? `MediaError code ${err.code}` : 'Media element error');
      setStatus('Media error');
    });

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#7dd3fc',
      progressColor: '#38bdf8',
      cursorColor: '#ffffff',
      height: 100,
      minPxPerSec: 50,
      backend: 'MediaElement',
      media: audioEl,
      partialRender: true,
      interact: true,
    });
    wsRef.current = ws;

    const onReady = () => { console.log('[WS] ready'); setIsReady(true); };
    const onPlay = () => { console.log('[WS] play'); setIsPlaying(true); };
    const onPause = () => { console.log('[WS] pause'); setIsPlaying(false); };
    ws.on('ready', onReady);
    ws.on('play', onPlay);
    ws.on('pause', onPause);
    ws.on('error', (e) => { console.error('[WaveSurfer] error:', e); setError(String(e)); setStatus('Error'); });
    ws.on('decode', () => console.log('[WS] decode'));
    ws.on('interaction', () => console.log('[WS] interaction'));

    setStatus('Loading…');

    // Try to load precomputed peaks from /peaks by swapping /media -> /peaks
    const peaksUrl = (() => {
      try {
        const u = new URL(src);
        if (u.pathname === '/media' && u.searchParams.get('src')) {
          u.pathname = '/peaks';
          return u.toString();
        }
      } catch {}
      return null;
    })();

    const loadWithPeaks = async () => {
      try {
        if (peaksUrl) {
          const resp = await fetch(peaksUrl);
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.peaks) && data.peaks.length > 0) {
              console.log('[WS] peaks loaded:', data.peaks.length);
              (ws as any).setMediaElement?.(audioEl);
              const duration = typeof data.durationSec === 'number' ? data.durationSec : undefined;
              ws.load(audioEl, data.peaks, duration);
              return;
            }
          }
        }
        // Fallback: no peaks
        (ws as any).setMediaElement?.(audioEl);
        ws.load(audioEl);
      } catch (e) {
        console.warn('peaks load failed, fallback to media only', e);
        try { ws.load(audioEl); } catch (err) { setError('Failed to load audio'); }
      }
    };

    loadWithPeaks();
    try {
      const el = (ws as any).getMediaElement?.();
      if (el) {
        el.addEventListener('loadedmetadata', () => { console.log('[WS] media loadedmetadata'); setIsReady(true); });
        el.addEventListener('canplay', () => { console.log('[WS] media canplay'); setIsReady(true); });
        el.addEventListener('canplaythrough', () => { console.log('[WS] media canplaythrough'); setIsReady(true); });
      }
    } catch {}

    return () => {
      try { ws.destroy(); } catch {}
      wsRef.current = null;
    };
  }, [src]);

  const togglePlay = () => {
    const ws = wsRef.current;
    if (!ws) return;
    const mediaEl = (ws as any).getMediaElement?.();
    if (mediaEl) {
      if (mediaEl.paused) {
        mediaEl.play().catch((e: any) => {
          console.error('[WS] media play() failed', e);
          setError('Play failed');
        });
      } else {
        try { mediaEl.pause(); } catch {}
      }
    } else {
      ws.playPause();
    }
  };

  const handleZoom = (value: number) => {
    setZoom(value);
    const pxPerSec = 50 + value * 50; // simple scale
    wsRef.current?.zoom(pxPerSec);
  };

  return (
    <div className="flex flex-col gap-2 w-full h-[50vh] bg-surface bg-opacity-70 backdrop-blur-md rounded-lg border border-glass-border-subtle p-3">
      <div className="flex items-center gap-3 text-sm text-white/80">
        <button
          className="px-2 py-1 rounded bg-white/20 hover:bg-white/30 border border-white/30"
          onClick={togglePlay}
        >
          {isPlaying ? 'Pause' : isReady ? 'Play' : 'Loading…'}
        </button>
        <span className="opacity-70 text-xs">{status}</span>
        {error && <span className="text-rose-300 text-xs">{error}</span>}
        <div className="flex items-center gap-2">
          <span className="opacity-70">Zoom</span>
          <input
            type="range"
            min={0}
            max={10}
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
          />
        </div>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
};

export default WaveSurferMinimal;
