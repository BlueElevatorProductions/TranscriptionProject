import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import PlaybackModeContainer from './components/PlaybackMode/PlaybackModeContainer';
import TranscriptEditContainer from './components/TranscriptEdit/TranscriptEditContainer';
import SpeakerIdentification from './components/SpeakerIdentification/SpeakerIdentification';
import ImportDialog from './components/ImportDialog/ImportDialog';
import ProjectImportDialog from './components/ImportDialog/ProjectImportDialog';
import ApiSettings from './components/Settings/ApiSettings';
import BottomAudioPlayer from './components/shared/BottomAudioPlayer';
import SaveButton from './components/shared/SaveButton';

interface TranscriptionJob {
  id: string;
  filePath: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
  speakerNames?: { [key: string]: string };
  speakerMerges?: { [key: string]: string };
}

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('1.0.0');
  const [platform, setPlatform] = useState<string>('unknown');
  const [transcriptionJobs, setTranscriptionJobs] = useState<TranscriptionJob[]>([]);
  
  // Simple state management for polling approach
  const [currentView, setCurrentView] = useState<'home' | 'transcription-progress' | 'speaker-identification' | 'playback'>('home');
  const [selectedJob, setSelectedJob] = useState<TranscriptionJob | null>(null);
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [showProjectImportDialog, setShowProjectImportDialog] = useState<boolean>(false);
  const [showApiSettings, setShowApiSettings] = useState<boolean>(false);
  
  // Project file management state
  const [projectData, setProjectData] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
  const [currentApiKeys, setCurrentApiKeys] = useState<{ [service: string]: string }>({});
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState({
    fileName: '',
    progress: 0,
    status: 'Starting...'
  });
  
  // Mode switching state
  const [playbackMode, setPlaybackMode] = useState<'playback' | 'transcript-edit'>('playback');
  
  // Shared speaker state management
  const [globalSpeakers, setGlobalSpeakers] = useState<{[key: string]: string}>({});
  
  // Shared audio state management
  const [sharedAudioState, setSharedAudioState] = useState({
    currentTime: 0,
    isPlaying: false,
    volume: 0.7,
    playbackSpeed: 1.0
  });
  
  // Shared edited segments state management
  const [editedSegments, setEditedSegments] = useState<any[]>([]);
  
  // Audio source management
  const currentAudioPath = selectedJob ? selectedJob.filePath : null;

  // Project file management functions (defined early to avoid dependency issues)
  const handleSave = useCallback(async () => {
    if (!selectedJob || !projectData) {
      console.log('No project data to save');
      return;
    }

    try {
      // Prepare project data for saving
      const saveData = {
        project: {
          ...projectData.project,
          lastModified: new Date().toISOString(),
          transcription: {
            ...projectData.project.transcription,
            status: 'completed'
          },
          ui: {
            currentMode: playbackMode,
            sidebarWidth: 300,
            playbackSpeed: sharedAudioState.playbackSpeed,
            volume: sharedAudioState.volume,
            currentTime: sharedAudioState.currentTime,
            selectedSegmentId: null
          }
        },
        transcription: {
          version: '1.0',
          segments: editedSegments,
          speakers: globalSpeakers,
          globalMetadata: {
            totalSegments: editedSegments.length,
            totalWords: editedSegments.reduce((sum, seg) => sum + (seg.words?.length || 0), 0),
            averageConfidence: 0.95,
            processingTime: 0,
            editCount: 0
          }
        },
        speakers: {
          version: '1.0',
          speakers: globalSpeakers,
          speakerMappings: globalSpeakers,
          defaultSpeaker: 'SPEAKER_00'
        },
        clips: {
          version: '1.0',
          clips: [],
          clipSettings: {
            defaultDuration: 30.0,
            autoExport: false,
            exportFormat: 'mp3'
          }
        }
      };

      let filePath = currentProjectPath;
      
      if (!filePath) {
        // Show save dialog for new projects
        const result = await (window as any).electronAPI.saveProjectDialog(
          `${projectData.project.name || 'Untitled'}.transcript`
        );
        
        if (result.canceled || !result.filePath) {
          return;
        }
        
        filePath = result.filePath;
        setCurrentProjectPath(filePath);
      }

      // Save project file
      await (window as any).electronAPI.saveProject(saveData, filePath);
      
      setHasUnsavedChanges(false);
      console.log('Project saved successfully');
      
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  }, [selectedJob, projectData, currentProjectPath, playbackMode, sharedAudioState, editedSegments, globalSpeakers]);

  const handleProjectLoaded = useCallback((loadedProjectData: any) => {
    console.log('Project loaded:', loadedProjectData);
    setProjectData(loadedProjectData);
    
    // Convert loaded project to transcription job format
    setSelectedJob({
      id: loadedProjectData.project.projectId,
      filePath: loadedProjectData.project.audio?.originalFile || '',
      fileName: loadedProjectData.project.audio?.originalName || loadedProjectData.project.name,
      status: 'completed',
      progress: 100,
      result: loadedProjectData.transcription,
      speakerNames: loadedProjectData.speakers?.speakerMappings || loadedProjectData.speakers?.speakers || {}
    });
    
    // Set up speakers and segments
    setGlobalSpeakers(loadedProjectData.speakers?.speakerMappings || loadedProjectData.speakers?.speakers || {});
    setEditedSegments(loadedProjectData.transcription?.segments || []);
    
    setHasUnsavedChanges(false);
    setCurrentProjectPath(null); // Will be set when user saves
    setCurrentView('playback');
  }, []);
    
  // Debug logging for audio player visibility
  useEffect(() => {
    console.log('App - Debug audio player visibility:', {
      selectedJob: !!selectedJob,
      currentView,
      currentAudioPath,
      shouldShowPlayer: selectedJob && currentView === 'playback',
      selectedJobDetails: selectedJob ? {
        fileName: selectedJob.fileName,
        filePath: selectedJob.filePath,
        id: selectedJob.id,
        status: selectedJob.status
      } : null
    });
  }, [selectedJob, currentView, currentAudioPath]);

  // Sync speakers when selected job changes
  useEffect(() => {
    if (selectedJob?.speakerNames) {
      console.log('Loading speakers from job:', selectedJob.speakerNames);
      setGlobalSpeakers(selectedJob.speakerNames);
    }
  }, [selectedJob]);

  // Keyboard shortcuts for project file system (moved after handleSave is defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        setShowProjectImportDialog(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]); // Now properly depends on handleSave

  // Track changes to set unsaved changes indicator
  useEffect(() => {
    if (selectedJob && projectData) {
      setHasUnsavedChanges(true);
    }
  }, [editedSegments, globalSpeakers, selectedJob, projectData]);

  // Test return for debugging
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>🎙️ TranscriptionProject (Fixed Version)</h1>
      <p>This is a fixed version with proper dependency management.</p>
      <div style={{ 
        background: '#f0f0f0', 
        padding: '20px', 
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h2>Fixed App Loading Test</h2>
        <p>The dependency issues in useCallback and useEffect have been resolved.</p>
        <p>Current view: {currentView}</p>
        <p>Has project data: {projectData ? 'Yes' : 'No'}</p>
        <p>Has unsaved changes: {hasUnsavedChanges ? 'Yes' : 'No'}</p>
        <button onClick={() => alert('Button works!')}>
          Test Button
        </button>
      </div>
    </div>
  );
};

export default App;