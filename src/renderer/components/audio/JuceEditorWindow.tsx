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
  const [clips, setClips] = useState<any[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sessionId = 'default'; // Use same session as main window to avoid conflicts

  const filePath = useMemo(() => resolveFilePathFromSrc(src), [src]);

  // --- Theme helpers (mirror main window ColorSettings behavior) ---
  type ThemeKind = 'blue' | 'green' | 'light' | 'dark' | 'other';
  const [themeKind, setThemeKind] = useState<ThemeKind>('other');

  function inferThemeKind(themeValue: string): ThemeKind {
    if (themeValue === 'light') return 'light';
    if (themeValue === 'dark') return 'dark';
    if (themeValue === '#0086bf') return 'blue';
    if (themeValue === '#007552') return 'green';
    return 'other';
  }

  function applyTheme(themeValue: string) {
    const root = document.documentElement;
    if (!root) return;
    setThemeKind(inferThemeKind(themeValue));

    if (themeValue === 'light') {
      root.style.setProperty('--bg', '43 100% 97%');
      root.style.setProperty('--surface', '43 100% 97%');
      root.style.setProperty('--sidebar', '43 100% 97%');
      root.style.setProperty('--text', '220 15% 15%');
      root.style.setProperty('--text-muted', '220 15% 40%');
      root.style.setProperty('--border', '43 30% 85%');
      root.style.setProperty('--hover-bg', '43 60% 92%');
      root.style.setProperty('--glass-surface', '43 100% 97% / 1');
      root.style.setProperty('--glass-text', '220 15% 15%');
      root.style.setProperty('--glass-border-subtle', '220 15% 15% / 1');
      root.style.setProperty('--sidebar-bg-opacity', '0.8');
      root.style.setProperty('--panel-bg-opacity', '0.8');
    } else if (themeValue === 'dark') {
      root.style.setProperty('--bg', '220 15% 10%');
      root.style.setProperty('--surface', '220 15% 15%');
      root.style.setProperty('--sidebar', '220 13% 20%');
      root.style.setProperty('--text', '50 100% 95%');
      root.style.setProperty('--text-muted', '240 5% 65%');
      root.style.setProperty('--border', '220 15% 25%');
      root.style.setProperty('--hover-bg', '220 15% 20%');
      root.style.setProperty('--glass-surface', '220 15% 15% / 1');
      root.style.setProperty('--glass-text', '0 0% 100%');
      root.style.setProperty('--sidebar-bg-opacity', '0.3');
      root.style.setProperty('--panel-bg-opacity', '0.2');
    } else if (themeValue === '#0086bf') {
      // Blue theme
      root.style.setProperty('--bg', '220 15% 15%');
      root.style.setProperty('--surface', '200 100% 37%');
      root.style.setProperty('--sidebar', '200 100% 37%');
      root.style.setProperty('--text', '50 100% 95%');
      root.style.setProperty('--text-muted', '240 5% 65%');
      root.style.setProperty('--border', '220 15% 100%');
      root.style.setProperty('--hover-bg', '200 100% 42%');
      root.style.setProperty('--glass-surface', '0 0% 96% / 1');
      root.style.setProperty('--glass-text', '220 13% 15%');
      root.style.setProperty('--sidebar-bg-opacity', '0.3');
      root.style.setProperty('--panel-bg-opacity', '0.2');
    } else if (themeValue === '#007552') {
      // Green theme
      root.style.setProperty('--bg', '220 15% 15%');
      root.style.setProperty('--surface', '160 100% 23%');
      root.style.setProperty('--sidebar', '160 100% 23%');
      root.style.setProperty('--text', '50 100% 95%');
      root.style.setProperty('--text-muted', '240 5% 65%');
      root.style.setProperty('--border', '220 15% 100%');
      root.style.setProperty('--hover-bg', '160 100% 28%');
      root.style.setProperty('--glass-surface', '0 0% 96% / 1');
      root.style.setProperty('--glass-text', '220 13% 15%');
      root.style.setProperty('--sidebar-bg-opacity', '0.3');
      root.style.setProperty('--panel-bg-opacity', '0.2');
    }
  }

  // Pull selected theme from localStorage (same key used in main window)
  useEffect(() => {
    try {
      const savedColor = localStorage.getItem('app-color-theme');
      if (savedColor) applyTheme(savedColor);
    } catch {}
  }, []);

  // Resolve an HSL triple from a CSS var like "--surface" → [h,s,l]
  function getHslVarTuple(varName: string): [number, number, number] | null {
    try {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      if (!raw) return null;
      // Strip optional alpha part: "H S% L% / A" → "H S% L%"
      const main = raw.split('/')[0].trim();
      const parts = main.split(/\s+/);
      if (parts.length < 3) return null;
      const h = parseFloat(parts[0]);
      const s = parseFloat(parts[1].replace('%', ''));
      const l = parseFloat(parts[2].replace('%', ''));
      if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) return [h, s, l];
      return null;
    } catch {
      return null;
    }
  }

  function toHslCss(h: number, s: number, l: number, a?: number): string {
    if (a == null) return `hsl(${h} ${s}% ${l}%)`;
    return `hsl(${h} ${s}% ${l}% / ${a})`;
    }

  function lighten(hsl: [number, number, number], deltaL: number): [number, number, number] {
    const [h, s, l] = hsl;
    return [h, s, Math.max(0, Math.min(100, l + deltaL))];
  }
  function darken(hsl: [number, number, number], deltaL: number): [number, number, number] {
    return lighten(hsl, -Math.abs(deltaL));
  }

  // Primary theme color (use surface as primary; fallback to accent)
  const [primaryHsl, setPrimaryHsl] = useState<[number, number, number]>(() => (
    getHslVarTuple('--surface') ||
    getHslVarTuple('--accent') ||
    ([200, 100, 37] as [number, number, number])
  ));

  const refreshThemeDerivedColors = useCallback(() => {
    const hsl =
      getHslVarTuple('--surface') ||
      getHslVarTuple('--accent') ||
      ([200, 100, 37] as [number, number, number]);
    setPrimaryHsl(hsl);
  }, []);

  const clipBgCss = useMemo(() => {
    switch (themeKind) {
      case 'blue':
      case 'green': {
        const lighter = lighten(primaryHsl, 18);
        return toHslCss(lighter[0], lighter[1], lighter[2]);
      }
      case 'light':
      case 'dark':
      default:
        return toHslCss(primaryHsl[0], primaryHsl[1], primaryHsl[2]);
    }
  }, [primaryHsl, themeKind]);

  const waveformCss = useMemo(() => {
    switch (themeKind) {
      case 'blue':
      case 'green': {
        const darker = darken(primaryHsl, 12);
        return toHslCss(darker[0], darker[1], darker[2]);
      }
      case 'light': {
        // High contrast on white: use current theme text color (dark gray)
        const t = getHslVarTuple('--text') || ([220, 15, 15] as [number, number, number]);
        return toHslCss(t[0], t[1], t[2]);
      }
      case 'dark': {
        // White waveform for dark mode
        const w = getHslVarTuple('--text-on-dark') || ([0, 0, 100] as [number, number, number]);
        return toHslCss(w[0], w[1], w[2]);
      }
      default: {
        const lighter = lighten(primaryHsl, 12);
        return toHslCss(lighter[0], lighter[1], lighter[2]);
      }
    }
  }, [primaryHsl, themeKind]);
  const playheadCss = useMemo(() => {
    const t = getHslVarTuple('--text') || ([0, 0, 95] as [number, number, number]);
    return toHslCss(t[0], t[1], t[2]);
  }, []);

  // Build contiguous edited timeline ranges from synced clips
  const editedClips = useMemo(() => {
    const playable = (clips || [])
      .filter((c: any) => c && c.type !== 'audio-only' && c.status !== 'deleted');
    // Sort by provided order; fallback to array order
    const sorted = [...playable].sort((a: any, b: any) => {
      const ao = typeof a.order === 'number' ? a.order : playable.indexOf(a);
      const bo = typeof b.order === 'number' ? b.order : playable.indexOf(b);
      return ao - bo;
    });
    const result: Array<{ id: string; editedStart: number; editedEnd: number; originalStart: number; originalEnd: number }> = [];
    let acc = 0;
    for (const c of sorted) {
      const s = Number(c.startTime) || 0;
      const e = Number(c.endTime) || s;
      const d = Math.max(0, e - s);
      const es = acc;
      const ee = acc + d;
      result.push({ id: String(c.id), editedStart: es, editedEnd: ee, originalStart: s, originalEnd: e });
      acc = ee;
    }
    return result;
  }, [clips]);

  // --- Zoom state ---
  const [zoom, setZoom] = useState<number>(1); // 1x = full duration, 2x = half duration view
  const maxZoom = 16;
  const minZoom = 1;
  const zoomIn = useCallback(() => setZoom((z) => Math.min(maxZoom, z * 2)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(minZoom, Math.floor(z / 2) || 1)), []);

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
          setEditedSec(evt.editedSec || 0);
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

  // Sync clips from main/other windows
  useEffect(() => {
    let mounted = true;
    // Initial fetch
    try { (window as any).electronAPI?.clipsGet?.().then((c: any[]) => { if (mounted) setClips(c || []); }); } catch {}
    // Live updates
    const onChanged = (c: any[]) => setClips(Array.isArray(c) ? c : []);
    try { (window as any).electronAPI?.onClipsChanged?.(onChanged); } catch {}
    return () => { mounted = false; };
  }, []);

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

  // Listen for live theme changes from the main window via localStorage 'storage' event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'app-color-theme' && e.newValue) {
        applyTheme(e.newValue);
        // After applying CSS variables, recompute derived colors
        // Slight delay to allow style recalculation
        setTimeout(refreshThemeDerivedColors, 0);
      }
    };
    const onFocus = () => {
      try {
        const current = localStorage.getItem('app-color-theme');
        if (current) {
          applyTheme(current);
          setTimeout(refreshThemeDerivedColors, 0);
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshThemeDerivedColors]);

  // Edited duration from clips
  const editedTotalDuration = useMemo(() => (editedClips.length ? editedClips[editedClips.length - 1].editedEnd : 0), [editedClips]);

  // Viewport that follows playhead with hysteresis
  const [viewportStartSec, setViewportStartSec] = useState(0);
  useEffect(() => {
    const total = editedTotalDuration || durationSec || 0;
    if (total <= 0) return;
    const viewportDuration = total / Math.max(1, zoom);
    if (viewportDuration > 0 && viewportStartSec === 0) {
      const start = Math.max(0, editedSec - viewportDuration / 2);
      setViewportStartSec(Math.min(Math.max(0, start), Math.max(0, total - viewportDuration)));
    }
  }, [editedTotalDuration, durationSec, zoom]);

  useEffect(() => {
    const total = editedTotalDuration || durationSec || 0;
    if (total <= 0) return;
    const viewportDuration = total / Math.max(1, zoom);
    const marginLow = viewportStartSec + viewportDuration * 0.3;
    const marginHigh = viewportStartSec + viewportDuration * 0.7;
    if (editedSec < marginLow || editedSec > marginHigh) {
      const start = Math.max(0, editedSec - viewportDuration / 2);
      const clamped = Math.min(Math.max(0, start), Math.max(0, total - viewportDuration));
      setViewportStartSec(clamped);
    }
  }, [editedSec, editedTotalDuration, durationSec, zoom, viewportStartSec]);

  // Draw waveform (heavy) respecting viewport; avoid on every position tick
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !peaks) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    // Waveform uses slightly lighter version of the primary theme color
    ctx.fillStyle = waveformCss;
    const data = peaks.peaks;
    const totalWindows = Math.floor(data.length / 2);
    const secPerWindow = peaks.samplesPerPixel / peaks.sampleRate;

    const fullDuration = editedTotalDuration || durationSec || peaks.durationSec || (totalWindows * secPerWindow);
    const viewportDuration = fullDuration / Math.max(1, zoom);
    const startSec = Math.max(0, Math.min(viewportStartSec, Math.max(0, fullDuration - viewportDuration)));
    const endSec = Math.min(fullDuration, startSec + viewportDuration);

    // Map edited timeline → original time via clips for reordered visualization
    const mapEditedToOriginal = (tEdited: number): number | null => {
      // Find containing clip (linear scan; could be optimized later)
      for (const ec of editedClips) {
        if (tEdited >= ec.editedStart && tEdited <= ec.editedEnd) {
          const clipDur = Math.max(1e-9, ec.editedEnd - ec.editedStart);
          const r = (tEdited - ec.editedStart) / clipDur;
          return ec.originalStart + r * (ec.originalEnd - ec.originalStart);
        }
      }
      return null;
    };

    for (let x = 0; x < w; x++) {
      const tEdited = startSec + (x / w) * (endSec - startSec);
      const tOrig = mapEditedToOriginal(tEdited);
      if (tOrig == null) continue; // outside of clips
      const idx = Math.max(0, Math.min(totalWindows - 1, Math.floor(tOrig / secPerWindow)));
      const min = data[idx * 2] || 0;
      const max = data[idx * 2 + 1] || 0;
      const y1 = Math.round(((1 - max) * 0.5) * h);
      const y2 = Math.round(((1 - min) * 0.5) * h);
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }

  }, [peaks, durationSec, waveformCss, zoom, editedClips, editedTotalDuration, viewportStartSec]);

  // Draw overlays (clip shading + boundaries + playhead)
  useEffect(() => {
    const c = overlayRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    const total = editedTotalDuration || durationSec || 0;
    if (total <= 0) return;
    const viewportDuration = total / Math.max(1, zoom);
    const startSec = viewportStartSec;
    const endSec = startSec + viewportDuration;

    const textHsl = getHslVarTuple('--text') || ([0, 0, 95] as [number, number, number]);
    for (let i = 0; i < editedClips.length; i++) {
      const ec = editedClips[i];
      if (ec.editedEnd <= startSec || ec.editedStart >= endSec) continue;
      const x1 = Math.max(0, (ec.editedStart - startSec) / (endSec - startSec)) * w;
      const x2 = Math.min(1, (ec.editedEnd - startSec) / (endSec - startSec)) * w;
      if (i % 2 === 0) {
        ctx.fillStyle = toHslCss(textHsl[0], textHsl[1], textHsl[2], 0.06);
        ctx.fillRect(Math.round(x1), 0, Math.max(1, Math.round(x2 - x1)), h);
      }
      ctx.strokeStyle = toHslCss(textHsl[0], textHsl[1], textHsl[2], 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x1) + 0.5, 0);
      ctx.lineTo(Math.round(x1) + 0.5, h);
      ctx.stroke();
      if (i === editedClips.length - 1) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x2) + 0.5, 0);
        ctx.lineTo(Math.round(x2) + 0.5, h);
        ctx.stroke();
      }
      if (selectedClipId && ec.id === selectedClipId) {
        ctx.strokeStyle = toHslCss(textHsl[0], textHsl[1], textHsl[2], 0.9);
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(x1) + 0.5, 0.5, Math.max(1, Math.round(x2 - x1) - 1), h - 1);
      }
    }
    // Playhead
    const rel = (editedSec - startSec) / Math.max(1e-9, (endSec - startSec));
    const px = Math.min(w - 1, Math.max(0, Math.round(rel * w)));
    ctx.fillStyle = playheadCss;
    ctx.fillRect(px, 0, 1, h);
  }, [editedSec, playheadCss, editedClips, selectedClipId, viewportStartSec, zoom, editedTotalDuration, durationSec]);

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
      // Map click within current viewport to absolute edited time
      const total = editedTotalDuration || durationSec || 0;
      const viewportDuration = total / Math.max(1, zoom);
      const startSec = viewportStartSec;
      const t = startSec + (x / rect.width) * viewportDuration;
      console.log(`JuceEditorWindow: Seeking to ${t.toFixed(2)}s`);
      await window.juceTransport.seek(sessionId, t);
      // Update selected clip based on edited timeline
      let sel: string | null = null;
      for (const ec of editedClips) {
        if (t >= ec.editedStart && t <= ec.editedEnd) { sel = ec.id; break; }
      }
      setSelectedClipId(sel);
    } catch (error) {
      console.error('JuceEditorWindow: Error seeking:', error);
    }
  }, [active, durationSec, sessionId, zoom, editedClips, editedTotalDuration, viewportStartSec]);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Zoom</div>
        <button onClick={zoomOut} title="Zoom out" style={{ padding: '4px 8px', background: 'hsl(var(--glass-surface))', color: 'hsl(var(--glass-text))', border: '1px solid hsl(var(--glass-border))', borderRadius: 4, cursor: 'pointer' }}>-</button>
        <button onClick={zoomIn} title="Zoom in" style={{ padding: '4px 8px', background: 'hsl(var(--glass-surface))', color: 'hsl(var(--glass-text))', border: '1px solid hsl(var(--glass-border))', borderRadius: 4, cursor: 'pointer' }}>+</button>
        <div style={{ fontSize: 12, opacity: 0.7 }}>x{zoom}</div>
      </div>
      <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid hsl(var(--glass-border))', background: clipBgCss }}>
        <canvas ref={canvasRef} width={900} height={160} onClick={onSeek} style={{ width: '100%', height: 160, display: 'block', cursor: 'pointer' }} />
        <canvas ref={overlayRef} width={900} height={160} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 160, pointerEvents: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <button onClick={toggle} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{editedSec.toFixed(2)} / {durationSec.toFixed(2)} sec</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginLeft: 8 }}>Clips: {clips?.length || 0}</div>
      </div>
    </div>
  );
}
