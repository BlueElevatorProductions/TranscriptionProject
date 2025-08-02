import React, { useState } from 'react';
import './ImportDialog.css';

interface ProjectImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectLoaded: (projectData: any) => void;
}

const ProjectImportDialog: React.FC<ProjectImportDialogProps> = ({ 
  isOpen, 
  onClose, 
  onProjectLoaded 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Open file dialog for .transcript files
      const result = await window.electronAPI.openProjectDialog();
      
      if (result.canceled || !result.filePaths?.length) {
        setIsLoading(false);
        return;
      }
      
      const filePath = result.filePaths[0];
      
      // Load project file
      const projectData = await window.electronAPI.loadProject(filePath);
      
      // Success
      onProjectLoaded(projectData);
      onClose();
      
    } catch (error: any) {
      console.error('Import error:', error);
      setError(error.message || 'Failed to import project file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const transcriptFile = files.find(file => 
      file.name.endsWith('.transcript') || file.type === 'application/zip'
    );

    if (!transcriptFile) {
      setError('Please drop a .transcript project file');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Load project file from dropped file
      const projectData = await window.electronAPI.loadProject(transcriptFile.path);
      
      // Success
      onProjectLoaded(projectData);
      onClose();
      
    } catch (error: any) {
      console.error('Drop import error:', error);
      setError(error.message || 'Failed to import dropped project file');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog project-import">
        <div className="dialog-header">
          <h2>Import Transcription Project</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="dialog-content">
          <div className="import-section">
            <div 
              className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={handleFileSelect}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="drop-zone-content">
                <div className="file-icon">📁</div>
                <h3>Import Project File</h3>
                <p>Select a .transcript file to import your saved project</p>
                <p className="drag-hint">Or drag and drop a .transcript file here</p>
                <button 
                  className="primary-button browse-button" 
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileSelect();
                  }}
                >
                  {isLoading ? 'Loading...' : 'Browse Files'}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className="import-info">
              <h4>What's included in a project file:</h4>
              <ul>
                <li>Complete transcription with all edits</li>
                <li>Speaker names and assignments</li>
                <li>Audio file and clip data</li>
                <li>Your custom preferences</li>
                <li>Edit history for undo/redo</li>
              </ul>
            </div>
          </div>
          
          <div className="dialog-footer">
            <button className="secondary-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectImportDialog;