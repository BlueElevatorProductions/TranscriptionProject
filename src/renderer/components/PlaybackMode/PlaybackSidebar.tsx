import React, { useState } from 'react';

interface Speaker {
  id: string;
  name: string;
  segments: any[];
  totalDuration: number;
}

interface PlaybackSidebarProps {
  speakers: Speaker[];
  currentTime: number;
  onTimeSeek: (time: number) => void;
  onSpeakerEdit: (speakerId: string, newName: string) => void;
  audioPath: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  duration: number;
}

const PlaybackSidebar: React.FC<PlaybackSidebarProps> = ({
  speakers,
  currentTime,
  onTimeSeek,
  onSpeakerEdit,
  audioPath,
  isPlaying,
  onPlayPause,
  duration
}) => {
  const [volume, setVolume] = useState(0.7);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleSpeakerEdit = (speakerId: string, currentName: string) => {
    setEditingSpeaker(speakerId);
    setTempName(currentName);
  };

  const handleSpeakerSave = (speakerId: string) => {
    if (tempName.trim()) {
      onSpeakerEdit(speakerId, tempName.trim());
    }
    setEditingSpeaker(null);
    setTempName('');
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    // TODO: Connect to audio player
    console.log('Volume changed to:', newVolume);
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    // TODO: Connect to audio player
    console.log('Speed changed to:', newSpeed);
  };

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 10);
    onTimeSeek(newTime);
  };

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 10);
    onTimeSeek(newTime);
  };

  return (
    <div className="playback-sidebar">
      {/* Audio Controls */}
      <div className="playback-section">
        <h3 className="section-title">Audio Controls</h3>
        
        {/* Progress Bar */}
        <div className="progress-container">
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div 
            className="progress-bar"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              onTimeSeek(percent * duration);
            }}
          >
            <div 
              className="progress-fill"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* Transport Controls */}
        <div className="transport-controls">
          <button className="control-button" onClick={handleSkipBack}>
            ⏪
          </button>
          <button className="control-button play-pause" onClick={onPlayPause}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button className="control-button" onClick={handleSkipForward}>
            ⏩
          </button>
        </div>

        {/* Volume Control */}
        <div className="volume-control">
          <span className="control-label">Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="volume-slider"
          />
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </div>

        {/* Speed Control */}
        <div className="speed-control">
          <span className="control-label">Speed</span>
          <button className="speed-button" onClick={handleSpeedChange}>
            {playbackSpeed}×
          </button>
        </div>
      </div>

      {/* Speakers */}
      <div className="speakers-section">
        <h3 className="section-title">Speakers</h3>
        <div className="speakers-list">
          {speakers.map(speaker => (
            <div key={speaker.id} className="speaker-item">
              <div className="speaker-info">
                {editingSpeaker === speaker.id ? (
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => handleSpeakerSave(speaker.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSpeakerSave(speaker.id);
                      } else if (e.key === 'Escape') {
                        setEditingSpeaker(null);
                      }
                    }}
                    className="speaker-name-input"
                    autoFocus
                  />
                ) : (
                  <span 
                    className="speaker-name clickable"
                    onClick={() => handleSpeakerEdit(speaker.id, speaker.name)}
                  >
                    {speaker.name}
                  </span>
                )}
                <div className="speaker-stats">
                  {formatDuration(speaker.totalDuration)} • {speaker.segments.length} segments
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PlaybackSidebar;