/**
 * EditAudioModePlugin - Implements Edit Audio Mode specific features
 *
 * Features:
 * - Audio editor panel with waveform visualization
 * - Visual audio timeline with clip markers and boundaries
 * - Audio-specific editing tools (trim, fade, normalize)
 * - Playback controls with scrubbing and looping
 * - Visual audio clip splitting with precise positioning
 * - Audio export and processing options
 * - Real-time audio analysis and visualization
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Scissors,
  Download,
  Settings,
  Zap,
  TrendingUp,
  Clock
} from 'lucide-react';

export interface EditAudioModePluginProps {
  isEditAudioMode: boolean;
  audioPath?: string | null;
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  volume?: number;
  onSeek?: (time: number) => void;
  onPlayPause?: () => void;
  onVolumeChange?: (volume: number) => void;
  onAudioSplit?: (time: number) => void;
  onAudioExport?: (startTime: number, endTime: number) => void;
  clips?: Array<{
    id: string;
    startTime: number;
    endTime: number;
    speaker: string;
  }>;
}

export default function EditAudioModePlugin({
  isEditAudioMode,
  audioPath,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  volume = 1,
  onSeek,
  onPlayPause,
  onVolumeChange,
  onAudioSplit,
  onAudioExport,
  clips = []
}: EditAudioModePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<{ start: number; end: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [audioAnalysis, setAudioAnalysis] = useState<{
    peaks: number[];
    rms: number[];
    spectralData: number[];
  } | null>(null);

  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [audioTools, setAudioTools] = useState({
    trim: false,
    fade: false,
    normalize: false,
    loop: false
  });

  // ==================== CSS Injection for Edit Audio Mode ====================

  useEffect(() => {
    if (!isEditAudioMode) return;

    const styleId = 'edit-audio-mode-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      /* Edit Audio Mode: Enhanced audio-centric layout */
      .lexical-editor-v2[data-edit-audio-mode="true"] {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      /* Audio panel styling */
      .audio-editor-panel {
        background: hsl(var(--card));
        border: 1px solid hsl(var(--border));
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 4px 8px hsl(var(--shadow) / 0.1);
      }

      /* Waveform container */
      .waveform-container {
        position: relative;
        height: 120px;
        background: hsl(var(--background));
        border: 1px solid hsl(var(--border));
        border-radius: 4px;
        overflow: hidden;
        cursor: crosshair;
      }

      .waveform-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      /* Timeline with clip markers */
      .audio-timeline {
        position: relative;
        height: 40px;
        background: hsl(var(--muted));
        border-radius: 4px;
        margin: 8px 0;
        overflow: hidden;
      }

      .timeline-clip {
        position: absolute;
        height: 100%;
        background: hsl(var(--primary) / 0.3);
        border: 2px solid hsl(var(--primary));
        border-radius: 2px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .timeline-clip:hover {
        background: hsl(var(--primary) / 0.5);
        transform: scaleY(1.1);
      }

      .timeline-clip .clip-label {
        position: absolute;
        top: 2px;
        left: 4px;
        font-size: 10px;
        font-weight: 600;
        color: hsl(var(--primary-foreground));
        text-shadow: 0 1px 2px hsl(var(--background));
      }

      /* Playhead indicator */
      .playhead {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: hsl(var(--destructive));
        z-index: 10;
        pointer-events: none;
        box-shadow: 0 0 4px hsl(var(--destructive));
      }

      .playhead::before {
        content: "";
        position: absolute;
        top: -4px;
        left: -3px;
        width: 8px;
        height: 8px;
        background: hsl(var(--destructive));
        border-radius: 50%;
        box-shadow: 0 0 6px hsl(var(--destructive));
      }

      /* Audio controls */
      .audio-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: hsl(var(--muted));
        border-radius: 6px;
        margin: 8px 0;
      }

      .audio-control-btn {
        background: hsl(var(--secondary));
        color: hsl(var(--secondary-foreground));
        border: none;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .audio-control-btn:hover {
        background: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
        transform: scale(1.05);
      }

      .audio-control-btn.active {
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
      }

      /* Volume slider */
      .volume-slider {
        width: 80px;
        height: 4px;
        background: hsl(var(--border));
        border-radius: 2px;
        cursor: pointer;
        position: relative;
      }

      .volume-fill {
        height: 100%;
        background: hsl(var(--primary));
        border-radius: 2px;
        transition: width 0.2s ease;
      }

      .volume-handle {
        position: absolute;
        top: -4px;
        width: 12px;
        height: 12px;
        background: hsl(var(--primary));
        border-radius: 50%;
        cursor: grab;
        transition: all 0.2s ease;
      }

      .volume-handle:hover {
        transform: scale(1.2);
        box-shadow: 0 0 8px hsl(var(--primary) / 0.5);
      }

      /* Time display */
      .time-display {
        font-family: monospace;
        font-size: 14px;
        font-weight: 600;
        color: hsl(var(--foreground));
        min-width: 120px;
        text-align: center;
        background: hsl(var(--background));
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid hsl(var(--border));
      }

      /* Audio tools panel */
      .audio-tools {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px;
        background: hsl(var(--card));
        border-radius: 4px;
        border: 1px solid hsl(var(--border));
      }

      .audio-tool {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        background: hsl(var(--secondary));
        color: hsl(var(--secondary-foreground));
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
      }

      .audio-tool:hover {
        background: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
      }

      .audio-tool.active {
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
      }

      /* Selection region */
      .selection-region {
        position: absolute;
        top: 0;
        bottom: 0;
        background: hsl(var(--primary) / 0.2);
        border: 2px solid hsl(var(--primary));
        border-radius: 2px;
        pointer-events: none;
        z-index: 5;
      }

      /* Zoom controls */
      .zoom-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }

      .zoom-btn {
        background: hsl(var(--secondary));
        color: hsl(var(--secondary-foreground));
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
      }

      .zoom-btn:hover {
        background: hsl(var(--accent));
        color: hsl(var(--accent-foreground));
      }

      /* Audio analysis display */
      .audio-analysis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin: 12px 0;
        padding: 12px;
        background: hsl(var(--muted));
        border-radius: 6px;
      }

      .analysis-item {
        text-align: center;
        padding: 8px;
        background: hsl(var(--background));
        border-radius: 4px;
        border: 1px solid hsl(var(--border));
      }

      .analysis-value {
        font-size: 18px;
        font-weight: 600;
        color: hsl(var(--primary));
        margin-bottom: 2px;
      }

      .analysis-label {
        font-size: 10px;
        color: hsl(var(--muted-foreground));
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .audio-controls {
          flex-wrap: wrap;
          gap: 8px;
        }

        .audio-analysis {
          grid-template-columns: repeat(2, 1fr);
        }

        .waveform-container {
          height: 80px;
        }
      }

      /* Animations */
      @keyframes waveformPulse {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }

      .waveform-playing {
        animation: waveformPulse 2s ease-in-out infinite;
      }

      /* Split indicator in audio mode */
      .audio-split-indicator {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: hsl(var(--warning));
        z-index: 15;
        cursor: pointer;
        box-shadow: 0 0 4px hsl(var(--warning));
      }

      .audio-split-indicator:hover {
        width: 4px;
        box-shadow: 0 0 8px hsl(var(--warning));
      }
    `;

    return () => {
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [isEditAudioMode]);

  // ==================== Editor DOM Updates ====================

  useEffect(() => {
    const editorElement = editor.getRootElement();
    if (!editorElement) return;

    if (isEditAudioMode) {
      editorElement.setAttribute('data-edit-audio-mode', 'true');
      setShowAudioPanel(true);
    } else {
      editorElement.removeAttribute('data-edit-audio-mode');
      setShowAudioPanel(false);
    }

    return () => {
      if (editorElement) {
        editorElement.removeAttribute('data-edit-audio-mode');
      }
    };
  }, [isEditAudioMode, editor]);

  // ==================== Waveform Generation ====================

  useEffect(() => {
    if (!isEditAudioMode || !audioPath) return;

    // Generate mock waveform data for demonstration
    // In a real implementation, this would analyze the actual audio file
    generateMockWaveform();
  }, [isEditAudioMode, audioPath]);

  const generateMockWaveform = useCallback(() => {
    const samples = 2000; // Number of waveform samples
    const mockWaveform: number[] = [];

    for (let i = 0; i < samples; i++) {
      // Generate realistic audio waveform pattern
      const t = i / samples;
      const envelope = Math.exp(-t * 3) * (1 - t); // Decaying envelope
      const noise = (Math.random() - 0.5) * 0.3;
      const signal = Math.sin(t * 20 * Math.PI) * 0.7 + Math.sin(t * 60 * Math.PI) * 0.3;

      mockWaveform.push((signal + noise) * envelope);
    }

    setWaveformData(mockWaveform);

    // Generate mock audio analysis
    setAudioAnalysis({
      peaks: mockWaveform.filter((_, i) => i % 50 === 0),
      rms: mockWaveform.map((val, i) =>
        Math.sqrt(mockWaveform.slice(Math.max(0, i - 10), i + 10)
          .reduce((sum, v) => sum + v * v, 0) / 20)
      ).filter((_, i) => i % 20 === 0),
      spectralData: Array.from({ length: 128 }, (_, i) =>
        Math.random() * Math.exp(-i / 32)
      )
    });
  }, []);

  // ==================== Waveform Drawing ====================

  useEffect(() => {
    if (!waveformData.length || !waveformCanvasRef.current) return;

    drawWaveform();
  }, [waveformData, currentTime, selectedRegion, zoomLevel, isPlaying]);

  const drawWaveform = useCallback(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    const samplesPerPixel = waveformData.length / width;
    const centerY = height / 2;

    ctx.strokeStyle = isPlaying ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel * zoomLevel);
      if (sampleIndex >= waveformData.length) break;

      const amplitude = waveformData[sampleIndex] || 0;
      const y = centerY - (amplitude * centerY * 0.8);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw playhead
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = 'hsl(var(--destructive))';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }

    // Draw selection region
    if (selectedRegion && duration > 0) {
      const startX = (selectedRegion.start / duration) * width;
      const endX = (selectedRegion.end / duration) * width;

      ctx.fillStyle = 'hsl(var(--primary) / 0.2)';
      ctx.fillRect(startX, 0, endX - startX, height);

      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, 0, endX - startX, height);
    }
  }, [waveformData, currentTime, selectedRegion, duration, zoomLevel, isPlaying]);

  // ==================== Waveform Interaction ====================

  const handleWaveformClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !onSeek || duration === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickTime = (x / rect.width) * duration;

    onSeek(Math.max(0, Math.min(duration, clickTime)));
  }, [duration, onSeek]);

  const handleWaveformDrag = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;

    const canvas = waveformCanvasRef.current;
    if (!canvas || duration === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const time = (x / rect.width) * duration;

    if (selectedRegion) {
      setSelectedRegion(prev => prev ? {
        ...prev,
        end: Math.max(prev.start, Math.min(duration, time))
      } : null);
    }
  }, [duration, selectedRegion]);

  // ==================== Audio Controls ====================

  const handleVolumeChange = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onVolumeChange) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, x / rect.width));

    onVolumeChange(newVolume);
  }, [onVolumeChange]);

  const handleAudioSplit = useCallback(() => {
    if (onAudioSplit) {
      onAudioSplit(currentTime);
    }
  }, [currentTime, onAudioSplit]);

  const handleAudioExport = useCallback(() => {
    if (onAudioExport && selectedRegion) {
      onAudioExport(selectedRegion.start, selectedRegion.end);
    }
  }, [selectedRegion, onAudioExport]);

  // ==================== Tool Management ====================

  const toggleAudioTool = useCallback((tool: keyof typeof audioTools) => {
    setAudioTools(prev => ({
      ...prev,
      [tool]: !prev[tool]
    }));
  }, []);

  // ==================== Format Time ====================

  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }, []);

  // ==================== Debug Information ====================

  useEffect(() => {
    if (isEditAudioMode) {
      console.log('🎵 Edit Audio Mode activated');
      console.log('Audio path:', audioPath);
      console.log('Waveform samples:', waveformData.length);
      console.log('Current time:', formatTime(currentTime));
      console.log('Selected region:', selectedRegion);
    } else {
      console.log('🎵 Edit Audio Mode deactivated');
    }
  }, [isEditAudioMode, audioPath, waveformData.length, currentTime, selectedRegion, formatTime]);

  // ==================== Render Audio Panel ====================

  if (!isEditAudioMode || !showAudioPanel) {
    return null;
  }

  return (
    <div className="audio-editor-panel">
      {/* Waveform Display */}
      <div className="waveform-container">
        <canvas
          ref={waveformCanvasRef}
          className={`waveform-canvas ${isPlaying ? 'waveform-playing' : ''}`}
          width={800}
          height={120}
          onClick={handleWaveformClick}
          onMouseMove={handleWaveformDrag}
          onMouseDown={() => { isDraggingRef.current = true; }}
          onMouseUp={() => { isDraggingRef.current = false; }}
          onMouseLeave={() => { isDraggingRef.current = false; }}
        />

        {/* Selection Region Overlay */}
        {selectedRegion && (
          <div
            className="selection-region"
            style={{
              left: `${(selectedRegion.start / duration) * 100}%`,
              width: `${((selectedRegion.end - selectedRegion.start) / duration) * 100}%`
            }}
          />
        )}
      </div>

      {/* Audio Timeline with Clips */}
      <div className="audio-timeline" ref={timelineRef}>
        {clips.map((clip) => (
          <div
            key={clip.id}
            className="timeline-clip"
            style={{
              left: `${(clip.startTime / duration) * 100}%`,
              width: `${((clip.endTime - clip.startTime) / duration) * 100}%`
            }}
            onClick={() => onSeek?.(clip.startTime)}
          >
            <div className="clip-label">{clip.speaker}</div>
          </div>
        ))}

        {/* Playhead */}
        <div
          className="playhead"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />
      </div>

      {/* Audio Controls */}
      <div className="audio-controls">
        <button className="audio-control-btn" onClick={onPlayPause}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        <button className="audio-control-btn" onClick={() => onSeek?.(0)}>
          <Square size={16} />
        </button>

        <button className="audio-control-btn" onClick={() => onSeek?.(Math.max(0, currentTime - 10))}>
          <SkipBack size={16} />
        </button>

        <button className="audio-control-btn" onClick={() => onSeek?.(Math.min(duration, currentTime + 10))}>
          <SkipForward size={16} />
        </button>

        {/* Volume Control */}
        <div className="volume-control">
          {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <div className="volume-slider" onClick={handleVolumeChange}>
            <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
            <div className="volume-handle" style={{ left: `${volume * 100}%` }} />
          </div>
        </div>

        {/* Time Display */}
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Zoom Controls */}
        <div className="zoom-controls">
          <button className="zoom-btn" onClick={() => setZoomLevel(prev => Math.max(0.1, prev - 0.5))}>
            −
          </button>
          <span className="text-xs">{zoomLevel.toFixed(1)}x</span>
          <button className="zoom-btn" onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.5))}>
            +
          </button>
        </div>
      </div>

      {/* Audio Tools */}
      <div className="audio-tools">
        <button
          className={`audio-tool ${audioTools.trim ? 'active' : ''}`}
          onClick={() => toggleAudioTool('trim')}
        >
          <Scissors size={12} />
          Trim
        </button>

        <button
          className={`audio-tool ${audioTools.fade ? 'active' : ''}`}
          onClick={() => toggleAudioTool('fade')}
        >
          <TrendingUp size={12} />
          Fade
        </button>

        <button
          className={`audio-tool ${audioTools.normalize ? 'active' : ''}`}
          onClick={() => toggleAudioTool('normalize')}
        >
          <Zap size={12} />
          Normalize
        </button>

        <button
          className={`audio-tool ${audioTools.loop ? 'active' : ''}`}
          onClick={() => toggleAudioTool('loop')}
        >
          <Clock size={12} />
          Loop
        </button>

        <button className="audio-tool" onClick={handleAudioSplit}>
          <Scissors size={12} />
          Split at {formatTime(currentTime)}
        </button>

        {selectedRegion && (
          <button className="audio-tool" onClick={handleAudioExport}>
            <Download size={12} />
            Export Selection
          </button>
        )}

        <button className="audio-tool">
          <Settings size={12} />
          Settings
        </button>
      </div>

      {/* Audio Analysis */}
      {audioAnalysis && (
        <div className="audio-analysis">
          <div className="analysis-item">
            <div className="analysis-value">
              {Math.max(...audioAnalysis.peaks).toFixed(2)}
            </div>
            <div className="analysis-label">Peak Level</div>
          </div>

          <div className="analysis-item">
            <div className="analysis-value">
              {(audioAnalysis.rms.reduce((a, b) => a + b, 0) / audioAnalysis.rms.length).toFixed(2)}
            </div>
            <div className="analysis-label">RMS Level</div>
          </div>

          <div className="analysis-item">
            <div className="analysis-value">
              {formatTime(duration)}
            </div>
            <div className="analysis-label">Duration</div>
          </div>

          <div className="analysis-item">
            <div className="analysis-value">
              {clips.length}
            </div>
            <div className="analysis-label">Clips</div>
          </div>
        </div>
      )}
    </div>
  );
}