import React, { useState } from 'react';
import './SaveButton.css';

interface SaveButtonProps {
  onSave: () => Promise<void>;
  hasUnsavedChanges: boolean;
  projectName?: string;
  className?: string;
  disabled?: boolean;
}

const SaveButton: React.FC<SaveButtonProps> = ({ 
  onSave, 
  hasUnsavedChanges, 
  projectName,
  className = '',
  disabled = false
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await onSave();
    } catch (error: any) {
      console.error('Save error:', error);
      setSaveError(error.message || 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const getButtonText = () => {
    if (isSaving) return 'Saving...';
    if (saveError) return 'Save Failed';
    if (hasUnsavedChanges) return 'Save';
    return 'Saved';
  };

  const getButtonIcon = () => {
    if (isSaving) return '⏳';
    if (saveError) return '❌';
    if (hasUnsavedChanges) return '💾';
    return '✅';
  };

  const getTooltipText = () => {
    if (saveError) return `Save failed: ${saveError}`;
    if (hasUnsavedChanges) return `Save ${projectName || 'project'} (⌘S)`;
    return 'All changes saved';
  };

  return (
    <div className="save-button-container">
      <button
        className={`save-button ${hasUnsavedChanges ? 'has-changes' : ''} ${saveError ? 'error' : ''} ${className}`}
        onClick={handleSave}
        disabled={isSaving || disabled}
        title={getTooltipText()}
      >
        <span className="save-icon">
          {getButtonIcon()}
        </span>
        <span className="save-text">
          {getButtonText()}
        </span>
      </button>
      
      {saveError && (
        <div className="save-error-tooltip">
          <span>{saveError}</span>
          <button 
            className="retry-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default SaveButton;