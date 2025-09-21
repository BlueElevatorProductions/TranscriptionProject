/**
 * NewUIShell v2.0 - Main UI layout using v2.0 architecture
 *
 * Simplified UI that integrates with:
 * - ProjectContextV2 (thin cache to main process)
 * - Segment-based data model
 * - Atomic edit operations
 */

import React, { useState, useEffect } from 'react';
import { FileText, FolderOpen, Save, Settings, Upload } from 'lucide-react';
import { useProjectV2 } from '../../contexts/ProjectContextV2';
import { useNotifications } from '../../contexts';
import LexicalTranscriptEditorV2 from '../../editor/LexicalTranscriptEditorV2';

export interface NewUIShellV2Props {
  onManualSave?: () => void;
}

const NewUIShellV2: React.FC<NewUIShellV2Props> = ({ onManualSave }) => {
  const { state: projectState, actions: projectActions } = useProjectV2();
  const { addToast } = useNotifications() as any;
  const [activePanel, setActivePanel] = useState<string>('transcript');

  // Initialize v2.0 system
  useEffect(() => {
    console.log('🚀 NewUIShell v2.0 initialized');
    console.log('Project state:', projectState);
  }, []);

  // Handle save action
  const handleSave = async () => {
    try {
      console.log('💾 Saving project via v2.0...');
      // In v2.0, save operations go through main process
      await projectActions.saveProject();
      onManualSave?.();
      addToast?.({
        type: 'success',
        title: 'Project Saved',
        message: 'Your project has been saved successfully.',
      });
    } catch (error) {
      console.error('Save failed:', error);
      addToast?.({
        type: 'error',
        title: 'Save Failed',
        message: error instanceof Error ? error.message : 'Failed to save project',
      });
    }
  };

  // Handle new project
  const handleNewProject = () => {
    console.log('📄 Creating new project...');
    window.dispatchEvent(new CustomEvent('open-new-project'));
  };

  // Handle open project
  const handleOpenProject = () => {
    console.log('📂 Opening project...');
    window.dispatchEvent(new CustomEvent('open-project-import'));
  };

  // Handle import audio
  const handleImportAudio = () => {
    console.log('🎵 Importing audio...');
    window.dispatchEvent(new CustomEvent('open-import-audio'));
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <div className="h-11 bg-card border-b border-border flex items-center justify-between px-4 drag-region">
        <div className="flex items-center space-x-4 no-drag">
          <button
            onClick={handleNewProject}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <FileText size={16} />
            <span className="text-sm">New</span>
          </button>
          <button
            onClick={handleOpenProject}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <FolderOpen size={16} />
            <span className="text-sm">Open</span>
          </button>
          <button
            onClick={handleImportAudio}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Upload size={16} />
            <span className="text-sm">Import Audio</span>
          </button>
          <button
            onClick={handleSave}
            disabled={!projectState.hasUnsavedChanges}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            <span className="text-sm">Save</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 no-drag">
          <span className="text-sm text-muted-foreground">
            TranscriptionProject v2.0
          </span>
          {projectState.hasUnsavedChanges && (
            <span className="text-xs text-orange-500">• Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border flex flex-col">
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Project</h2>

            {/* Panel Navigation */}
            <nav className="space-y-1">
              <button
                onClick={() => setActivePanel('transcript')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  activePanel === 'transcript'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <FileText size={16} className="inline mr-2" />
                Transcript
              </button>
              <button
                onClick={() => setActivePanel('settings')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  activePanel === 'settings'
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Settings size={16} className="inline mr-2" />
                Settings
              </button>
            </nav>
          </div>

          {/* Transcription Progress */}
          {projectState.isTranscribing && projectState.currentTranscriptionJob && (
            <div className="p-4 border-t border-border">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Transcribing</span>
                  <span className="text-xs text-muted-foreground">
                    {projectState.currentTranscriptionJob.progress}%
                  </span>
                </div>

                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${projectState.currentTranscriptionJob.progress}%` }}
                  />
                </div>

                <div className="text-xs text-muted-foreground">
                  <div>File: {projectState.currentTranscriptionJob.fileName}</div>
                  <div>Status: {projectState.currentTranscriptionJob.status}</div>
                  {projectState.currentTranscriptionJob.error && (
                    <div className="text-destructive mt-1">
                      Error: {projectState.currentTranscriptionJob.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Project Info */}
          <div className="mt-auto p-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              <div>Clips: {projectState.clips.length}</div>
              <div>Status: {projectState.isLoading ? 'Loading...' : 'Ready'}</div>
              {projectState.error && (
                <div className="text-destructive mt-1">
                  Error: {projectState.error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col">
          {activePanel === 'transcript' && (
            <div className="flex-1 p-6">
              <h1 className="text-2xl font-bold mb-4">Transcript Editor</h1>

              {projectState.clips.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-center">
                  <div>
                    <FileText size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-medium mb-2">No transcript loaded</h3>
                    <p className="text-muted-foreground mb-4">
                      Import an audio file to get started with transcription.
                    </p>
                    <button
                      onClick={handleNewProject}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Create New Project
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    {projectState.clips.length} clips loaded
                  </div>

                  {/* v2.0 Transcript Editor */}
                  <LexicalTranscriptEditorV2
                    mode="edit"
                    className="min-h-[400px]"
                    onWordClick={(clipId, segmentIndex) => {
                      console.log('Word clicked in editor:', { clipId, segmentIndex });
                    }}
                    onOperationComplete={(operationType, success) => {
                      console.log('Edit operation completed:', { operationType, success });
                      if (success) {
                        addToast?.({
                          type: 'success',
                          title: 'Edit Applied',
                          message: `${operationType} completed successfully.`,
                        });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {activePanel === 'settings' && (
            <div className="flex-1 p-6">
              <h1 className="text-2xl font-bold mb-4">Settings</h1>
              <div className="space-y-4">
                <div className="border border-border rounded-md p-4">
                  <h3 className="text-lg font-medium mb-2">v2.0 Architecture</h3>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <div>• Main process authority: {projectState.isConnected ? '✅' : '❌'}</div>
                    <div>• Segment-based data model: ✅</div>
                    <div>• Atomic edit operations: ✅</div>
                    <div>• Clean JUCE integration: ✅</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewUIShellV2;