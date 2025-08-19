import React, { useState, useEffect, useCallback } from 'react';
import { FileAudio, Settings, CheckCircle, AlertCircle, Info, Zap } from 'lucide-react';

interface AudioAnalysis {
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  codec: string;
  sampleRate: number;
  bitDepth?: number;
  bitrate?: number;
  duration: number;
  channels: number;
  isLossy: boolean;
  isCompressed: boolean;
  needsConversion: boolean;
}

interface ConversionRecommendation {
  action: 'keep-original' | 'convert-to-flac' | 'resample' | 'normalize';
  reason: string;
  estimatedSize: number;
  qualityImpact: 'none' | 'minimal' | 'lossy-upscale';
  targetFormat?: string;
  targetSampleRate?: number;
  targetBitDepth?: number;
}

interface ProjectAudioSettings {
  masterSampleRate: 44100 | 48000 | 96000 | 192000;
  masterBitDepth: 16 | 24 | 32;
  storageFormat: 'flac' | 'original' | 'always-convert';
  normalizeOnImport: boolean;
}

interface TranscriptionSettings {
  method: 'local' | 'cloud';
}

interface EnhancedImportDialogProps {
  onClose: () => void;
  onImport: (filePath: string, settings: ProjectAudioSettings, transcription: TranscriptionSettings) => void;
  onOpenApiSettings: () => void;
  isDragDrop?: boolean;
  preselectedFile?: string;
}

const EnhancedImportDialog: React.FC<EnhancedImportDialogProps> = ({ 
  onClose, 
  onImport, 
  onOpenApiSettings,
  isDragDrop = false,
  preselectedFile 
}) => {
  const [filePath, setFilePath] = useState(preselectedFile || '');
  const [fileName, setFileName] = useState('');
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [recommendation, setRecommendation] = useState<ConversionRecommendation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  
  // Audio settings (smart defaults from analysis)
  const [audioSettings, setAudioSettings] = useState<ProjectAudioSettings>({
    masterSampleRate: 48000,
    masterBitDepth: 24,
    storageFormat: 'flac',
    normalizeOnImport: false
  });
  
  // Transcription settings
  const [transcriptionSettings, setTranscriptionSettings] = useState<TranscriptionSettings>({
    method: 'cloud' // Default to cloud (faster, better quality)
  });
  
  // Advanced settings toggle
  const [showAdvanced, setShowAdvanced] = useState(!isDragDrop);
  
  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await (window as any).electronAPI.loadUserPreferences();
        console.log('Loaded user preferences:', preferences);
        
        // Update defaults from user preferences
        setAudioSettings(prev => ({
          ...prev,
          masterSampleRate: preferences.defaultSampleRate,
          masterBitDepth: preferences.defaultBitDepth,
          storageFormat: preferences.defaultAudioFormat,
          normalizeOnImport: preferences.normalizeOnImport
        }));
        
        setTranscriptionSettings({
          method: preferences.defaultTranscriptionMethod
        });
      } catch (error) {
        console.error('Failed to load preferences:', error);
        // Use defaults if loading fails
      }
    };
    
    loadPreferences();
  }, []);

  // Analyze file when selected
  const analyzeFile = useCallback(async (path: string) => {
    if (!path) return;
    
    setIsAnalyzing(true);
    setError('');
    
    try {
      // Call main process to analyze audio
      const audioAnalysis = await (window as any).electronAPI.analyzeAudio(path);
      setAnalysis(audioAnalysis);
      
      // Get smart recommendation
      const smartRecommendation = await (window as any).electronAPI.getAudioRecommendation(audioAnalysis);
      setRecommendation(smartRecommendation);
      
      // Update settings with smart defaults
      const smartSettings = await (window as any).electronAPI.getSmartProjectSettings(audioAnalysis);
      setAudioSettings(smartSettings);
      
      setFileName(audioAnalysis.fileName);
    } catch (err) {
      console.error('Audio analysis failed:', err);
      setError('Failed to analyze audio file. Please ensure it\'s a valid audio format.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Auto-analyze preselected file
  useEffect(() => {
    if (preselectedFile) {
      analyzeFile(preselectedFile);
    }
  }, [preselectedFile, analyzeFile]);

  const handleFileSelect = async () => {
    const result = await window.electronAPI.importAudioDialog();
    if (result.success && result.filePath) {
      setFilePath(result.filePath);
      await analyzeFile(result.filePath);
    } else {
      setError('Failed to select file');
    }
  };

  const handleImport = () => {
    if (!filePath || !analysis) {
      setError('Please select an audio file.');
      return;
    }
    
    onImport(filePath, audioSettings, transcriptionSettings);
    onClose();
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityString = (analysis: AudioAnalysis): string => {
    if (analysis.isLossy) {
      return `${analysis.format.toUpperCase()} ${analysis.bitrate ? Math.round(analysis.bitrate / 1000) + 'kbps' : ''}`;
    } else {
      return `${analysis.bitDepth || 'Unknown'}-bit / ${(analysis.sampleRate / 1000).toFixed(1)}kHz`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white bg-opacity-10 backdrop-blur-xl border border-white border-opacity-20 rounded-2xl shadow-2xl p-6 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 32px 64px rgba(0,0,0,0.3)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileAudio className="text-white" size={20} />
            <h2 className="text-xl font-bold text-white">
              {isDragDrop ? 'Quick Import' : 'Audio Import Settings'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* File Selection */}
        <div className="mb-4">
          <label className="block text-white text-sm font-medium mb-2">Audio File</label>
          <div className="flex gap-3">
            <div className="flex-1 bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3">
              <input
                type="text"
                className="w-full bg-transparent text-white placeholder-white placeholder-opacity-60 outline-none"
                value={fileName || 'No file selected'}
                placeholder="Select an audio file..."
                readOnly
              />
            </div>
            {!preselectedFile && (
              <button
                onClick={handleFileSelect}
                className="px-6 py-3 bg-blue-500 bg-opacity-80 hover:bg-opacity-100 text-white rounded-lg transition-all"
              >
                Browse
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isAnalyzing && (
          <div className="mb-4 flex items-center gap-2 text-white">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-sm">Analyzing audio file...</span>
          </div>
        )}

        {/* File Analysis Results */}
        {analysis && !isAnalyzing && (
          <div className="mb-4 space-y-3">
            {/* File Info Card */}
            <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-white text-opacity-70">Format:</span>
                  <span className="text-white ml-2 font-medium">{analysis.format.toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-white text-opacity-70">Size:</span>
                  <span className="text-white ml-2 font-medium">{formatFileSize(analysis.fileSize)}</span>
                </div>
                <div>
                  <span className="text-white text-opacity-70">Quality:</span>
                  <span className="text-white ml-2 font-medium">{getQualityString(analysis)}</span>
                </div>
                <div>
                  <span className="text-white text-opacity-70">Duration:</span>
                  <span className="text-white ml-2 font-medium">{formatDuration(analysis.duration)}</span>
                </div>
                <div>
                  <span className="text-white text-opacity-70">Channels:</span>
                  <span className="text-white ml-2 font-medium">{analysis.channels === 1 ? 'Mono' : 'Stereo'}</span>
                </div>
                <div>
                  <span className="text-white text-opacity-70">Type:</span>
                  <span className="text-white ml-2 font-medium">
                    {analysis.isLossy ? 'Lossy' : 'Lossless'}
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Recommendation */}
            {recommendation && (
              <div className="bg-green-500 bg-opacity-20 border border-green-400 border-opacity-30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Zap className="text-green-400 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-green-400 font-medium mb-1">Smart Recommendation</h4>
                    <p className="text-white text-sm mb-2">{recommendation.reason}</p>
                    <div className="text-xs text-white text-opacity-70">
                      Estimated size: {formatFileSize(recommendation.estimatedSize)}
                      {recommendation.estimatedSize !== analysis.fileSize && (
                        <span className="text-green-400 ml-2">
                          ({Math.round((1 - recommendation.estimatedSize / analysis.fileSize) * 100)}% smaller)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transcription Method Selection */}
            <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2 text-sm">
                <Zap size={16} />
                Transcription Method
              </h4>
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="transcription"
                    value="cloud"
                    checked={transcriptionSettings.method === 'cloud'}
                    onChange={(e) => setTranscriptionSettings({...transcriptionSettings, method: e.target.value as 'cloud'})}
                    className="mt-1 text-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">☁️ Cloud Processing</span>
                      <span className="text-xs bg-green-500 bg-opacity-20 text-green-400 px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-white text-opacity-70 mt-0.5">
                      Fast, high-quality using OpenAI Whisper API (~1-3 minutes)
                    </p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="transcription"
                    value="local"
                    checked={transcriptionSettings.method === 'local'}
                    onChange={(e) => setTranscriptionSettings({...transcriptionSettings, method: e.target.value as 'local'})}
                    className="mt-1 text-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-white font-medium text-sm">🖥️ Local Processing</span>
                    <p className="text-xs text-white text-opacity-70 mt-0.5">
                      Private, slower, uses device CPU/GPU (2-10x real-time)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            {!isDragDrop && (
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-white text-opacity-80 hover:text-opacity-100 transition-colors"
              >
                <Settings size={16} />
                <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Audio Settings</span>
              </button>
            )}

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3 space-y-3">
                <h4 className="text-white font-medium flex items-center gap-2 text-sm">
                  <Settings size={16} />
                  Project Audio Settings
                </h4>
                
                {/* Storage Format */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">Storage Format</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="storageFormat"
                        value="original"
                        checked={audioSettings.storageFormat === 'original'}
                        onChange={(e) => setAudioSettings({...audioSettings, storageFormat: e.target.value as any})}
                        className="text-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-white text-sm">Keep Original ({analysis.format.toUpperCase()})</span>
                        <p className="text-xs text-white text-opacity-60">
                          {formatFileSize(analysis.fileSize)} - No conversion
                        </p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="storageFormat"
                        value="flac"
                        checked={audioSettings.storageFormat === 'flac'}
                        onChange={(e) => setAudioSettings({...audioSettings, storageFormat: e.target.value as any})}
                        className="text-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-white text-sm">Convert to FLAC (Lossless)</span>
                        <p className="text-xs text-white text-opacity-60">
                          ~{formatFileSize(analysis.fileSize * 0.6)} - {analysis.isLossy ? 'Quality preserved' : '40% smaller'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Sample Rate - Hidden for lossy formats to avoid conversion */}
                {!analysis.isLossy && (
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Project Sample Rate</label>
                    <select
                      value={audioSettings.masterSampleRate}
                      onChange={(e) => setAudioSettings({...audioSettings, masterSampleRate: parseInt(e.target.value) as any})}
                      className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-2 text-white text-sm"
                    >
                      <option value={44100}>44.1 kHz (CD Quality)</option>
                      <option value={48000}>48 kHz (Professional)</option>
                      <option value={96000}>96 kHz (High Resolution)</option>
                      <option value={192000}>192 kHz (Ultra High Res)</option>
                    </select>
                  </div>
                )}

                {/* Bit Depth - Hidden for lossy formats to avoid conversion */}
                {!analysis.isLossy && (
                  <div>
                    <label className="block text-white text-sm font-medium mb-2">Project Bit Depth</label>
                    <select
                      value={audioSettings.masterBitDepth}
                      onChange={(e) => setAudioSettings({...audioSettings, masterBitDepth: parseInt(e.target.value) as any})}
                      className="w-full bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-2 text-white text-sm"
                    >
                      <option value={16}>16-bit (Standard)</option>
                      <option value={24}>24-bit (Professional)</option>
                      <option value={32}>32-bit (Maximum Quality)</option>
                    </select>
                  </div>
                )}

                {/* Warning for lossy formats */}
                {analysis.isLossy && (
                  <div className="bg-amber-500 bg-opacity-20 border border-amber-400 border-opacity-30 rounded-lg p-2">
                    <p className="text-amber-400 text-xs">
                      ⚠️ Sample rate and bit depth settings are disabled for {analysis.format.toUpperCase()} files to avoid unnecessary conversion. The audio will be stored in its original format.
                    </p>
                  </div>
                )}

                {/* Apply to future imports */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={audioSettings.normalizeOnImport}
                    onChange={(e) => setAudioSettings({...audioSettings, normalizeOnImport: e.target.checked})}
                    className="text-blue-500"
                  />
                  <span className="text-white text-sm">
                    Apply these settings to future imports
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-500 bg-opacity-20 border border-red-400 border-opacity-30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-red-400" size={16} />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white bg-opacity-10 hover:bg-opacity-20 text-white rounded-lg transition-all border border-white border-opacity-20 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!analysis || isAnalyzing}
            className="px-4 py-2 bg-blue-500 bg-opacity-80 hover:bg-opacity-100 disabled:bg-opacity-40 text-white rounded-lg transition-all disabled:cursor-not-allowed text-sm"
          >
            {isDragDrop ? 'Import & Start' : 'Import Audio'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedImportDialog;