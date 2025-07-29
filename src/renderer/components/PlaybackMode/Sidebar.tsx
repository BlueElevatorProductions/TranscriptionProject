import React from 'react';
import { useAudioPlayer } from './useAudioPlayer';
import { Clip } from './useClips';

interface Speaker {
  id: string;
  name: string;
  totalTime: number;
  color: string;
}

interface SidebarProps {
  speakers: Speaker[];
  segments: any[];
  clips: Clip[];
  selectedClipId: string | null;
  onClipSelect: (clipId: string) => void;
  activeTab: 'speakers' | 'segments';
  onTabChange: (tab: 'speakers' | 'segments') => void;
  currentTime: number;
  onTimeSeek: (time: number) => void;
  editingSpeakerId: string | null;
  tempSpeakerName: string;
  onSpeakerEdit: (speakerId: string, currentName: string) => void;
  onSpeakerSave: (speakerId: string) => void;
  onSpeakerCancel: () => void;
  onTempNameChange: (name: string) => void;
  audioPath: string;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onPlayPause: (playing: boolean) => void;
  duration: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  speakers,
  segments,
  clips,
  selectedClipId,
  onClipSelect,
  activeTab,
  onTabChange,
  currentTime,
  onTimeSeek,
  editingSpeakerId,
  tempSpeakerName,
  onSpeakerEdit,
  onSpeakerSave,
  onSpeakerCancel,
  onTempNameChange,
  audioPath,
  isPlaying,
  onTimeUpdate,
  onPlayPause,
  duration
}) => {
  // Audio player hook
  const {
    audioRef,
    audioLoaded,
    audioError,
    actualDuration,
    handlePlayPause: audioHandlePlayPause,
    handleTimelineClick,
    volume,
    setVolume
  } = useAudioPlayer({
    audioPath,
    currentTime,
    isPlaying,
    onTimeUpdate,
    onPlayPause
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const remainingSecs = Math.round(seconds % 60);
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`;
  };

  // Generate segment analysis for segments tab
  const segmentTypes = [
    { type: 'all', label: 'All', count: segments.length },
    { type: 'long-pauses', label: 'Long Pauses', count: 0 }, // TODO: implement detection
    { type: 'filler-words', label: 'Filler Words', count: 0 }, // TODO: implement detection
    { type: 'highlights', label: 'Highlights', count: 0 } // TODO: implement detection
  ];

  const handleSpeakerClick = (speaker: Speaker) => {
    // Find first segment by this speaker
    const firstSegment = segments.find(s => s.speaker === speaker.id);
    if (firstSegment) {
      onTimeSeek(firstSegment.start);
    }
  };

  const handleSegmentJump = (segment: any) => {
    onTimeSeek(segment.start);
  };

  // Clip navigation functions
  const skipToNextClip = () => {
    if (!clips || clips.length === 0) return;
    
    // Find current clip based on time
    const currentClipIndex = clips.findIndex(clip => 
      currentTime >= clip.startTime && currentTime <= clip.endTime
    );
    
    const nextClip = clips[currentClipIndex + 1];
    if (nextClip) {
      onTimeSeek(nextClip.startTime);
      onClipSelect(nextClip.id);
      
      // Auto-play if currently playing
      const audio = audioRef.current;
      if (audio && audioLoaded && !isPlaying) {
        audio.play();
        onPlayPause(true);
      }
    }
  };

  const skipToPreviousClip = () => {
    if (!clips || clips.length === 0) return;
    
    // Find current clip based on time
    const currentClipIndex = clips.findIndex(clip => 
      currentTime >= clip.startTime && currentTime <= clip.endTime
    );
    
    const prevClip = clips[currentClipIndex - 1];
    if (prevClip) {
      onTimeSeek(prevClip.startTime);
      onClipSelect(prevClip.id);
      
      // Auto-play if currently playing
      const audio = audioRef.current;
      if (audio && audioLoaded && !isPlaying) {
        audio.play();
        onPlayPause(true);
      }
    }
  };

  const handleSpeakerKeyDown = (event: React.KeyboardEvent, speakerId: string, speakerName: string) => {
    switch (event.key) {
      case 'Enter':
      case 'F2':
        event.preventDefault();
        onSpeakerEdit(speakerId, speakerName);
        break;
      case 'Escape':
        if (editingSpeakerId === speakerId) {
          event.preventDefault();
          onSpeakerCancel();
        }
        break;
    }
  };

  const handleNameInputKeyDown = (event: React.KeyboardEvent, speakerId: string) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        onSpeakerSave(speakerId);
        break;
      case 'Escape':
        event.preventDefault();
        onSpeakerCancel();
        break;
    }
  };

  return (
    <div className="right-sidebar">
      {/* Section 1: Speakers */}
      <div className="speakers-section">
        <h3 className="section-title">Speakers</h3>
        <div className="speakers-list">
          {speakers.map((speaker) => {
            const isEditing = editingSpeakerId === speaker.id;
            
            return (
              <div
                key={speaker.id}
                className={`speaker-item ${isEditing ? 'editing' : ''}`}
                tabIndex={0}
                onKeyDown={(e) => handleSpeakerKeyDown(e, speaker.id, speaker.name)}
                role="button"
                aria-label={`Speaker ${speaker.name}, ${formatDuration(speaker.totalTime)} speaking time`}
              >
                <div className="speaker-bullet">•</div>
                <div className="speaker-info">
                  {isEditing ? (
                    <input
                      className="speaker-name-input"
                      value={tempSpeakerName}
                      onChange={(e) => onTempNameChange(e.target.value)}
                      onKeyDown={(e) => handleNameInputKeyDown(e, speaker.id)}
                      onBlur={() => onSpeakerSave(speaker.id)}
                      placeholder="Enter speaker name"
                      autoFocus
                      aria-label="Edit speaker name"
                    />
                  ) : (
                    <div 
                      className="speaker-name"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpeakerEdit(speaker.id, speaker.name);
                      }}
                      title="Click to edit speaker name"
                      role="textbox"
                      aria-readonly="true"
                    >
                      {speaker.name}
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <div 
                    className="speaker-jump-btn"
                    onClick={() => handleSpeakerClick(speaker)}
                    title={`Click to jump to ${speaker.name}'s first segment`}
                  >
                    ↗
                  </div>
                )}
              </div>
            );
          })}
          
          {speakers.length === 0 && (
            <div className="loading">
              No speakers detected
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Clips */}
      <div className="clips-section">
        <h3 className="section-title">Clips ({clips.length})</h3>
        <div className="clips-list">
          {clips.map((clip, index) => {
            const isSelected = selectedClipId === clip.id;
            const isNearCurrent = Math.abs(currentTime - clip.startTime) < 5;
            
            return (
              <div
                key={clip.id}
                className={`clip-item ${isSelected ? 'selected' : ''} ${isNearCurrent ? 'near-current' : ''}`}
                onClick={() => {
                  onClipSelect(clip.id);
                  onTimeSeek(clip.startTime);
                }}
                title={`Click to navigate to clip at ${formatTime(clip.startTime)}`}
              >
                <div className="clip-header">
                  <div className="clip-time">
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </div>
                  <div className="clip-type-indicator">
                    {clip.type === 'speaker-change' && '🔄'}
                    {clip.type === 'paragraph-break' && '¶'}
                    {clip.type === 'user-created' && '✂️'}
                  </div>
                </div>
                
                <div className="clip-speaker">
                  <span className="speaker-bullet">•</span>
                  {clip.speaker}
                </div>
                
                <div className="clip-text-preview">
                  {clip.text.length > 120 ? `${clip.text.substring(0, 120)}...` : clip.text}
                </div>
                
                <div className="clip-metadata">
                  <span className="clip-duration">{formatDuration(clip.duration)}</span>
                  <span className="clip-word-count">{clip.words.length} words</span>
                </div>
              </div>
            );
          })}
          
          {clips.length === 0 && (
            <div className="loading">
              No clips available
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Playback Controls */}
      <div className="playback-section">
        <audio
          ref={audioRef}
          preload="metadata"
        />
        
        <h3 className="section-title">Playback</h3>
        
        {audioError && (
          <div className="audio-error">
            ⚠️ {audioError}
          </div>
        )}
        
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(actualDuration || duration)}</span>
        </div>
        
        <div 
          className="timeline-slider"
          onClick={handleTimelineClick}
        >
          <div 
            className="timeline-progress" 
            style={{ width: `${(actualDuration > 0 ? (currentTime / actualDuration) : (currentTime / duration)) * 100}%` }}
          />
        </div>
        
        <div className="transport-controls">
          <button 
            className="transport-btn" 
            disabled={!audioLoaded || clips.length === 0}
            onClick={skipToPreviousClip}
            title="Previous Clip"
          >
            ⏮
          </button>
          <button 
            className="transport-btn" 
            disabled={!audioLoaded}
            onClick={() => {
              const audio = audioRef.current;
              if (audio && audioLoaded) {
                const newTime = Math.max(0, currentTime - 10);
                audio.currentTime = newTime;
                onTimeUpdate(newTime);
              }
            }}
            title="Skip back 10 seconds"
          >
            ⏪
          </button>
          <button 
            className="transport-btn play-btn"
            onClick={audioHandlePlayPause}
            disabled={!audioLoaded}
            title={audioLoaded ? (isPlaying ? 'Pause' : 'Play') : 'Loading...'}
          >
            {!audioLoaded ? '⏳' : (isPlaying ? '⏸' : '▶')}
          </button>
          <button 
            className="transport-btn" 
            disabled={!audioLoaded}
            onClick={() => {
              const audio = audioRef.current;
              if (audio && audioLoaded) {
                const newTime = Math.min(actualDuration || duration, currentTime + 10);
                audio.currentTime = newTime;
                onTimeUpdate(newTime);
              }
            }}
            title="Skip forward 10 seconds"
          >
            ⏩
          </button>
          <button 
            className="transport-btn" 
            disabled={!audioLoaded || clips.length === 0}
            onClick={skipToNextClip}
            title="Next Clip"
          >
            ⏭
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;