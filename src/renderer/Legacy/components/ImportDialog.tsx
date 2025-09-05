import React, { useState, useEffect } from 'react';
import './ImportDialog.css';

interface ImportDialogProps {
  onClose: () => void;
  onImport: (filePath: string, modelSize: string) => void;
  onOpenApiSettings: () => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ onClose, onImport, onOpenApiSettings }) => {
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedModel, setSelectedModel] = useState('base');
  const [selectedProvider, setSelectedProvider] = useState<'local' | 'cloud'>('local');
  const [error, setError] = useState('');
  const [apiKeys, setApiKeys] = useState<{[key: string]: string}>({});
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);

  const handleFileSelect = async () => {
    const result = await window.electronAPI.importAudioDialog();
    if (result.success) {
      setFilePath(result.filePath || '');
      setFileName(result.fileName || '');
      setError('');
    } else {
      setError('Failed to select file');
    }
  };

  // Load API keys on component mount
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const keys = await window.electronAPI.getApiKeys();
        setApiKeys(keys);
      } catch (error) {
        console.error('Failed to load API keys:', error);
      } finally {
        setIsLoadingKeys(false);
      }
    };
    loadApiKeys();
  }, []);
  
  // Check if Start Transcription should be enabled
  const canStartTranscription = () => {
    if (selectedProvider === 'local') {
      return true; // Local models always available
    }
    
    // For cloud models, check if required API key exists
    if (selectedModel === 'cloud-openai') {
      return apiKeys.openai && apiKeys.openai.trim() !== '';
    }
    if (selectedModel === 'cloud-assemblyai') {
      return apiKeys.assemblyai && apiKeys.assemblyai.trim() !== '';
    }
    if (selectedModel === 'cloud-revai') {
      return apiKeys.revai && apiKeys.revai.trim() !== '';
    }
    
    return false;
  };

  const handleImport = () => {
    if (!filePath) {
      setError('Please select an audio file.');
      return;
    }
    
    if (!canStartTranscription()) {
      setError('Cloud transcription requires API keys. Please configure them first.');
      return;
    }
    
    // For local models, don't add prefix; for cloud models, keep the cloud- prefix
    const modelToSend = selectedProvider === 'local' ? selectedModel : selectedModel;
    onImport(filePath, modelToSend);
    onClose();
  };

  const handleProviderChange = (provider: 'local' | 'cloud') => {
    setSelectedProvider(provider);
    // Reset model selection when switching providers
    if (provider === 'local') {
      setSelectedModel('base');
    } else {
      setSelectedModel('cloud-openai');
    }
  };

  const handleApiSettingsClick = () => {
    onOpenApiSettings();
  };

  return (
    <div className="import-dialog-overlay">
      <div className="import-dialog enhanced">
        <h2>Choose Transcription Method</h2>
        <p>Select an audio file and choose how you'd like to transcribe it.</p>
        
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
        
        {/* Provider Selection */}
        <div className="provider-selection">
          <div className="provider-tabs">
            <button 
              className={`provider-tab ${selectedProvider === 'local' ? 'active' : ''}`}
              onClick={() => handleProviderChange('local')}
            >
              🖥️ On-Device (Private)
            </button>
            <button 
              className={`provider-tab ${selectedProvider === 'cloud' ? 'active' : ''}`}
              onClick={() => handleProviderChange('cloud')}
            >
              ☁️ Cloud (Faster)
            </button>
          </div>
        </div>
        
        {/* Local Options */}
        {selectedProvider === 'local' && (
          <div className="model-options local-options">
            <div className="section-header">
              <h3>WhisperX Models (On-Device)</h3>
              <p>Private processing, no internet required</p>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="tiny" 
                value="tiny" 
                checked={selectedModel === 'tiny'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="tiny">
                <span className="model-name"><strong>Tiny</strong> - Fastest local processing, basic accuracy</span>
                <span className="speed-indicator">~1-2x real-time</span>
              </label>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="base" 
                value="base" 
                checked={selectedModel === 'base'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="base">
                <span className="model-name"><strong>Base</strong> - Balanced speed and accuracy (recommended)</span>
                <span className="speed-indicator">~2-4x real-time</span>
              </label>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="small" 
                value="small" 
                checked={selectedModel === 'small'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="small">
                <span className="model-name"><strong>Small</strong> - Better accuracy, slower processing</span>
                <span className="speed-indicator">~3-6x real-time</span>
              </label>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="medium" 
                value="medium" 
                checked={selectedModel === 'medium'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="medium">
                <span className="model-name"><strong>Medium</strong> - High accuracy, longer processing</span>
                <span className="speed-indicator">~4-8x real-time</span>
              </label>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="large" 
                value="large" 
                checked={selectedModel === 'large'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="large">
                <span className="model-name"><strong>Large</strong> - Best accuracy, slowest processing</span>
                <span className="speed-indicator">~6-12x real-time</span>
              </label>
            </div>
          </div>
        )}
        
        {/* Cloud Options */}
        {selectedProvider === 'cloud' && (
          <div className="model-options cloud-options">
            <div className="section-header">
              <h3>Cloud Services (Fast)</h3>
              <p>Requires internet connection and API keys</p>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="openai" 
                value="cloud-openai" 
                checked={selectedModel === 'cloud-openai'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="openai">
                <span className="model-name"><strong>OpenAI Whisper API</strong> - Same model as local, much faster</span>
                <span className="speed-indicator">~1-3 minutes</span>
                <span className="cost-indicator">~$0.006/minute</span>
              </label>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="assemblyai" 
                value="cloud-assemblyai" 
                checked={selectedModel === 'cloud-assemblyai'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="assemblyai">
                <span className="model-name"><strong>AssemblyAI</strong> - Excellent speaker detection, fast processing</span>
                <span className="speed-indicator">~1-2 minutes</span>
                <span className="cost-indicator">~$0.37/hour</span>
              </label>
            </div>
            
            <div className="model-option">
              <input 
                type="radio" 
                id="revai" 
                value="cloud-revai" 
                checked={selectedModel === 'cloud-revai'} 
                onChange={(e) => setSelectedModel(e.target.value)} 
              />
              <label htmlFor="revai">
                <span className="model-name"><strong>Rev.ai</strong> - Fastest processing, professional quality</span>
                <span className="speed-indicator">~30 seconds - 1 minute</span>
                <span className="cost-indicator">~$1.25/hour</span>
              </label>
            </div>
          </div>
        )}
        
        {/* API Key Notice for Cloud Options */}
        {selectedProvider === 'cloud' && (
          <div className={`api-key-notice ${canStartTranscription() ? 'has-keys' : 'needs-keys'}`}>
            {canStartTranscription() ? (
              <p><strong>✓ API Keys Configured</strong> - Ready for cloud transcription</p>
            ) : (
              <>
                <p><strong>⚠️ API Keys Required</strong> - Cloud services need API keys configured</p>
                <button className="settings-link" onClick={handleApiSettingsClick}>
                  Configure API Keys
                </button>
              </>
            )}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="dialog-actions">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button 
            className={`primary-btn ${!canStartTranscription() ? 'disabled' : ''}`}
            onClick={() => {
              if (canStartTranscription()) {
                handleImport();
              }
            }}
            disabled={!canStartTranscription()}
          >
            Start Transcription
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
