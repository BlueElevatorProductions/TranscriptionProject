/**
 * New Project Dialog - Prompts user for project name and location
 * Creates a new .transcript project file and starts the transcription workflow
 */

import React, { useState, useCallback, useRef } from 'react';
import './NewProjectDialog.css';
import '../Modals/Modal.css';

export interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectName: string, projectPath: string) => void;
}

const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setProjectName('');
      setProjectPath('');
      setError(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleSelectLocation = useCallback(async () => {
    try {
      const result = await (window as any).electronAPI?.selectDirectory?.();
      if (result && !result.cancelled && result.filePath) {
        setProjectPath(result.filePath);
        setError(null);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      setError('Failed to select directory. Please try again.');
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    if (!projectPath) {
      setError('Please select a location for your project');
      return;
    }

    // Validate project name (no invalid characters)
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(projectName)) {
      setError('Project name contains invalid characters');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Create the full project file path
      const sanitizedName = projectName.trim().replace(/\s+/g, '_');
      const fullProjectPath = `${projectPath}/${sanitizedName}.transcript`;
      
      onCreateProject(projectName.trim(), fullProjectPath);
    } catch (error) {
      console.error('Failed to create project:', error);
      setError('Failed to create project. Please try again.');
      setIsCreating(false);
    }
  }, [projectName, projectPath, onCreateProject]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isCreating) {
      handleCreate();
    } else if (event.key === 'Escape') {
      onClose();
    }
  }, [handleCreate, onClose, isCreating]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div 
        className="new-project-dialog"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="dialog-header">
          <h2>Create New Project</h2>
          <button 
            className="close-btn"
            onClick={onClose}
            disabled={isCreating}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="dialog-content">
          <div className="form-group">
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name..."
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="project-location">Project Location</label>
            <div className="location-input">
              <input
                id="project-location"
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="Select where to save your project..."
                disabled={isCreating}
                readOnly
              />
              <button
                type="button"
                className="browse-btn"
                onClick={handleSelectLocation}
                disabled={isCreating}
              >
                Browse
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="preview-info">
            {projectName && projectPath && (
              <div className="project-preview">
                <strong>Project will be saved as:</strong>
                <code>{projectPath}/{projectName.trim().replace(/\s+/g, '_')}.transcript</code>
              </div>
            )}
          </div>
        </div>

        <div className="dialog-actions">
          <button
            className="cancel-btn secondary"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="create-btn primary"
            onClick={handleCreate}
            disabled={isCreating || !projectName.trim() || !projectPath}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewProjectDialog;