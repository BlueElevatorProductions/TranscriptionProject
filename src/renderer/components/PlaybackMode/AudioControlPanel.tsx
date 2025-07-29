import React, { useRef, useEffect, useState } from 'react';

interface AudioControlPanelProps {
  audioPath: string;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: (playing: boolean) => void;
  duration: number;
}

const AudioControlPanel: React.FC<AudioControlPanelProps> = ({
  audioPath,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onPlayPause,
  duration
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(0.7);
  const [isDragging, setIsDragging] = useState(false);
  const [actualDuration, setActualDuration] = useState(duration);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Load audio file when component mounts or audioPath changes
  useEffect(() => {
    let blobUrl: string | null = null;
    
    const loadAudio = async () => {
      const audio = audioRef.current;
      if (!audio || !audioPath) return;

      try {
        setAudioError(null);
        setAudioLoaded(false);
        
        console.log('Loading audio from path:', audioPath);
        
        // Read audio file as ArrayBuffer through IPC
        const audioBuffer = await window.electronAPI.readAudioFile(audioPath);
        console.log('Got audio buffer, size:', audioBuffer.byteLength);
        
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error('Audio file is empty or could not be read');
        }
        
        // Determine MIME type based on file extension
        const getAudioMimeType = (filePath: string): string => {
          const ext = filePath.toLowerCase().split('.').pop();
          switch (ext) {
            case 'mp3': return 'audio/mpeg';
            case 'wav': return 'audio/wav';
            case 'm4a': return 'audio/mp4';
            case 'flac': return 'audio/flac';
            case 'ogg': return 'audio/ogg';
            case 'aac': return 'audio/aac';
            case 'wma': return 'audio/x-ms-wma';
            default: return 'audio/mpeg'; // fallback
          }
        };
        
        // Create blob from buffer
        const mimeType = getAudioMimeType(audioPath);
        const blob = new Blob([audioBuffer], { type: mimeType });
        blobUrl = URL.createObjectURL(blob);
        
        console.log('Created blob URL:', blobUrl, 'MIME type:', mimeType);
        
        // Set audio source to blob URL
        audio.src = blobUrl;
        audio.preload = 'metadata';
        
        console.log('Audio element src set to:', audio.src);
        console.log('Audio element readyState:', audio.readyState);
        
        // Wait for the audio to load
        await new Promise((resolve, reject) => {
          const handleLoadedMetadata = () => {
            console.log('Audio loaded, duration:', audio.duration);
            setActualDuration(audio.duration);
            setAudioLoaded(true);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            resolve(void 0);
          };
          
          const handleError = (e: Event) => {
            console.error('Audio loading error:', e);
            const error = audio.error;
            let errorMessage = 'Failed to load audio';
            if (error) {
              switch (error.code) {
                case error.MEDIA_ERR_ABORTED:
                  errorMessage = 'Audio loading was aborted';
                  break;
                case error.MEDIA_ERR_NETWORK:
                  errorMessage = 'Network error while loading audio';
                  break;
                case error.MEDIA_ERR_DECODE:
                  errorMessage = 'Audio format not supported or corrupted';
                  break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMessage = 'Audio format not supported by browser';
                  break;
                default:
                  errorMessage = `Audio error: ${error.message}`;
              }
            }
            setAudioError(errorMessage);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            reject(new Error('Audio loading failed'));
          };
          
          audio.addEventListener('loadedmetadata', handleLoadedMetadata);
          audio.addEventListener('error', handleError);
        });
        
      } catch (error) {
        console.error('Failed to load audio:', error);
        setAudioError(`Failed to load audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    loadAudio();
    
    // Cleanup function to revoke blob URL
    return () => {
      if (blobUrl) {
        console.log('Cleaning up blob URL:', blobUrl);
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [audioPath]);

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioLoaded) return;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        onTimeUpdate(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setActualDuration(audio.duration);
    };

    const handleCanPlay = () => {
      setAudioLoaded(true);
    };

    const handleError = (e: Event) => {
      console.error('Audio playback error:', e);
      const error = audio.error;
      setAudioError(error ? `Playback error: ${error.message}` : 'Audio playback failed');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [onTimeUpdate, isDragging, audioLoaded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isDragging) return;

    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isDragging]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !audioLoaded) {
      console.log('Audio not loaded yet');
      return;
    }

    try {
      if (isPlaying) {
        audio.pause();
        onPlayPause(false);
      } else {
        await audio.play();
        onPlayPause(true);
      }
    } catch (error) {
      console.error('Playback error:', error);
      setAudioError(`Playback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSkipBack = () => {
    const audio = audioRef.current;
    if (!audio || !audioLoaded) return;
    
    const newTime = Math.max(0, currentTime - 10);
    audio.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const handleSkipForward = () => {
    const audio = audioRef.current;
    if (!audio || !audioLoaded) return;
    
    const newTime = Math.min(actualDuration, currentTime + 10);
    audio.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const handleScrubClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audioLoaded) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newTime = percent * actualDuration;
    
    audio.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const handleScrubMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    handleScrubClick(event);
  };

  const handleScrubMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;
    
    const audio = audioRef.current;
    if (!audio || !audioLoaded) return;
    
    const scrubSlider = document.querySelector('.scrub-slider') as HTMLElement;
    if (!scrubSlider) return;
    
    const rect = scrubSlider.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const newTime = percent * actualDuration;
    
    audio.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const handleScrubMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleScrubMouseMove);
      document.addEventListener('mouseup', handleScrubMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleScrubMouseMove);
        document.removeEventListener('mouseup', handleScrubMouseUp);
      };
    }
  }, [isDragging, actualDuration, onTimeUpdate]);

  const progress = actualDuration > 0 ? (currentTime / actualDuration) * 100 : 0;

  return (
    <div className="audio-control-panel">
      <audio
        ref={audioRef}
        preload="metadata"
      />
      
      <div className="waveform-container">
        <div className="waveform-display">
          {audioError ? (
            <div style={{ color: '#ff6b4a', fontSize: '14px', textAlign: 'center' }}>
              <div>⚠️ Audio Error</div>
              <small>{audioError}</small>
            </div>
          ) : !audioLoaded ? (
            <div style={{ color: '#888', fontSize: '14px', textAlign: 'center' }}>
              <div>🔄 Loading audio...</div>
              <small>Please wait</small>
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
              <div>🎵 Audio loaded</div>
              <small>Waveform visualization coming soon...</small>
            </div>
          )}
        </div>
      </div>
      
      <div className="timeline-controls">
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(actualDuration)}</span>
        </div>
        
        <div 
          className="scrub-slider"
          onClick={handleScrubClick}
          onMouseDown={handleScrubMouseDown}
        >
          <div 
            className="scrub-progress" 
            style={{ width: `${progress}%` }}
          />
          <div 
            className="scrub-handle" 
            style={{ left: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="transport-controls">
        <div className="transport-buttons">
          <button 
            className="transport-btn"
            onClick={handleSkipBack}
            disabled={!audioLoaded}
            title="Skip back 10s"
          >
            ⏪
          </button>
          
          <button 
            className="transport-btn play"
            onClick={handlePlayPause}
            disabled={!audioLoaded}
            title={audioLoaded ? (isPlaying ? 'Pause' : 'Play') : 'Loading...'}
          >
            {!audioLoaded ? '⏳' : (isPlaying ? '⏸️' : '▶️')}
          </button>
          
          <button 
            className="transport-btn"
            onClick={handleSkipForward}
            disabled={!audioLoaded}
            title="Skip forward 10s"
          >
            ⏩
          </button>
        </div>
        
        <div className="volume-control">
          <span style={{ fontSize: '14px', color: '#888' }}>🔊</span>
          <div className="volume-slider" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            setVolume(Math.max(0, Math.min(1, percent)));
          }}>
            <div 
              className="volume-progress" 
              style={{ width: `${volume * 100}%` }}
            />
          </div>
          <span style={{ fontSize: '12px', color: '#888', fontFamily: 'monospace' }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default AudioControlPanel;