import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';

type PeaksData = {
  samplesPerPixel: number;
  channels: number;
  sampleRate: number;
  durationSec: number;
  peaks: number[]; // [min,max,min,max,...]
};

function resolveFilePathFromSrc(src: string | undefined): string | null {
  if (!src) return null;
  try {
    if (src.startsWith('file://')) {
      const u = new URL(src);
      return decodeURIComponent(u.pathname);
    }
    if (src.startsWith('/')) return src; // absolute path
  } catch {}
  return null;
}

export default function JuceEditorWindow({ src, peaksPort }: { src?: string; peaksPort?: string }) {
  const [active, setActive] = useState<boolean>(document.hasFocus());
  const [editedSec, setEditedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<PeaksData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionId = 'default'; // Use same session as main window to avoid conflicts

  const filePath = useMemo(() => resolveFilePathFromSrc(src), [src]);

  // Query JUCE state on mount (don't load audio since main session already has it loaded)
  useEffect(() => {
    const queryInitialState = async () => {
      if (!filePath) {
        console.log('JuceEditorWindow: No filePath provided');
        return;
      }
      try {
        console.log(`JuceEditorWindow: Querying state for existing JUCE session "${sessionId}"`);
        // Just query the existing session state instead of loading new audio
        await window.juceTransport.queryState(sessionId);
      } catch (error) {
        console.error('JuceEditorWindow: Error querying JUCE state:', error);
      }
    };
    
    queryInitialState();
    
    // No cleanup needed since we're not controlling the main session
  }, [filePath, sessionId]);

  // Subscribe to JUCE events
  useEffect(() => {
    let lastPositionUpdate = 0;
    
    const handler = (evt: any) => {
      if (!evt || evt.id !== sessionId) return;
      
      // Only log non-position events to reduce spam
      if (evt.type !== 'position') {
        console.log('JuceEditorWindow: JUCE event received:', evt);
      }
      
      switch (evt.type) {
        case 'loaded':
          console.log(`JuceEditorWindow: Audio loaded, duration: ${evt.durationSec}s`);
          setDurationSec(evt.durationSec || 0);
          break;
        case 'state':
          console.log(`JuceEditorWindow: State change - playing: ${evt.playing}`);
          setPlaying(!!evt.playing);
          break;
        case 'position':
          // Throttle position updates to prevent excessive re-renders
          const now = Date.now();
          if (now - lastPositionUpdate >= 50) { // Max 20 FPS
            setEditedSec(evt.editedSec || 0);
            lastPositionUpdate = now;
          }
          break;
        case 'ended':
          console.log('JuceEditorWindow: Playback ended');
          setPlaying(false);
          setEditedSec(durationSec);
          break;
        case 'error':
          console.error('JuceEditorWindow: JUCE error:', evt.message);
          break;
      }
    };
    
    if (!window.juceTransport) {
      console.error('JuceEditorWindow: juceTransport not available on window object');
      return;
    }
    
    window.juceTransport.onEvent(handler);
    // Ask for current state
    window.juceTransport.queryState(sessionId);
    return () => window.juceTransport.offEvent(handler);
  }, [sessionId, durationSec]);

  // Focus-based ownership
  useEffect(() => {
    const onFocus = () => setActive(true);
    const onBlur = () => setActive(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Fetch peaks for rendering
  useEffect(() => {
    const fetchPeaks = async () => {
      try {
        const fp = filePath;
        if (!fp || !peaksPort) {
          console.log('JuceEditorWindow: Missing filePath or peaksPort', { filePath: fp, peaksPort });
          return;
        }
        // Use the peaks server with the correct port for waveform data
        const url = `http://127.0.0.1:${peaksPort}/peaks?src=${encodeURIComponent(fp)}&samplesPerPixel=1024`;
        console.log('JuceEditorWindow: Fetching peaks from:', url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`peaks ${res.status}`);
        const json = (await res.json()) as PeaksData;
        console.log('JuceEditorWindow: Got peaks data:', { duration: json.durationSec, peaksLength: json.peaks.length });
        setPeaks(json);
        if (!durationSec && json.durationSec) setDurationSec(json.durationSec);
      } catch (e) {
        console.error('JuceEditorWindow: Failed to fetch peaks:', e);
      }
    };
    fetchPeaks();
  }, [filePath, peaksPort, durationSec]);

  // Draw waveform
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !peaks) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const data = peaks.peaks;
    const len = data.length / 2; // min/max pairs
    const step = Math.max(1, Math.floor(len / w));
    for (let x = 0, i = 0; x < w && i < len; x++, i += step) {
      const min = data[i * 2] || 0;
      const max = data[i * 2 + 1] || 0;
      const y1 = Math.round(((1 - max) * 0.5) * h);
      const y2 = Math.round(((1 - min) * 0.5) * h);
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
    // Playhead
    if (durationSec > 0) {
      const px = Math.min(w - 1, Math.max(0, Math.round((editedSec / durationSec) * w)));
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(px, 0, 1, h);
    }
  }, [peaks, editedSec, durationSec]);

  const toggle = useCallback(async () => {
    if (!active) {
      console.log('JuceEditorWindow: Ignoring play/pause - window not active');
      return; // only active window sends commands
    }
    try {
      console.log(`JuceEditorWindow: ${playing ? 'Pausing' : 'Playing'} audio`);
      if (playing) await window.juceTransport.pause(sessionId);
      else await window.juceTransport.play(sessionId);
    } catch (error) {
      console.error('JuceEditorWindow: Error toggling playback:', error);
    }
  }, [playing, sessionId, active]);

  const onSeek = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!active || durationSec <= 0) {
      console.log('JuceEditorWindow: Ignoring seek - window not active or no duration');
      return;
    }
    try {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = (x / rect.width) * durationSec;
      console.log(`JuceEditorWindow: Seeking to ${t.toFixed(2)}s`);
      await window.juceTransport.seek(sessionId, t);
    } catch (error) {
      console.error('JuceEditorWindow: Error seeking:', error);
    }
  }, [active, durationSec, sessionId]);

  return (
    <div style={{ padding: 12, color: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {filePath ? `File: ${filePath}` : 'No file'}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{active ? 'Active control' : 'Passive'}</div>
      </div>
      {/* Debug info */}
      <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 8 }}>
        Debug: peaks={peaks ? `${peaks.peaks.length} points` : 'null'}, 
        duration={durationSec}s, 
        position={editedSec}s, 
        session=shared-with-main,
        peaksPort={peaksPort || 'missing'}
      </div>
      <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
        <canvas ref={canvasRef} width={900} height={160} onClick={onSeek} style={{ width: '100%', height: 160, display: 'block', cursor: 'pointer' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button onClick={toggle} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{editedSec.toFixed(2)} / {durationSec.toFixed(2)} sec</div>
      </div>
    </div>
  );
}

