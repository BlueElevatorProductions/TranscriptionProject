import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface ApiSettingsProps {
  onSave: (apiKeys: { [service: string]: string }) => void;
  onCancel: () => void;
  currentKeys: { [service: string]: string };
}

const ApiSettings: React.FC<ApiSettingsProps> = ({ onSave, onCancel, currentKeys }) => {
  const [apiKeys, setApiKeys] = useState({
    openai: currentKeys?.openai || '',
    assemblyai: currentKeys?.assemblyai || '',
    revai: currentKeys?.revai || ''
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
    <div>
      <div className="space-y-6">
        <div className="space-y-3">
          <div>
            <label htmlFor="openai-key" className="block text-sm font-medium mb-1" style={{ color: 'hsl(var(--text))' }}>
              OpenAI API Key
            </label>
            <p className="text-xs opacity-70 mb-2" style={{ color: 'hsl(var(--text))' }}>For Whisper API access (~$0.006/minute)</p>
            <div className="relative">
              <input
                id="openai-key"
                type={showKeys.openai ? "text" : "password"}
                value={apiKeys.openai}
                onChange={(e) => handleKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 opacity-60 hover:opacity-80"
                style={{ color: 'hsl(var(--text))' }}
                onClick={() => toggleShowKey('openai')}
                title={showKeys.openai ? "Hide key" : "Show key"}
              >
                {showKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <a 
              href="https://platform.openai.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Get OpenAI API Key →
            </a>
          </div>
          
          <div>
            <label htmlFor="assemblyai-key" className="block text-sm font-medium mb-1" style={{ color: 'hsl(var(--text))' }}>
              AssemblyAI API Key
            </label>
            <p className="text-xs opacity-70 mb-2" style={{ color: 'hsl(var(--text))' }}>For fast transcription with speaker detection (~$0.37/hour)</p>
            <div className="relative">
              <input
                id="assemblyai-key"
                type={showKeys.assemblyai ? "text" : "password"}
                value={apiKeys.assemblyai}
                onChange={(e) => handleKeyChange('assemblyai', e.target.value)}
                placeholder="Enter AssemblyAI API key..."
                className="w-full px-3 py-2 pr-10 bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 opacity-60 hover:opacity-80"
                style={{ color: 'hsl(var(--text))' }}
                onClick={() => toggleShowKey('assemblyai')}
                title={showKeys.assemblyai ? "Hide key" : "Show key"}
              >
                {showKeys.assemblyai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <a 
              href="https://www.assemblyai.com/dashboard/signup" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Get AssemblyAI API Key →
            </a>
          </div>
          
          <div>
            <label htmlFor="revai-key" className="block text-sm font-medium mb-1" style={{ color: 'hsl(var(--text))' }}>
              Rev.ai API Key
            </label>
            <p className="text-xs opacity-70 mb-2" style={{ color: 'hsl(var(--text))' }}>For fastest professional transcription (~$1.25/hour)</p>
            <div className="relative">
              <input
                id="revai-key"
                type={showKeys.revai ? "text" : "password"}
                value={apiKeys.revai}
                onChange={(e) => handleKeyChange('revai', e.target.value)}
                placeholder="Enter Rev.ai API key..."
                className="w-full px-3 py-2 pr-10 bg-surface border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 opacity-60 hover:opacity-80"
                style={{ color: 'hsl(var(--text))' }}
                onClick={() => toggleShowKey('revai')}
                title={showKeys.revai ? "Hide key" : "Show key"}
              >
                {showKeys.revai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <a 
              href="https://www.rev.ai/getting_started" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300"
            >
              Get Rev.ai API Key →
            </a>
          </div>
        </div>
        
        <div className="flex items-start gap-2 p-3 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-md">
          <Lock className="w-4 h-4 opacity-80 mt-0.5 flex-shrink-0" style={{ color: 'hsl(var(--text))' }} />
          <div>
            <p className="text-sm opacity-90" style={{ color: 'hsl(var(--text))' }}>
              <strong>Security:</strong> API keys are encrypted and stored locally on your device. They are never transmitted except to the respective transcription services.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 pt-4">
          <button 
            className="px-4 py-2 text-sm bg-white bg-opacity-10 hover:bg-white hover:bg-opacity-15 border border-white border-opacity-20 rounded-md transition-colors" 
            style={{ color: 'hsl(var(--text))' }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 text-sm bg-accent hover:bg-blue-600 rounded-md transition-colors" 
            style={{ color: 'white' }}
            onClick={handleSave}
          >
            Save API Keys
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiSettings;