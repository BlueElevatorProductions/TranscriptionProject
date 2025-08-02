/**
 * PlaybackView - Dual-mode transcription interface (Playback + Transcript Edit)
 * Modularized from App.tsx for better organization
 */

import React, { useState } from 'react';
import PlaybackModeContainer from '../components/PlaybackMode/PlaybackModeContainer';
import TranscriptEditContainer from '../components/TranscriptEdit/TranscriptEditContainer';
import { useSelectedJob, useProject, useAudio } from '../contexts';
import { PlaybackModeType } from '../types';

interface PlaybackViewProps {
  onBack: () => void;
}

const PlaybackView: React.FC<PlaybackViewProps> = ({ onBack }) => {
  const { selectedJob } = useSelectedJob();
  const { state: projectState, actions: projectActions } = useProject();
  const { state: audioState, actions: audioActions } = useAudio();
  
  const [playbackMode, setPlaybackMode] = useState<PlaybackModeType>('playback');

  if (!selectedJob) {
    return (
      <div className="playback-view">
        <div className="error-content">
          <h2>No Transcription Selected</h2>
          <p>Please select a transcription to view in playback mode.</p>
          <button className="back-btn secondary" onClick={onBack}>
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  const handleModeSwitch = (mode: PlaybackModeType) => {
    console.log('PlaybackView - Switching to mode:', mode);
    setPlaybackMode(mode);
  };

  const handleSegmentUpdate = (updatedSegments: any[]) => {
    projectActions.updateSegments(updatedSegments);
  };

  const handleSpeakerUpdate = (updatedSpeakers: { [key: string]: string }) => {
    projectActions.updateSpeakers(updatedSpeakers);
  };

  // Legacy compatibility wrapper for audio state
  const legacyAudioStateUpdate = (updates: Partial<typeof audioState>) => {
    audioActions.updateAudioState(updates);
  };

  return (
    <div className="playback-view">
      {/* Mode Switcher Header */}
      <div className="playback-container">
        <div className="mode-switcher">
          <button 
            className={playbackMode === 'playback' ? 'active' : ''}
            onClick={() => handleModeSwitch('playback')}
          >
            🎵 Playback Mode
          </button>
          <button 
            className={playbackMode === 'transcript-edit' ? 'active' : ''}
            onClick={() => handleModeSwitch('transcript-edit')}
          >
            ✏️ Transcript Edit
          </button>
        </div>

        {/* Mode Content */}
        <div className="mode-content">
          {playbackMode === 'playback' ? (
            <PlaybackModeContainer
              transcriptionJob={selectedJob}
              editedSegments={projectState.editedSegments}
              speakers={projectState.globalSpeakers}
              onSpeakersUpdate={handleSpeakerUpdate}
              onBack={onBack}
              onSwitchToTranscriptEdit={() => handleModeSwitch('transcript-edit')}
              sharedAudioState={{
                currentTime: audioState.currentTime,
                isPlaying: audioState.isPlaying,
                volume: audioState.volume,
                playbackSpeed: audioState.playbackSpeed,
              }}
              onAudioStateUpdate={legacyAudioStateUpdate}
            />
          ) : (
            <TranscriptEditContainer
              transcriptionJob={selectedJob}
              editedSegments={projectState.editedSegments}
              onEditedSegmentsUpdate={handleSegmentUpdate}
              speakers={projectState.globalSpeakers}
              onSpeakersUpdate={handleSpeakerUpdate}
              onBack={onBack}
              onSwitchToPlayback={() => handleModeSwitch('playback')}
              sharedAudioState={{
                currentTime: audioState.currentTime,
                isPlaying: audioState.isPlaying,
                volume: audioState.volume,
                playbackSpeed: audioState.playbackSpeed,
              }}
              onAudioStateUpdate={legacyAudioStateUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaybackView;