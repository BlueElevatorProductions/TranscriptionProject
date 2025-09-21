/**
 * NewProjectDialogV2 - Glass morphism project creation dialog
 *
 * Direct v2.0 implementation with:
 * - Glass morphism styling
 * - Direct ProjectData creation
 * - No legacy compatibility
 */

import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, FileText, X } from 'lucide-react';
import { ProjectData } from '../../shared/types';

export interface NewProjectDialogV2Props {
  onClose: () => void;
  onCreateProject: (projectName: string, projectPath: string) => void;
}

const NewProjectDialogV2: React.FC<NewProjectDialogV2Props> = ({
  onClose,
  onCreateProject,
}) => {
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectNameRef = useRef<HTMLInputElement>(null);

  // Focus project name input when dialog opens
  useEffect(() => {
    if (projectNameRef.current) {
      projectNameRef.current.focus();
    }
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle folder selection
  const handleSelectLocation = async () => {
    try {
      const result = await (window as any).electronAPI?.selectDirectory?.();
      if (result && !result.cancelled && result.filePath) {
        setProjectPath(result.filePath);
        setError(null);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      setError('Failed to select project location');
    }
  };

  // Handle project creation
  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    if (!projectPath) {
      setError('Project location is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Generate project file path
      const fileName = projectName.trim().replace(/[^a-zA-Z0-9\s-_]/g, '');
      const fullProjectPath = `${projectPath}/${fileName}.transcript`;

      console.log('🚀 Creating v2.0 project:', { projectName: projectName.trim(), fullProjectPath });

      // Create v2.0 ProjectData structure directly
      const projectData: ProjectData = {
        version: '2.0',
        project: {
          projectId: generateId(),
          name: projectName.trim(),
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '2.0',
          audio: null,
          transcription: {
            service: null,
            model: null,
            language: 'en',
            status: 'pending',
            completedAt: null
          },
          ui: {
            currentMode: 'transcript-edit',
            sidebarWidth: 256,
            playbackSpeed: 1.0,
            highlightColor: 'yellow'
          }
        },
        clips: [],
        speakers: {},
        metadata: {
          totalDuration: 0,
          totalWords: 0,
          clipCount: 0,
          lastEditAt: new Date().toISOString(),
          version: '2.0'
        }
      };

      // Save project via main process
      const saveResult = await (window as any).electronAPI?.saveProject?.(fullProjectPath, projectData);

      if (saveResult?.success) {
        console.log('✅ v2.0 Project created successfully');
        onCreateProject(projectName.trim(), fullProjectPath);
      } else {
        throw new Error(saveResult?.error || 'Failed to save project');
      }

    } catch (error) {
      console.error('Failed to create project:', error);
      setError(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle form submission
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    handleCreate();
  };

  return (
    <div className="dialog-overlay-v2" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-content-v2">
        <div className="dialog-v2">
          {/* Header */}
          <div className="dialog-header-v2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="dialog-title-v2">Create New Project</h2>
                  <p className="dialog-description-v2">
                    Start a new transcription project for your audio file
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="dialog-body-v2">
              <div className="space-y-6">
                {/* Project Name */}
                <div className="form-group-v2">
                  <label htmlFor="projectName" className="form-label-v2">
                    Project Name
                  </label>
                  <input
                    ref={projectNameRef}
                    id="projectName"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Enter project name..."
                    className={`input-glass ${error && !projectName.trim() ? 'error' : ''}`}
                    disabled={isCreating}
                  />
                  <p className="form-help-v2">
                    A descriptive name for your transcription project
                  </p>
                </div>

                {/* Project Location */}
                <div className="form-group-v2">
                  <label htmlFor="projectPath" className="form-label-v2">
                    Save Location
                  </label>
                  <div className="flex space-x-3">
                    <input
                      id="projectPath"
                      type="text"
                      value={projectPath}
                      placeholder="Select project folder..."
                      className={`input-glass flex-1 ${error && !projectPath ? 'error' : ''}`}
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={handleSelectLocation}
                      disabled={isCreating}
                      className="button-glass"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="form-help-v2">
                    Choose where to save your project file (.transcript)
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="error-message-v2">
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="dialog-footer-v2">
              <button
                type="button"
                onClick={onClose}
                disabled={isCreating}
                className="button-glass secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !projectName.trim() || !projectPath}
                className="button-glass primary"
              >
                {isCreating ? (
                  <div className="flex items-center space-x-2">
                    <div className="loading-spinner-v2" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Utility functions
function generateId(): string {
  return 'proj_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export default NewProjectDialogV2;