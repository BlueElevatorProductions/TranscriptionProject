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
    if (src.startsWith('http') && src.includes('/media')) {
      const u = new URL(src);
      const nested = u.searchParams.get('src');
      return nested ? decodeURIComponent(nested) : null;
    }
    if (src.startsWith('file://')) {
      const u = new URL(src);
      return decodeURIComponent(u.pathname);
    }
    if (src.startsWith('/')) return src; // absolute path
  } catch {}
  return null;
}

export default function JuceEditorWindow({ src }: { src?: string }) {
  const [active, setActive] = useState<boolean>(document.hasFocus());
  const [editedSec, setEditedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<PeaksData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionId = 'default';

  const filePath = useMemo(() => resolveFilePathFromSrc(src), [src]);

  // Subscribe to JUCE events
  useEffect(() => {
    const handler = (evt: any) => {
      if (!evt || evt.id !== sessionId) return;
      switch (evt.type) {
        case 'loaded':
          setDurationSec(evt.durationSec || 0);
          break;
        case 'state':
          setPlaying(!!evt.playing);
          break;
        case 'position':
          setEditedSec(evt.editedSec || 0);
          break;
        case 'ended':
          setPlaying(false);
          setEditedSec(durationSec);
          break;
        case 'error':
          // keep console noise minimal; surface if useful
          // console.error('JUCE error (editor):', evt.message);
          break;
      }
    };
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
        if (!fp) return;
        // Attempt to query peaks via the app's local server: use current location origin if available
        // The `src` parameter likely includes the media server host: reuse its origin if HTTP
        let base = '';
        if (src && src.startsWith('http')) {
          const u = new URL(src);
          base = `${u.protocol}//${u.hostname}:${u.port}`;
        }
        const url = `${base}/peaks?src=${encodeURIComponent(fp)}&samplesPerPixel=1024`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`peaks ${res.status}`);
        const json = (await res.json()) as PeaksData;
        setPeaks(json);
        if (!durationSec && json.durationSec) setDurationSec(json.durationSec);
      } catch (e) {
        // silently ignore if peaks unavailable
      }
    };
    fetchPeaks();
  }, [filePath, src, durationSec]);

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
    if (!active) return; // only active window sends commands
    if (playing) await window.juceTransport.pause(sessionId);
    else await window.juceTransport.play(sessionId);
  }, [playing, sessionId, active]);

  const onSeek = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!active || durationSec <= 0) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * durationSec;
    await window.juceTransport.seek(sessionId, t);
  }, [active, durationSec, sessionId]);

  return (
    <div style={{ padding: 12, color: 'white', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {filePath ? `File: ${filePath}` : 'No file'}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{active ? 'Active control' : 'Passive'}</div>
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

