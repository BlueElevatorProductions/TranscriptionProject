/**
 * ImportDialogV2 - Glass morphism audio import dialog
 *
 * Direct v2.0 implementation with:
 * - Semi-transparent glass styling
 * - Direct transcription to segments
 * - Simplified options for stability
 */

import React, { useState, useEffect } from 'react';
import { Upload, FileAudio, Zap, Cloud, X, Settings } from 'lucide-react';

export interface ImportDialogV2Props {
  onClose: () => void;
  onImport: (filePath: string, settings: ImportSettings) => void;
}

export interface ImportSettings {
  transcriptionMethod: 'cloud' | 'local';
  audioFormat: 'wav' | 'original';
  quality: 'standard' | 'high';
}

const ImportDialogV2: React.FC<ImportDialogV2Props> = ({
  onClose,
  onImport,
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Import settings with sensible defaults
  const [settings, setSettings] = useState<ImportSettings>({
    transcriptionMethod: 'cloud',
    audioFormat: 'wav',
    quality: 'standard',
  });

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isImporting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isImporting]);

  // Handle file selection
  const handleSelectFile = async () => {
    try {
      const result = await (window as any).electronAPI?.importAudioDialog?.();

      if (result && !result.cancelled && result.filePath) {
        setSelectedFile(result.filePath);
        setFileName(result.filePath.split('/').pop() || 'Unknown file');
        setError(null);
        console.log('📁 Audio file selected:', result.filePath);
      }
    } catch (error) {
      console.error('Failed to select audio file:', error);
      setError('Failed to select audio file');
    }
  };

  // Handle drag and drop
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);
    const audioFile = files.find(file =>
      file.type.startsWith('audio/') ||
      ['.mp3', '.wav', '.flac', '.m4a', '.aac'].some(ext => file.name.toLowerCase().endsWith(ext))
    );

    if (audioFile) {
      setSelectedFile(audioFile.path);
      setFileName(audioFile.name);
      setError(null);
      console.log('📂 Audio file dropped:', audioFile.path);
    } else {
      setError('Please drop an audio file');
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select an audio file');
      return;
    }

    console.log('🚀 ImportDialogV2: Starting import with settings:', settings);
    console.log('📁 Selected file:', selectedFile);

    setIsImporting(true);
    setError(null);

    try {
      console.log('🔧 ImportDialogV2: Calling onImport callback');
      onImport(selectedFile, settings);
    } catch (error) {
      console.error('❌ ImportDialogV2: Import failed:', error);
      setError(error instanceof Error ? error.message : 'Import failed');
      setIsImporting(false);
    }
  };

  return (
    <div className="dialog-overlay-v2" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-content-v2">
        <div className="dialog-v2">
          {/* Header */}
          <div className="dialog-header-v2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Upload className="w-6 h-6 text-primary" />
                <div>
                  <h2 className="dialog-title-v2">Import Audio File</h2>
                  <p className="dialog-description-v2">
                    Select an audio file to transcribe and edit
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isImporting}
                className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="dialog-body-v2">
            <div className="space-y-6">
              {/* File Selection Area */}
              <div className="form-group-v2">
                <label className="form-label-v2">Audio File</label>

                {!selectedFile ? (
                  <div
                    className="border-2 border-dashed border-accent/30 rounded-lg p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
                    onClick={handleSelectFile}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => e.preventDefault()}
                  >
                    <FileAudio className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-foreground font-medium mb-2">
                      Drop audio file here or click to browse
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Supports MP3, WAV, FLAC, M4A, AAC
                    </p>
                  </div>
                ) : (
                  <div className="panel-glass">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileAudio className="w-8 h-8 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{fileName}</p>
                          <p className="text-sm text-muted-foreground">Ready to import</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedFile(null);
                          setFileName('');
                        }}
                        disabled={isImporting}
                        className="button-glass secondary"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Transcription Method */}
              <div className="form-group-v2">
                <label className="form-label-v2">Transcription Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('🔘 Cloud method selected');
                      setSettings(prev => ({ ...prev, transcriptionMethod: 'cloud' }));
                    }}
                    disabled={isImporting}
                    className={`panel-glass p-4 text-left transition-all hover:border-accent/50 ${
                      settings.transcriptionMethod === 'cloud'
                        ? 'border-accent bg-accent/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Cloud className="w-5 h-5 text-primary" />
                      <span className="font-medium">Cloud</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fast, accurate transcription using OpenAI Whisper
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      console.log('🔘 Local method selected');
                      setSettings(prev => ({ ...prev, transcriptionMethod: 'local' }));
                    }}
                    disabled={isImporting}
                    className={`panel-glass p-4 text-left transition-all hover:border-accent/50 ${
                      settings.transcriptionMethod === 'local'
                        ? 'border-accent bg-accent/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <span className="font-medium">Local</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Process locally on your machine (slower)
                    </p>
                  </button>
                </div>
              </div>

              {/* Audio Processing */}
              <div className="form-group-v2">
                <label className="form-label-v2">Audio Processing</label>
                <div className="panel-glass p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-foreground">Format</span>
                        <p className="text-sm text-muted-foreground">
                          Convert to WAV for best compatibility
                        </p>
                      </div>
                      <select
                        value={settings.audioFormat}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          audioFormat: e.target.value as 'wav' | 'original'
                        }))}
                        disabled={isImporting}
                        className="select-glass w-32"
                      >
                        <option value="wav">WAV</option>
                        <option value="original">Original</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-foreground">Quality</span>
                        <p className="text-sm text-muted-foreground">
                          Processing quality level
                        </p>
                      </div>
                      <select
                        value={settings.quality}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          quality: e.target.value as 'standard' | 'high'
                        }))}
                        disabled={isImporting}
                        className="select-glass w-32"
                      >
                        <option value="standard">Standard</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Debug Info */}
              <div className="panel-glass p-3">
                <h4 className="text-sm font-medium mb-2 text-foreground">Debug Settings:</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Method: <span className="text-primary">{settings.transcriptionMethod}</span></div>
                  <div>Format: <span className="text-primary">{settings.audioFormat}</span></div>
                  <div>Quality: <span className="text-primary">{settings.quality}</span></div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="error-message-v2">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="dialog-footer-v2">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="button-glass secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedFile || isImporting}
              className="button-glass primary"
            >
              {isImporting ? (
                <div className="flex items-center space-x-2">
                  <div className="loading-spinner-v2" />
                  <span>Starting...</span>
                </div>
              ) : (
                'Start Transcription'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportDialogV2;