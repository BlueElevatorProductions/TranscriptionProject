import React, { useRef, useEffect, useState } from 'react';
import './AudioControlsPanel.css';

interface AudioControlsPanelProps {
  mode: 'playback' | 'transcript-edit';
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume?: number;
  playbackSpeed?: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
  onSpeedChange?: (speed: number) => void;
  onSkipBack?: () => void;
  onSkipForward?: () => void;
  audioSrc?: string;
}

const AudioControlsPanel: React.FC<AudioControlsPanelProps> = ({
  currentTime,
  duration,
  isPlaying,
  volume = 0.6,
  playbackSpeed = 1.0,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSpeedChange,
  onSkipBack,
  onSkipForward,
  audioSrc
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const isSeekingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);

  // Load audio file using Electron API
  useEffect(() => {
    let blobUrl: string | null = null;
    
    const loadAudio = async () => {
      if (!audioSrc) {
        console.log('No audio source provided');
        return;
      }
      
      console.log('Loading audio from path:', audioSrc);
      setIsAudioReady(false);
      setAudioBlobUrl(null);
      
      try {
        // Check if electronAPI is available
        if (!window.electronAPI || !window.electronAPI.readAudioFile) {
          throw new Error('Electron API not available');
        }
        
        // Read audio file as ArrayBuffer through IPC
        const audioBuffer = await window.electronAPI.readAudioFile(audioSrc);
        console.log('Got audio buffer, size:', audioBuffer?.byteLength || 'null');
        
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error('Audio file is empty or could not be read');
        }
        
        // Get audio MIME type
        const getAudioMimeType = (filePath: string): string => {
          const ext = filePath.toLowerCase().split('.').pop();
          switch (ext) {
            case 'mp3': return 'audio/mpeg';
            case 'wav': return 'audio/wav';
            case 'm4a': return 'audio/mp4';
            case 'flac': return 'audio/flac';
            case 'ogg': return 'audio/ogg';
            case 'webm': return 'audio/webm';
            default: return 'audio/wav';
          }
        };
        
        // Create blob from buffer
        const mimeType = getAudioMimeType(audioSrc);
        const blob = new Blob([audioBuffer], { type: mimeType });
        blobUrl = URL.createObjectURL(blob);
        
        console.log('Created blob URL:', blobUrl);
        setAudioBlobUrl(blobUrl);
        
      } catch (error) {
        console.error('Failed to load audio file:', error);
      }
    };
    
    loadAudio();
    
    // Cleanup blob URL
    return () => {
      if (blobUrl) {
        console.log('Cleaning up blob URL');
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [audioSrc]);
  
  // Set up audio element when blob URL is ready
  useEffect(() => {
    if (audioRef.current && audioBlobUrl && audioRef.current.src !== audioBlobUrl) {
      console.log('Setting audio element src to blob URL:', audioBlobUrl);
      audioRef.current.src = audioBlobUrl;
      
      // Add error handling
      const handleError = (e: Event) => {
        console.error('Audio element error:', e);
        const audio = e.target as HTMLAudioElement;
        if (audio.error) {
          console.error('Audio error details:', {
            code: audio.error.code,
            message: audio.error.message
          });
        }
      };
      
      const handleLoadedData = () => {
        console.log('Audio loaded successfully, duration:', audioRef.current?.duration);
        setIsAudioReady(true);
      };
      
      const handleCanPlay = () => {
        console.log('Audio can start playing');
        setIsAudioReady(true);
      };
      
      const handleTimeUpdate = () => {
        if (audioRef.current && !isSeekingRef.current && onSeek) {
          const audioTime = audioRef.current.currentTime;
          const now = Date.now();
          // Only update parent every 100ms to reduce re-renders
          if (now - lastUpdateTimeRef.current > 100) {
            onSeek(audioTime);
            lastUpdateTimeRef.current = now;
          }
        }
      };
      
      audioRef.current.addEventListener('error', handleError);
      audioRef.current.addEventListener('loadeddata', handleLoadedData);
      audioRef.current.addEventListener('canplay', handleCanPlay);
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      
      // Cleanup listeners
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('error', handleError);
          audioRef.current.removeEventListener('loadeddata', handleLoadedData);
          audioRef.current.removeEventListener('canplay', handleCanPlay);
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        }
      };
    }
  }, [audioBlobUrl]);

  // Update audio element properties when props change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [volume, playbackSpeed]);

  // Handle external time updates (deliberate seeks only)
  const lastExternalTimeRef = useRef(currentTime);
  useEffect(() => {
    if (audioRef.current && isAudioReady) {
      const timeDiff = Math.abs(audioRef.current.currentTime - currentTime);
      const isExternalSeek = Math.abs(lastExternalTimeRef.current - currentTime) > 2;
      
      if (isExternalSeek && timeDiff > 2) {
        console.log('External seek to:', currentTime, 'from:', audioRef.current.currentTime);
        isSeekingRef.current = true;
        audioRef.current.currentTime = currentTime;
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 200);
      }
    }
    
    lastExternalTimeRef.current = currentTime;
  }, [currentTime, isAudioReady]);
  
  // Handle play/pause state
  useEffect(() => {
    if (audioRef.current && isAudioReady) {
      console.log('Play state changed:', isPlaying, 'Audio paused:', audioRef.current.paused);
      
      if (isPlaying && audioRef.current.paused) {
        console.log('Playing audio...');
        audioRef.current.play().catch(error => {
          console.error('Audio play failed:', error);
        });
      } else if (!isPlaying && !audioRef.current.paused) {
        console.log('Pausing audio...');
        audioRef.current.pause();
      }
    }
  }, [isPlaying, isAudioReady]);

  // Simple click handlers
  const handlePlayPauseClick = () => {
    console.log('Play/Pause clicked, current isPlaying:', isPlaying);
    onPlayPause();
  };
  
  const handleRewindClick = () => {
    if (onSkipBack) onSkipBack();
  };
  
  const handleForwardClick = () => {
    if (onSkipForward) onSkipForward();
  };
  
  const handleProgressClick = (e: React.MouseEvent) => {
    if (audioRef.current && onSeek) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      console.log('Progress bar clicked, seeking to:', newTime);
      onSeek(newTime);
    }
  };
  
  const handleVolumeClick = (e: React.MouseEvent) => {
    if (onVolumeChange) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newVolume = Math.max(0, Math.min(1, percent));
      onVolumeChange(newVolume);
    }
  };
  
  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onSpeedChange) {
      const newSpeed = parseFloat(e.target.value);
      onSpeedChange(newSpeed);
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player" id="audioPlayer">
      <div className="progress-container">
        <div className="progress-bar" id="progressBar" onClick={handleProgressClick}>
          <div 
            className="progress-fill" 
            id="progressFill" 
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <div className="time-display">
          <span id="currentTime">
            {formatTime(currentTime)}
          </span>
          <span id="duration">
            {formatTime(duration)}
          </span>
        </div>
      </div>
      
      <div className="controls">
        <button 
          className="control-btn rewind" 
          id="rewindBtn" 
          onClick={handleRewindClick}
          title="Rewind 15s"
        ></button>
        <button 
          className={`control-btn play-pause ${isPlaying ? 'pause' : 'play'}`}
          id="playBtn" 
          onClick={handlePlayPauseClick}
          title={isPlaying ? 'Pause' : 'Play'}
        ></button>
        <button 
          className="control-btn forward" 
          id="forwardBtn" 
          onClick={handleForwardClick}
          title="Forward 15s"
        ></button>
      </div>
      
      <div className="volume-container">
        <span 
          className="volume-icon icon-volume-low" 
          id="volumeIcon" 
        >
          {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </span>
        <div className="volume-slider" id="volumeSlider" onClick={handleVolumeClick}>
          <div 
            className="volume-fill" 
            id="volumeFill"
            style={{ width: `${volume * 100}%` }}
          ></div>
        </div>
        <span className="volume-icon icon-volume-high"></span>
      </div>
      
      <div className="speed-container">
        <span className="speed-label">Speed:</span>
        <select 
          className="speed-dropdown" 
          id="speedDropdown" 
          value={playbackSpeed}
          onChange={handleSpeedChange}
        >
          <option value="0.5">0.5×</option>
          <option value="0.75">0.75×</option>
          <option value="1">1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
      </div>
      
      <audio id="audioElement" ref={audioRef} preload="metadata">
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default AudioControlsPanel;