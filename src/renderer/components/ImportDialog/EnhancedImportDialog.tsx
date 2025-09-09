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
  // Smart recommendation removed in simplified flow
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  
  // Audio settings (smart defaults from analysis)
  const [audioSettings, setAudioSettings] = useState<ProjectAudioSettings>({
    masterSampleRate: 48000,
    masterBitDepth: 16,
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
        // For the simplified import flow, force WAV 48k/16-bit regardless of stored prefs
        setAudioSettings(prev => ({
          ...prev,
          masterSampleRate: 48000,
          masterBitDepth: 16,
          storageFormat: 'flac', // ignored in new pipeline, kept for compatibility
          normalizeOnImport: false
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
      // Smart recommendation removed; enforce fixed WAV settings
      setAudioSettings({
        masterSampleRate: 48000,
        masterBitDepth: 16,
        storageFormat: 'flac', // ignored in new pipeline
        normalizeOnImport: false,
      });
      
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

            {/* Smart Recommendation removed in simplified flow */}

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
                <div className="bg-white bg-opacity-5 border border-white/10 rounded p-2 text-xs text-white/80">
                  For stability during beta, imports are converted to WAV (48 kHz, 16-bit).
                  Additional formats and settings will be available in a future update.
                </div>
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
