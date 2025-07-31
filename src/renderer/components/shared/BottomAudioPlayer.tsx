import React, { useRef, useEffect, useState } from 'react';
import './BottomAudioPlayer.css';

interface SharedAudioState {
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  playbackSpeed: number;
}

interface BottomAudioPlayerProps {
  audioSrc?: string;
  fileName?: string;
  sharedAudioState: SharedAudioState;
  onAudioStateUpdate: (updates: Partial<SharedAudioState>) => void;
}

const BottomAudioPlayer: React.FC<BottomAudioPlayerProps> = ({
  audioSrc,
  fileName = 'Audio File',
  sharedAudioState,
  onAudioStateUpdate
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const isSeekingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);

  const { currentTime, isPlaying, volume, playbackSpeed } = sharedAudioState;

  // Load audio file using Electron API
  useEffect(() => {
    let blobUrl: string | null = null;
    
    const loadAudio = async () => {
      if (!audioSrc) {
        console.log('BottomAudioPlayer - No audio source provided');
        return;
      }
      
      console.log('BottomAudioPlayer - Loading audio from path:', audioSrc);
      setIsAudioReady(false);
      setAudioBlobUrl(null);
      
      try {
        // Check if electronAPI is available
        if (!window.electronAPI || !window.electronAPI.readAudioFile) {
          throw new Error('Electron API not available');
        }
        
        // Read audio file as ArrayBuffer through IPC
        const audioBuffer = await window.electronAPI.readAudioFile(audioSrc);
        console.log('BottomAudioPlayer - Got audio buffer, size:', audioBuffer?.byteLength || 'null');
        
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
        
        console.log('BottomAudioPlayer - Created blob URL:', blobUrl);
        setAudioBlobUrl(blobUrl);
        
      } catch (error) {
        console.error('BottomAudioPlayer - Failed to load audio file:', error);
      }
    };
    
    loadAudio();
    
    // Cleanup blob URL
    return () => {
      if (blobUrl) {
        console.log('BottomAudioPlayer - Cleaning up blob URL');
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [audioSrc]);
  
  // Set up audio element when blob URL is ready
  useEffect(() => {
    if (audioRef.current && audioBlobUrl && audioRef.current.src !== audioBlobUrl) {
      console.log('BottomAudioPlayer - Setting audio element src to blob URL:', audioBlobUrl);
      audioRef.current.src = audioBlobUrl;
      
      // Add error handling
      const handleError = (e: Event) => {
        console.error('BottomAudioPlayer - Audio element error:', e);
        const audio = e.target as HTMLAudioElement;
        if (audio.error) {
          console.error('BottomAudioPlayer - Audio error details:', {
            code: audio.error.code,
            message: audio.error.message
          });
        }
      };
      
      const handleLoadedData = () => {
        console.log('BottomAudioPlayer - Audio loaded successfully, duration:', audioRef.current?.duration);
        setIsAudioReady(true);
        setDuration(audioRef.current?.duration || 0);
      };
      
      const handleCanPlay = () => {
        console.log('BottomAudioPlayer - Audio can start playing');
        setIsAudioReady(true);
        setDuration(audioRef.current?.duration || 0);
      };
      
      const handleTimeUpdate = () => {
        if (audioRef.current && !isSeekingRef.current) {
          const audioTime = audioRef.current.currentTime;
          const now = Date.now();
          // Only update parent every 100ms to reduce re-renders
          if (now - lastUpdateTimeRef.current > 100) {
            onAudioStateUpdate({ currentTime: audioTime });
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
        console.log('BottomAudioPlayer - External seek to:', currentTime, 'from:', audioRef.current.currentTime);
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
      console.log('BottomAudioPlayer - Play state changed:', isPlaying, 'Audio paused:', audioRef.current.paused);
      
      if (isPlaying && audioRef.current.paused) {
        console.log('BottomAudioPlayer - Playing audio...');
        audioRef.current.play().catch(error => {
          console.error('BottomAudioPlayer - Audio play failed:', error);
        });
      } else if (!isPlaying && !audioRef.current.paused) {
        console.log('BottomAudioPlayer - Pausing audio...');
        audioRef.current.pause();
      }
    }
  }, [isPlaying, isAudioReady]);

  // Click handlers
  const handlePlayPauseClick = () => {
    console.log('BottomAudioPlayer - Play/Pause clicked, current isPlaying:', isPlaying);
    onAudioStateUpdate({ isPlaying: !isPlaying });
  };
  
  const handleRewindClick = () => {
    const newTime = Math.max(0, currentTime - 15);
    onAudioStateUpdate({ currentTime: newTime });
  };
  
  const handleForwardClick = () => {
    const newTime = Math.min(duration, currentTime + 15);
    onAudioStateUpdate({ currentTime: newTime });
  };
  
  const handleProgressClick = (e: React.MouseEvent) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      console.log('BottomAudioPlayer - Progress bar clicked, seeking to:', newTime);
      onAudioStateUpdate({ currentTime: newTime });
    }
  };
  
  const handleVolumeClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newVolume = Math.max(0, Math.min(1, percent));
    onAudioStateUpdate({ volume: newVolume });
  };
  
  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSpeed = parseFloat(e.target.value);
    onAudioStateUpdate({ playbackSpeed: newSpeed });
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const getVolumeIcon = () => {
    if (volume === 0) return '🔇';
    if (volume < 0.5) return '🔉';
    return '🔊';
  };

  // Debug logging
  useEffect(() => {
    console.log('BottomAudioPlayer - Render conditions:', {
      audioSrc: audioSrc || 'MISSING',
      fileName: fileName || 'MISSING',
      sharedAudioState,
      isAudioReady,
      audioBlobUrl: audioBlobUrl || 'NOT_LOADED'
    });
  }, [audioSrc, fileName, sharedAudioState, isAudioReady, audioBlobUrl]);

  // Don't render if no audio source
  if (!audioSrc) {
    console.log('BottomAudioPlayer - Not rendering: no audioSrc');
    return null;
  }
  
  console.log('BottomAudioPlayer - RENDERING with audioSrc:', audioSrc);

  return (
    <div className="audio-player-container">
      <div className="audio-player" id="audioPlayer">
        {/* Track Info */}
        <div className="track-info">
          <div className="track-title">{fileName}</div>
          <div className="track-subtitle">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Controls */}
        <div className="controls">
          <button 
            className="control-btn small rewind" 
            onClick={handleRewindClick}
            title="Rewind 15s"
          ></button>
          <button 
            className={`control-btn large ${isPlaying ? 'pause' : 'play'}`}
            onClick={handlePlayPauseClick}
            title={isPlaying ? 'Pause' : 'Play'}
          ></button>
          <button 
            className="control-btn small forward" 
            onClick={handleForwardClick}
            title="Forward 15s"
          ></button>
        </div>

        {/* Progress Section */}
        <div className="progress-section">
          <div className="progress-bar" onClick={handleProgressClick}>
            <div 
              className="progress-fill" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume Section */}
        <div className="volume-section">
          <span className="volume-icon">{getVolumeIcon()}</span>
          <div className="volume-slider" onClick={handleVolumeClick}>
            <div 
              className="volume-fill" 
              style={{ width: `${volume * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Speed Section */}
        <div className="speed-section">
          <span className="speed-label">Speed:</span>
          <select 
            className="speed-dropdown" 
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
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata">
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};

export default BottomAudioPlayer;