import React, { useState } from 'react';
import './ImportDialog.css';

interface ImportDialogProps {
  onClose: () => void;
  onImport: (filePath: string, modelSize: string) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ onClose, onImport }) => {
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [modelSize, setModelSize] = useState('base');
  const [error, setError] = useState('');

  const handleFileSelect = async () => {
    const result = await window.electronAPI.importAudioDialog();
    if (result.success) {
      setFilePath(result.filePath);
      setFileName(result.fileName);
      setError('');
    } else if (result.error) {
      setError(result.error);
    }
  };

  const handleImport = () => {
    if (!filePath) {
      setError('Please select an audio file.');
      return;
    }
    onImport(filePath, modelSize);
    onClose();
  };

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog">
        <h2>Import Audio & Transcribe</h2>
        <p>Select an audio file and choose a transcription model.</p>
        
        <div className="form-group">
          <label>Audio File</label>
          <div className="file-select-container">
            <input
              type="text"
              className="file-path-display"
              value={fileName || 'No file selected'}
              readOnly
            />
            <button className="browse-btn" onClick={handleFileSelect}>
              Browse...
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="model-select">Transcription Model</label>
          <select
            id="model-select"
            className="model-select"
            value={modelSize}
            onChange={(e) => setModelSize(e.target.value)}
          >
            <option value="tiny">Tiny (Fastest, lowest accuracy)</option>
            <option value="base">Base (Recommended for most users)</option>
            <option value="small">Small (More accurate, slower)</option>
            <option value="medium">Medium (High accuracy, much slower)</option>
            <option value="large">Large (Highest accuracy, very slow)</option>
          </select>
          <p className="model-description">
            Larger models are more accurate but require more processing time and memory.
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="dialog-actions">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleImport}>
            Import & Start Transcription
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
