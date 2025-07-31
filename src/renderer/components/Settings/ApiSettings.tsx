import React, { useState } from 'react';
import './ApiSettings.css';

interface ApiSettingsProps {
  onSave: (apiKeys: { [service: string]: string }) => void;
  onCancel: () => void;
  currentKeys: { [service: string]: string };
}

const ApiSettings: React.FC<ApiSettingsProps> = ({ onSave, onCancel, currentKeys }) => {
  const [apiKeys, setApiKeys] = useState({
    openai: currentKeys.openai || '',
    assemblyai: currentKeys.assemblyai || '',
    revai: currentKeys.revai || ''
  });

  const [showKeys, setShowKeys] = useState({
    openai: false,
    assemblyai: false,
    revai: false
  });

  const handleKeyChange = (service: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [service]: key }));
  };

  const toggleShowKey = (service: string) => {
    setShowKeys(prev => ({ ...prev, [service]: !prev[service as keyof typeof prev] }));
  };

  const handleSave = () => {
    onSave(apiKeys);
  };

  return (
    <div className="api-settings-overlay">
      <div className="api-settings-dialog">
        <h2>Configure API Keys</h2>
        <p>Enter your API keys for cloud transcription services. Keys are stored locally and encrypted.</p>
        
        <div className="api-key-inputs">
          <div className="api-key-group">
            <label htmlFor="openai-key">
              <strong>OpenAI API Key</strong>
              <span className="service-description">For Whisper API access (~$0.006/minute)</span>
            </label>
            <div className="key-input-container">
              <input
                id="openai-key"
                type={showKeys.openai ? "text" : "password"}
                value={apiKeys.openai}
                onChange={(e) => handleKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                className="api-key-input"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => toggleShowKey('openai')}
                title={showKeys.openai ? "Hide key" : "Show key"}
              >
                {showKeys.openai ? "🙈" : "👁️"}
              </button>
            </div>
            <a 
              href="https://platform.openai.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="get-key-link"
            >
              Get OpenAI API Key →
            </a>
          </div>
          
          <div className="api-key-group">
            <label htmlFor="assemblyai-key">
              <strong>AssemblyAI API Key</strong>
              <span className="service-description">For fast transcription with speaker detection (~$0.37/hour)</span>
            </label>
            <div className="key-input-container">
              <input
                id="assemblyai-key"
                type={showKeys.assemblyai ? "text" : "password"}
                value={apiKeys.assemblyai}
                onChange={(e) => handleKeyChange('assemblyai', e.target.value)}
                placeholder="Enter AssemblyAI API key..."
                className="api-key-input"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => toggleShowKey('assemblyai')}
                title={showKeys.assemblyai ? "Hide key" : "Show key"}
              >
                {showKeys.assemblyai ? "🙈" : "👁️"}
              </button>
            </div>
            <a 
              href="https://www.assemblyai.com/dashboard/signup" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="get-key-link"
            >
              Get AssemblyAI API Key →
            </a>
          </div>
          
          <div className="api-key-group">
            <label htmlFor="revai-key">
              <strong>Rev.ai API Key</strong>
              <span className="service-description">For fastest professional transcription (~$1.25/hour)</span>
            </label>
            <div className="key-input-container">
              <input
                id="revai-key"
                type={showKeys.revai ? "text" : "password"}
                value={apiKeys.revai}
                onChange={(e) => handleKeyChange('revai', e.target.value)}
                placeholder="Enter Rev.ai API key..."
                className="api-key-input"
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => toggleShowKey('revai')}
                title={showKeys.revai ? "Hide key" : "Show key"}
              >
                {showKeys.revai ? "🙈" : "👁️"}
              </button>
            </div>
            <a 
              href="https://www.rev.ai/getting_started" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="get-key-link"
            >
              Get Rev.ai API Key →
            </a>
          </div>
        </div>
        
        <div className="security-note">
          <p>🔒 <strong>Security:</strong> API keys are encrypted and stored locally on your device. They are never transmitted except to the respective transcription services.</p>
        </div>
        
        <div className="dialog-actions">
          <button className="secondary-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn" onClick={handleSave}>
            Save API Keys
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiSettings;