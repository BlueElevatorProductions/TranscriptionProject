/**
 * PlaybackView - Dual-mode transcription interface (Playback + Transcript Edit)
 * Modularized from App.tsx for better organization
 */

import React, { useState } from 'react';
import PlaybackModeContainer from '../components/PlaybackMode/PlaybackModeContainer';
import TranscriptEditContainer from '../components/TranscriptEdit/TranscriptEditContainer';
import { useSelectedJob, useProject, useAudio } from '../contexts';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PlaybackModeType } from '../types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Play, Edit, Headphones } from 'lucide-react';

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

  // Cycle through modes when Tab is pressed
  const cycleModes = () => {
    const modes: PlaybackModeType[] = ['playback', 'transcript-edit']; // audio-edit is disabled
    const currentIndex = modes.indexOf(playbackMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    handleModeSwitch(modes[nextIndex]);
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

  // Global keyboard shortcuts for the entire PlaybackView
  useKeyboardShortcuts({
    onSwitchMode: cycleModes,
    onPlayPause: () => {
      audioActions.updateAudioState({ isPlaying: !audioState.isPlaying });
    },
    onSave: () => {
      projectActions.saveProject().catch(console.error);
    },
    onPrint: () => {
      // TODO: Implement print transcript functionality
      console.log('Print transcript keyboard shortcut pressed');
    },
    onNew: () => {
      // TODO: Implement new project functionality
      console.log('New project keyboard shortcut pressed');
    },
    onEscape: () => {
      // TODO: Implement escape functionality (close panels/modals)
      console.log('Escape keyboard shortcut pressed');
    }
  });

  return (
    <div className="min-h-screen text-foreground">
      <Tabs 
        value={playbackMode} 
        onValueChange={(value) => handleModeSwitch(value as PlaybackModeType)}
        className="w-full h-full"
      >
        {/* Tab Headers */}
        <div className="bg-card border-b border-border px-6 py-2">
          <TabsList className="grid w-fit grid-cols-3">
            <TabsTrigger value="playback" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Playback
            </TabsTrigger>
            <TabsTrigger value="transcript-edit" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Transcript Edit  
            </TabsTrigger>
            <TabsTrigger value="audio-edit" className="flex items-center gap-2" disabled>
              <Headphones className="h-4 w-4" />
              Audio Edit
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents */}
        <TabsContent value="playback" className="mt-0 flex-1">
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
            onSave={projectActions.saveProject}
          />
        </TabsContent>

        <TabsContent value="transcript-edit" className="mt-0 flex-1">
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
            onSave={projectActions.saveProject}
          />
        </TabsContent>

        <TabsContent value="audio-edit" className="mt-0 flex-1">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Headphones className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Audio Edit Mode</h3>
              <p>Coming Soon</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlaybackView;