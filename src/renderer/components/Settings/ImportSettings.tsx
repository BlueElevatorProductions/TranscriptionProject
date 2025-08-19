import React, { useState, useEffect } from 'react';
import { Settings, Zap, Save, RotateCcw } from 'lucide-react';

interface ImportPreferences {
  defaultTranscriptionMethod: 'local' | 'cloud';
  defaultLocalModel: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  defaultCloudProvider: 'openai' | 'assemblyai' | 'revai';
  defaultAudioFormat: 'flac' | 'original' | 'always-convert';
  defaultSampleRate: 44100 | 48000 | 96000 | 192000;
  defaultBitDepth: 16 | 24 | 32;
  normalizeOnImport: boolean;
}

interface ImportSettingsProps {
  onSave: (preferences: ImportPreferences) => void;
  onCancel: () => void;
  onClose: () => void;
}

const ImportSettings: React.FC<ImportSettingsProps> = ({
  onSave,
  onCancel,
  onClose
}) => {
  const [preferences, setPreferences] = useState<ImportPreferences>({
    defaultTranscriptionMethod: 'cloud',
    defaultLocalModel: 'base',
    defaultCloudProvider: 'openai',
    defaultAudioFormat: 'flac',
    defaultSampleRate: 48000,
    defaultBitDepth: 24,
    normalizeOnImport: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const currentPrefs = await (window as any).electronAPI.loadUserPreferences();
        console.log('Loaded preferences for settings panel:', currentPrefs);
        setPreferences(currentPrefs);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await (window as any).electronAPI.saveUserPreferences(preferences);
      console.log('Preferences saved successfully');
      onSave(preferences);
      onClose();
    } catch (error) {
      console.error('Failed to save preferences:', error);
      // Could show error notification here
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const defaultPrefs = await (window as any).electronAPI.resetUserPreferences();
      console.log('Preferences reset to defaults:', defaultPrefs);
      setPreferences(defaultPrefs);
    } catch (error) {
      console.error('Failed to reset preferences:', error);
    }
  };

  const updatePreference = (key: keyof ImportPreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="p-6 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="text-center mt-4 opacity-70">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="p-6 text-white h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Settings className="text-white" size={24} />
          <h2 className="text-xl font-bold">Import Preferences</h2>
        </div>

        {/* Transcription Method */}
        <div>
          <h3 className="text-sm font-semibold mb-3 opacity-70">TRANSCRIPTION METHOD</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="transcriptionMethod"
                value="cloud"
                checked={preferences.defaultTranscriptionMethod === 'cloud'}
                onChange={(e) => updatePreference('defaultTranscriptionMethod', e.target.value)}
                className="mt-1 text-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">☁️ Cloud Processing</span>
                  <span className="text-xs bg-green-500 bg-opacity-20 text-green-400 px-2 py-1 rounded">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-white text-opacity-70 mt-1">
                  Fast, high-quality using cloud APIs (~1-3 minutes)
                </p>
              </div>
            </label>
            
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="transcriptionMethod"
                value="local"
                checked={preferences.defaultTranscriptionMethod === 'local'}
                onChange={(e) => updatePreference('defaultTranscriptionMethod', e.target.value)}
                className="mt-1 text-blue-500"
              />
              <div className="flex-1">
                <span className="text-white font-medium">🖥️ Local Processing</span>
                <p className="text-xs text-white text-opacity-70 mt-1">
                  Private, slower, uses device CPU/GPU (2-10x real-time)
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Local Model Selection */}
        {preferences.defaultTranscriptionMethod === 'local' && (
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-70">LOCAL MODEL</h3>
            <select
              value={preferences.defaultLocalModel}
              onChange={(e) => updatePreference('defaultLocalModel', e.target.value)}
              className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3 text-white"
            >
              <option value="tiny">Tiny (fastest, lowest accuracy)</option>
              <option value="base">Base (recommended balance)</option>
              <option value="small">Small (better accuracy)</option>
              <option value="medium">Medium (high accuracy)</option>
              <option value="large">Large (best accuracy, slowest)</option>
            </select>
          </div>
        )}

        {/* Cloud Provider Selection */}
        {preferences.defaultTranscriptionMethod === 'cloud' && (
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-70">CLOUD PROVIDER</h3>
            <select
              value={preferences.defaultCloudProvider}
              onChange={(e) => updatePreference('defaultCloudProvider', e.target.value)}
              className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3 text-white"
            >
              <option value="openai">OpenAI Whisper (recommended)</option>
              <option value="assemblyai">AssemblyAI</option>
              <option value="revai">Rev.ai</option>
            </select>
          </div>
        )}

        {/* Audio Settings */}
        <div>
          <h3 className="text-sm font-semibold mb-3 opacity-70">AUDIO SETTINGS</h3>
          
          {/* Storage Format */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">Storage Format</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="storageFormat"
                  value="original"
                  checked={preferences.defaultAudioFormat === 'original'}
                  onChange={(e) => updatePreference('defaultAudioFormat', e.target.value)}
                  className="text-blue-500"
                />
                <span className="text-white text-sm">Keep Original Format</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="storageFormat"
                  value="flac"
                  checked={preferences.defaultAudioFormat === 'flac'}
                  onChange={(e) => updatePreference('defaultAudioFormat', e.target.value)}
                  className="text-blue-500"
                />
                <div className="flex-1">
                  <span className="text-white text-sm">Convert to FLAC (Lossless)</span>
                  <p className="text-xs text-white text-opacity-60 mt-1">
                    Recommended for professional work
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="storageFormat"
                  value="always-convert"
                  checked={preferences.defaultAudioFormat === 'always-convert'}
                  onChange={(e) => updatePreference('defaultAudioFormat', e.target.value)}
                  className="text-blue-500"
                />
                <span className="text-white text-sm">Always Convert to FLAC</span>
              </label>
            </div>
          </div>

          {/* Sample Rate */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">Default Sample Rate</label>
            <select
              value={preferences.defaultSampleRate}
              onChange={(e) => updatePreference('defaultSampleRate', parseInt(e.target.value))}
              className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-2 text-white"
            >
              <option value={44100}>44.1 kHz (CD Quality)</option>
              <option value={48000}>48 kHz (Professional)</option>
              <option value={96000}>96 kHz (High Resolution)</option>
              <option value={192000}>192 kHz (Ultra High Res)</option>
            </select>
          </div>

          {/* Bit Depth */}
          <div className="mb-4">
            <label className="block text-white text-sm font-medium mb-2">Default Bit Depth</label>
            <select
              value={preferences.defaultBitDepth}
              onChange={(e) => updatePreference('defaultBitDepth', parseInt(e.target.value))}
              className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-2 text-white"
            >
              <option value={16}>16-bit (Standard)</option>
              <option value={24}>24-bit (Professional)</option>
              <option value={32}>32-bit (Maximum Quality)</option>
            </select>
          </div>

          {/* Apply to Future Imports Option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.normalizeOnImport}
              onChange={(e) => updatePreference('normalizeOnImport', e.target.checked)}
              className="text-blue-500"
            />
            <span className="text-white text-sm">
              Make these the default settings for all future imports
            </span>
          </label>
        </div>

        {/* Usage Hint */}
        <div className="bg-blue-500 bg-opacity-20 border border-blue-400 border-opacity-30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Zap className="text-blue-400 mt-0.5" size={18} />
            <div>
              <h4 className="text-blue-400 font-medium mb-1">Smart Defaults</h4>
              <p className="text-white text-sm">
                These preferences will be used as defaults when importing audio files. 
                You can still override them on a per-import basis in the import dialog.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-white border-opacity-20">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-10 hover:bg-opacity-20 text-white rounded-lg transition-all border border-white border-opacity-20"
          >
            <RotateCcw size={16} />
            Reset to Defaults
          </button>
          
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white bg-opacity-10 hover:bg-opacity-20 text-white rounded-lg transition-all border border-white border-opacity-20"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 bg-opacity-80 hover:bg-opacity-100 disabled:bg-opacity-40 text-white rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save size={16} />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportSettings;